import { prisma } from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_fallback_dev';
const OWNER_DEFAULT_MODULES = [
  { codigo: 'dashboard', nome: 'Dashboard' },
  { codigo: 'reports', nome: 'Relatorios' },
  { codigo: 'finance', nome: 'Financeiro' },
  { codigo: 'users', nome: 'Equipe' },
  { codigo: 'gateways', nome: 'Gateways' },
];

export class AuthService {
  async login(email: string, passwordPlain: string) {
    // Busca usuário e já traz as Roles juntas (JOIN automático)
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: { company: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) throw new Error('Credenciais inválidas');
    if (!user.passwordHash) throw new Error('Usuário sem senha definida');

    const isValid = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isValid) throw new Error('Credenciais inválidas');

    // Pega o primeiro papel (assumindo 1 role ativa por login por enquanto)
    const activeRole = user.roles[0]; 

    const token = jwt.sign(
      { 
        userId: user.id, 
        role: activeRole?.role, 
        companyId: activeRole?.companyId 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

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
      include: {
        roles: {
          include: { company: true }, // Traz dados da empresa
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) return null;
    const activeRole = user.roles[0];
    const companyId = activeRole?.companyId;

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

    return {
      id: user.id,
      full_name: user.fullName,
      email: user.email,
      role: activeRole?.role,
      company_id: companyId,
      company_name: activeRole?.company?.name,
      company_slug: activeRole?.company?.slug,
      modules: Array.from(moduleMap.values()),
    };
  }
}
