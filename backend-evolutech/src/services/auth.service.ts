import { prisma } from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { AppRole } from '../types';
import { JWT_SECRET } from '../config/secrets';

// 7 dias, alinhado ao que o .env.example ja documentava. Com 24h o dono
// precisava logar de novo todo dia no app da tela de inicio.
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];
const OWNER_DEFAULT_MODULES = [
  { codigo: 'dashboard', nome: 'Dashboard' },
  { codigo: 'reports', nome: 'Relatorios' },
  { codigo: 'finance', nome: 'Financeiro' },
  { codigo: 'users', nome: 'Equipe' },
  { codigo: 'permissions', nome: 'Permissoes' },
  // 'gateways' saiu daqui: virou modulo concedido por empresa, via
  // empresa_modulos. O espelho desta lista vive em src/hooks/useCompanyModules.ts
  // (OWNER_DEFAULT_CODES) e as duas precisam andar juntas.
  { codigo: 'commissions_owner', nome: 'Comissoes' },
];
const COMPANY_DEFAULT_MODULES = [
  { codigo: 'support', nome: 'Suporte', allowed_roles: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] as string[] },
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

  private async listEmployeeModulePermissions(companyId: string, userId: string) {
    return prisma.$queryRaw<Array<{ moduloId: string; isAllowed: boolean }>>(Prisma.sql`
      SELECT
        "modulo_id" AS "moduloId",
        "is_allowed" AS "isAllowed"
      FROM "employee_module_permissions"
      WHERE "empresa_id" = ${companyId}
        AND "user_id" = ${userId}
    `);
  }

  private buildMeCacheKey(userId: string, role?: AppRole, companyId?: string | null) {
    return `${userId}:${role || 'unknown'}:${companyId || 'none'}`;
  }

  private async resolveModulesForRole(
    role: AppRole | undefined,
    companyId: string | null | undefined,
    sistemaBaseId: string | null | undefined,
    userId: string
  ) {
    if (!companyId) return [];

    const [companyModules, sistemaBaseModules, employeePermissions] = await Promise.all([
      prisma.companyModule.findMany({
        where: {
          companyId,
          isActive: true,
          modulo: { status: 'active' },
        },
        include: { modulo: true },
      }),
      sistemaBaseId
        ? prisma.sistemaBaseModulo.findMany({
            where: {
              sistemaBaseId,
              modulo: { status: 'active' },
            },
            include: { modulo: true },
          })
        : Promise.resolve([]),
      role === 'FUNCIONARIO_EMPRESA'
        ? this.listEmployeeModulePermissions(companyId, userId)
        : Promise.resolve([]),
    ]);

    const deniedModuleIds =
      role === 'FUNCIONARIO_EMPRESA'
        ? new Set(
            employeePermissions
              .filter((item: { moduloId: string; isAllowed: boolean }) => item.isAllowed === false)
              .map((item: { moduloId: string; isAllowed: boolean }) => item.moduloId)
          )
        : new Set<string>();

      const moduleMap = new Map<
        string,
        {
          id: string;
          codigo: string;
          nome: string;
          icone: string | null;
          is_pro: boolean;
          allowed_roles: string[];
        }
      >();

      for (const item of companyModules) {
        if (deniedModuleIds.has(item.modulo.id)) continue;
        moduleMap.set(item.modulo.id, {
          id: item.modulo.id,
          codigo: item.modulo.codigo,
          nome: item.modulo.nome,
          icone: item.modulo.icone,
          is_pro: Boolean((item.modulo as any).isPro),
          allowed_roles: Array.isArray((item as any).allowedRoles) && (item as any).allowedRoles.length > 0
            ? (item as any).allowedRoles
            : Array.isArray((item.modulo as any).allowedRoles)
            ? (item.modulo as any).allowedRoles
            : ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'],
        });
      }

      for (const item of sistemaBaseModules) {
        if (deniedModuleIds.has(item.modulo.id)) continue;
        moduleMap.set(item.modulo.id, {
          id: item.modulo.id,
          codigo: item.modulo.codigo,
          nome: item.modulo.nome,
          icone: item.modulo.icone,
          is_pro: Boolean((item.modulo as any).isPro),
          allowed_roles: Array.isArray((item as any).allowedRoles) && (item as any).allowedRoles.length > 0
            ? (item as any).allowedRoles
            : Array.isArray((item.modulo as any).allowedRoles)
            ? (item.modulo as any).allowedRoles
            : ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'],
        });
      }

    if (role === 'DONO_EMPRESA') {
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
            is_pro: false,
            allowed_roles: ['DONO_EMPRESA'],
          });
        }
      }
    }

    if (role === 'DONO_EMPRESA' || role === 'FUNCIONARIO_EMPRESA') {
      for (const moduleItem of COMPANY_DEFAULT_MODULES) {
        const hasCode = Array.from(moduleMap.values()).some(
          (item) => String(item.codigo || '').toLowerCase() === moduleItem.codigo
        );
        if (!hasCode) {
          moduleMap.set(`company-default-${moduleItem.codigo}`, {
            id: `company-default-${moduleItem.codigo}`,
            codigo: moduleItem.codigo,
            nome: moduleItem.nome,
            icone: null,
            is_pro: false,
            allowed_roles: moduleItem.allowed_roles,
          });
        }
      }
    }

    return Array.from(moduleMap.values());
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
                logoUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) throw new Error('Credenciais invalidas');
    if (!user.isActive) throw new Error('Usuario inativo');
    if (!user.passwordHash) throw new Error('Usuario sem senha definida');

    const isValid = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isValid) throw new Error('Credenciais invalidas');

    const activeRole = user.roles[0];

    // Conta sem vinculo nao recebe token.
    //
    // Um usuario pode ficar sem papel quando a empresa dele e apagada: as
    // linhas de user_roles caem por cascata e a conta sobrevive. Emitir um
    // token sem a claim `role` nesse caso era o que fazia o middleware cair
    // no padrao de super admin.
    if (!activeRole?.role) {
      throw new Error('Sua conta nao esta vinculada a nenhum perfil de acesso');
    }

    const tokenPayload: JwtAuthPayload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: activeRole.role as AppRole,
      companyId: activeRole.companyId || null,
      companyName: activeRole.company?.name || null,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Pré-aquece o payload completo do /auth/me sem bloquear a resposta do login.
    void this.getMe(user.id).catch(() => null);

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
        modules: [],
      },
      company: activeRole?.companyId
        ? {
            id: activeRole.companyId,
            name: activeRole?.company?.name,
            slug: activeRole?.company?.slug,
            logo_url: activeRole?.company?.logoUrl || null,
            modules: [],
          }
        : null,
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
                logoUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) return null;

    const activeRole = user.roles[0];
    const companyId = activeRole?.companyId;
    const meCacheKey = this.buildMeCacheKey(userId, activeRole?.role as AppRole | undefined, companyId);
    const now = Date.now();
    const cached = this.meCache.get(meCacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.payload;
    }

    const modules = await this.resolveModulesForRole(
      activeRole?.role as AppRole | undefined,
      companyId,
      activeRole?.company?.sistemaBaseId,
      userId
    );

    const payload = {
      id: user.id,
      full_name: user.fullName,
      email: user.email,
      role: activeRole?.role,
      company_id: companyId,
      company_name: activeRole?.company?.name,
      company_slug: activeRole?.company?.slug,
      company_logo_url: activeRole?.company?.logoUrl || null,
      modules,
    };

    this.meCache.set(meCacheKey, {
      payload,
      expiresAt: now + this.meCacheTtlMs,
    });

    return payload;
  }

  /**
   * Limpa o /auth/me em cache do usuario. O cache e chaveado por papel e
   * empresa, que nao mudam aqui, mas varrer por prefixo evita depender disso.
   */
  private invalidateMeCache(userId: string) {
    for (const key of Array.from(this.meCache.keys())) {
      if (key.startsWith(`${userId}:`)) this.meCache.delete(key);
    }
  }

  /**
   * Edicao do proprio cadastro: nome e e-mail. Vale para qualquer papel —
   * o barbeiro corrige o proprio nome sem depender do dono.
   *
   * O e-mail e a credencial de login, entao trocar aqui troca o login. O token
   * atual continua valendo porque o middleware resolve o usuario pelo id.
   */
  async updateMyProfile(userId: string, data: { name?: string; email?: string }) {
    const nome = String(data.name ?? '').trim();
    const emailBruto = String(data.email ?? '').trim().toLowerCase();

    if (!nome && !emailBruto) {
      throw new Error('Informe ao menos um campo: name ou email');
    }
    if (data.name !== undefined && nome.length < 2) {
      throw new Error('O nome deve ter pelo menos 2 caracteres');
    }
    if (data.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailBruto)) {
      throw new Error('E-mail invalido');
    }

    const atual = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true },
    });
    if (!atual) throw new Error('Usuario nao encontrado');

    // Colisao de e-mail derruba o login de duas contas de uma vez; barra antes.
    if (emailBruto && emailBruto !== atual.email) {
      const jaUsado = await prisma.user.findUnique({
        where: { email: emailBruto },
        select: { id: true },
      });
      if (jaUsado && jaUsado.id !== userId) {
        throw new Error('Este e-mail ja esta em uso por outra conta');
      }
    }

    const atualizado = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(nome ? { fullName: nome } : {}),
        ...(emailBruto ? { email: emailBruto } : {}),
      },
      select: { id: true, fullName: true, email: true },
    });

    this.invalidateMeCache(userId);

    return {
      id: atualizado.id,
      name: atualizado.fullName,
      email: atualizado.email,
      email_changed: atualizado.email !== atual.email,
    };
  }

  async changeMyPassword(
    userId: string,
    data: { current_password?: string; new_password?: string }
  ) {
    const currentPassword = String(data.current_password || '');
    const newPassword = String(data.new_password || '');

    if (!currentPassword || !newPassword) {
      throw new Error('Campos obrigatorios: current_password, new_password');
    }
    if (newPassword.length < 6) {
      throw new Error('A nova senha deve ter pelo menos 6 caracteres');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        roles: {
          select: { role: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) throw new Error('Usuario nao encontrado');
    if (!user.passwordHash) throw new Error('Usuario sem senha definida');

    const activeRole = user.roles[0]?.role;
    if (activeRole !== 'DONO_EMPRESA') {
      throw new Error('Apenas DONO_EMPRESA pode alterar a propria senha nesta tela');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Senha atual incorreta');
    }

    const nextHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: nextHash },
    });

    return { ok: true };
  }
}
