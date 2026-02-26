import { prisma } from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppRole } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_fallback_dev';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '24h') as jwt.SignOptions['expiresIn'];
const OWNER_DEFAULT_MODULES = [
  { codigo: 'dashboard', nome: 'Dashboard' },
  { codigo: 'reports', nome: 'Relatorios' },
  { codigo: 'finance', nome: 'Financeiro' },
  { codigo: 'users', nome: 'Equipe' },
  { codigo: 'gateways', nome: 'Gateways' },
  { codigo: 'commissions_owner', nome: 'Comissões' },
];

type JwtAuthPayload = {
  userId: string;
  email: string;
  fullName: string;
  role?: AppRole;
  companyId?: string | null;
  companyName?: string | null;
};

export class AuthService {
  private meCache = new Map<string, { payload: any; expiresAt: number }>();
  private meCacheTtlMs = Number(process.env.AUTH_ME_CACHE_TTL_MS || 15000);

  private buildMeCacheKey(userId: string, role?: AppRole, companyId?: string | null) {
    return `${userId}:${role || 'unknown'}:${companyId || 'none'}`;
  }

  async login(email: string, passwordPlain: string) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        passwordHash: true,
        roles: {
          select: {
            role: true,
            companyId: true,
            company: {
              select: {
                name: true,
                slug: true,
                sistemaBaseId: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) throw new Error('Credenciais inválidas');
    if (!user.isActive) throw new Error('Usuario inativo');
    if (!user.passwordHash) throw new Error('Usuário sem senha definida');

    const isValid = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isValid) throw new Error('Credenciais inválidas');

    const activeRole = user.roles[0];

    const tokenPayload: JwtAuthPayload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: activeRole?.role,
      companyId: activeRole?.companyId || null,
      companyName: activeRole?.company?.name || null,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.fullName,
        role: activeRole?.role,
        tenantId: activeRole?.companyId,
        tenantName: activeRole?.company?.name,
        tenantSlug: activeRole?.company?.slug,
      }
    };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        roles: {
          select: {
            role: true,
            companyId: true,
            company: {
              select: {
                name: true,
                slug: true,
                sistemaBaseId: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      }
    });

    if (!user) return null;
    const activeRole = user.roles[0];
    const companyId = activeRole?.companyId;
    const meCacheKey = this.buildMeCacheKey(userId, activeRole?.role, companyId);
    const now = Date.now();
    const cached = this.meCache.get(meCacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.payload;
    }

    const [companyModules, sistemaBaseModules] = companyId
      ? await Promise.all([
          prisma.companyModule.findMany({
            where: {
              companyId,
              isActive: true,
              modulo: { status: 'active' },
            },
            include: { modulo: true },
          }),
          activeRole?.company?.sistemaBaseId
            ? prisma.sistemaBaseModulo.findMany({
                where: {
                  sistemaBaseId: activeRole.company.sistemaBaseId,
                  modulo: { status: 'active' },
                },
                include: { modulo: true },
              })
            : Promise.resolve([]),
        ])
      : [[], []];

    const moduleMap = new Map<string, { id: string; codigo: string; nome: string; icone: string | null }>();
    for (const item of companyModules) {
      moduleMap.set(item.modulo.id, {
        id: item.modulo.id,
        codigo: item.modulo.codigo,
        nome: item.modulo.nome,
        icone: item.modulo.icone,
      });
    }
    for (const item of sistemaBaseModules) {
      moduleMap.set(item.modulo.id, {
        id: item.modulo.id,
        codigo: item.modulo.codigo,
        nome: item.modulo.nome,
        icone: item.modulo.icone,
      });
    }

    if (activeRole?.role === 'DONO_EMPRESA') {
      for (const moduleItem of OWNER_DEFAULT_MODULES) {
        const hasCode = Array.from(moduleMap.values()).some(
          (item) => String(item.codigo || '').toLowerCase() === moduleItem.codigo
        );
        if (!hasCode) {
          moduleMap.set(`owner-default-${moduleItem.codigo}`, {
            id: `owner-default-${moduleItem.codigo}`,
            codigo: moduleItem.codigo,
            nome: moduleItem.nome,
            icone: null,
          });
        }
      }
    }

    const payload = {
      id: user.id,
      full_name: user.fullName,
      email: user.email,
      role: activeRole?.role,
      company_id: companyId,
      company_name: activeRole?.company?.name,
      company_slug: activeRole?.company?.slug,
      modules: Array.from(moduleMap.values()),
    };
    this.meCache.set(meCacheKey, {
      payload,
      expiresAt: now + this.meCacheTtlMs,
    });
    return payload;
  }
}

