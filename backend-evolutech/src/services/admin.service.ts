import { prisma } from '../db';
import { Prisma, Role, Status } from '@prisma/client';
import bcrypt from 'bcryptjs';

type SistemaStatusInput = 'active' | 'inactive' | 'pending';

const mapStatusToIsActive = (status?: SistemaStatusInput): boolean => status === 'active';
const mapIsActiveToStatus = (isActive: boolean): SistemaStatusInput => (isActive ? 'active' : 'inactive');

export class AdminService {
  private parseRole(role?: string): Role {
    const normalized = (role || '').toUpperCase().trim();
    if (normalized === 'SUPER_ADMIN_EVOLUTECH') return 'SUPER_ADMIN_EVOLUTECH';
    if (normalized === 'ADMIN_EVOLUTECH') return 'ADMIN_EVOLUTECH';
    if (normalized === 'DONO_EMPRESA') return 'DONO_EMPRESA';
    return 'FUNCIONARIO_EMPRESA';
  }

  private async syncCompanyModulesBySistemaBaseId(
    tx: Prisma.TransactionClient,
    sistemaBaseId: string
  ) {
    const [companies, sistemaModulos] = await Promise.all([
      tx.company.findMany({
        where: { sistemaBaseId },
        select: { id: true }
      }),
      tx.sistemaBaseModulo.findMany({
        where: { sistemaBaseId },
        select: { moduloId: true }
      })
    ]);

    const companyIds = companies.map((company) => company.id);
    if (companyIds.length === 0) {
      return;
    }

    const moduloIds = Array.from(new Set(sistemaModulos.map((item) => item.moduloId)));

    if (moduloIds.length === 0) {
      await tx.companyModule.deleteMany({
        where: { companyId: { in: companyIds } }
      });
      return;
    }

    await tx.companyModule.deleteMany({
      where: {
        companyId: { in: companyIds },
        moduloId: { notIn: moduloIds }
      }
    });

    await tx.companyModule.createMany({
      data: companyIds.flatMap((companyId) =>
        moduloIds.map((moduloId) => ({
          companyId,
          moduloId,
          isActive: true
        }))
      ),
      skipDuplicates: true
    });
  }

  private async syncSingleCompanyModulesBySistemaBaseId(
    tx: Prisma.TransactionClient,
    companyId: string,
    sistemaBaseId: string | null
  ) {
    if (!sistemaBaseId) {
      await tx.companyModule.deleteMany({ where: { companyId } });
      return;
    }

    const sistemaModulos = await tx.sistemaBaseModulo.findMany({
      where: { sistemaBaseId },
      select: { moduloId: true }
    });

    const moduloIds = Array.from(new Set(sistemaModulos.map((item) => item.moduloId)));

    if (moduloIds.length === 0) {
      await tx.companyModule.deleteMany({ where: { companyId } });
      return;
    }

    await tx.companyModule.deleteMany({
      where: {
        companyId,
        moduloId: { notIn: moduloIds }
      }
    });

    await tx.companyModule.createMany({
      data: moduloIds.map((moduloId) => ({
        companyId,
        moduloId,
        isActive: true
      })),
      skipDuplicates: true
    });
  }

  async getDashboardMetrics() {
    const [activeCompanies, activeUsers, activeModules, totalMrr] = await Promise.all([
      prisma.company.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.modulo.count({ where: { status: 'active' } }),
      prisma.company.aggregate({
        where: { status: 'active' },
        _sum: { monthlyRevenue: true },
      }),
    ]);

    return {
      totalCompanies: activeCompanies,
      activeUsers,
      totalMRR: Number(totalMrr._sum.monthlyRevenue || 0),
      openTickets: 0,
      gatewaysActive: 0,
      modulesActive: activeModules,
    };
  }

  async listRecentActivity(limit = 10) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    });
  }

  async listModulos(onlyActive: boolean) {
    return prisma.modulo.findMany({
      where: onlyActive ? { status: 'active' } : undefined,
      orderBy: [{ isCore: 'desc' }, { nome: 'asc' }],
    });
  }

  async createModulo(data: {
    nome: string;
    descricao?: string;
    codigo: string;
    icone?: string;
    preco_mensal?: number;
    is_core?: boolean;
    status?: Status;
  }) {
    return prisma.modulo.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        codigo: data.codigo,
        icone: data.icone,
        precoMensal: data.preco_mensal || 0,
        isCore: data.is_core || false,
        status: data.status || 'active'
      }
    });
  }

  async updateModulo(moduloId: string, data: {
    nome?: string;
    descricao?: string;
    icone?: string;
    preco_mensal?: number;
    is_core?: boolean;
    status?: Status;
  }) {
    return prisma.modulo.update({
      where: { id: moduloId },
      data: {
        nome: data.nome,
        descricao: data.descricao,
        icone: data.icone,
        precoMensal: data.preco_mensal,
        isCore: data.is_core,
        status: data.status
      }
    });
  }

  async deleteModulo(moduloId: string) {
    return prisma.modulo.delete({ where: { id: moduloId } });
  }

  async listSistemasBase(onlyActive: boolean) {
    const sistemas = await prisma.sistemaBase.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        modulos: {
          include: { modulo: true }
        }
      }
    });

    return sistemas.map((sistema) => ({
      ...sistema,
      status: mapIsActiveToStatus(sistema.isActive),
      nicho: sistema.categoria || 'Generico',
      versao: '1.0.0'
    }));
  }

  async createSistemaBase(data: {
    nome: string;
    descricao?: string;
    categoria?: string;
    status?: SistemaStatusInput;
    icone?: string;
    modulosIds?: string[];
  }) {
    return prisma.sistemaBase.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        categoria: data.categoria,
        icone: data.icone,
        isActive: mapStatusToIsActive(data.status),
        modulos: {
          create: data.modulosIds?.map((modId) => ({
            modulo: { connect: { id: modId } },
            isMandatory: false
          })) || []
        }
      },
      include: { modulos: true }
    });
  }

  async updateSistemaBase(sistemaId: string, data: {
    nome?: string;
    descricao?: string;
    categoria?: string;
    status?: SistemaStatusInput;
    icone?: string;
  }) {
    return prisma.sistemaBase.update({
      where: { id: sistemaId },
      data: {
        nome: data.nome,
        descricao: data.descricao,
        categoria: data.categoria,
        icone: data.icone,
        isActive: data.status ? mapStatusToIsActive(data.status) : undefined
      }
    });
  }

  async deleteSistemaBase(sistemaId: string) {
    return prisma.sistemaBase.delete({ where: { id: sistemaId } });
  }

  async listSistemaBaseModulos(sistemaId: string) {
    return prisma.sistemaBaseModulo.findMany({
      where: { sistemaBaseId: sistemaId },
      include: { modulo: true },
      orderBy: [{ modulo: { nome: 'asc' } }]
    });
  }

  async replaceSistemaBaseModulos(
    sistemaId: string,
    modulos: Array<{ modulo_id: string; is_default?: boolean } | string>
  ) {
    const rawModuloIds = Array.from(
      new Set(
        modulos
          .map((item) => (typeof item === 'string' ? item : item?.modulo_id))
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      )
    );

    await prisma.$transaction(async (tx) => {
      const sistema = await tx.sistemaBase.findUnique({
        where: { id: sistemaId },
        select: { id: true }
      });

      if (!sistema) {
        throw new Error('Sistema base nao encontrado');
      }

      let moduloIds = rawModuloIds;
      if (rawModuloIds.length > 0) {
        const existingModulos = await tx.modulo.findMany({
          where: { id: { in: rawModuloIds } },
          select: { id: true }
        });
        const existingModuloIds = new Set(existingModulos.map((item) => item.id));
        moduloIds = rawModuloIds.filter((id) => existingModuloIds.has(id));
      }

      await tx.sistemaBaseModulo.deleteMany({ where: { sistemaBaseId: sistemaId } });

      if (moduloIds.length > 0) {
        await tx.sistemaBaseModulo.createMany({
          data: moduloIds.map((moduloId) => ({
            sistemaBaseId: sistemaId,
            moduloId,
            isMandatory: false
          })),
          skipDuplicates: true
        });
      }

      await this.syncCompanyModulesBySistemaBaseId(tx, sistemaId);
    });

    return this.listSistemaBaseModulos(sistemaId);
  }

  async listTenants() {
    return prisma.company.findMany({
      include: {
        sistemaBase: true,
        userRoles: {
          where: { role: 'DONO_EMPRESA' },
          include: { user: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateTenant(companyId: string, data: {
    name?: string;
    plan?: string;
    status?: Status;
    document?: string | null;
    sistema_base_id?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      if (typeof data.sistema_base_id === 'string' && data.sistema_base_id.trim().length > 0) {
        const sistema = await tx.sistemaBase.findUnique({
          where: { id: data.sistema_base_id },
          select: { id: true, isActive: true }
        });

        if (!sistema) {
          throw new Error('Sistema base nao encontrado');
        }

        if (!sistema.isActive) {
          throw new Error('Sistema base inativo');
        }
      }

      const updated = await tx.company.update({
        where: { id: companyId },
        data: {
          name: data.name,
          plan: data.plan,
          status: data.status,
          document: data.document,
          sistemaBaseId: data.sistema_base_id
        }
      });

      if (Object.prototype.hasOwnProperty.call(data, 'sistema_base_id')) {
        await this.syncSingleCompanyModulesBySistemaBaseId(tx, companyId, data.sistema_base_id ?? null);
      }

      return updated;
    });
  }

  async deleteTenant(companyId: string) {
    return prisma.company.delete({ where: { id: companyId } });
  }

  async listUsers() {
    return prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        roles: {
          include: {
            company: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  }

  async createUser(data: {
    name: string;
    email: string;
    password: string;
    role: string;
    company_id?: string | null;
  }) {
    const fullName = data.name?.trim();
    const email = data.email?.trim().toLowerCase();
    const password = data.password || '';
    const role = this.parseRole(data.role);
    const companyId = data.company_id?.trim() || null;

    if (!fullName || !email || !password) {
      throw new Error('Campos obrigatorios: name, email e password');
    }

    if (password.length < 6) {
      throw new Error('Senha deve ter ao menos 6 caracteres');
    }

    const requiresCompany = role === 'DONO_EMPRESA' || role === 'FUNCIONARIO_EMPRESA';
    if (requiresCompany && !companyId) {
      throw new Error('company_id e obrigatorio para perfis de empresa');
    }

    return prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new Error('Ja existe usuario com este e-mail');
      }

      if (requiresCompany && companyId) {
        const company = await tx.company.findUnique({
          where: { id: companyId },
          select: { id: true, status: true }
        });
        if (!company) throw new Error('Empresa nao encontrada');
        if (company.status !== 'active') throw new Error('Empresa inativa');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await tx.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          isActive: true
        }
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          role,
          companyId: requiresCompany ? companyId : null
        }
      });

      return tx.user.findUnique({
        where: { id: user.id },
        include: {
          roles: {
            include: {
              company: {
                select: { id: true, name: true }
              }
            }
          }
        }
      });
    });
  }

  async toggleUserStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true }
    });

    if (!user) {
      throw new Error('Usuario nao encontrado');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive }
    });
  }

  async changeUserRole(userId: string, data: { role: string; company_id?: string | null }) {
    const role = this.parseRole(data.role);
    const companyId = data.company_id?.trim() || null;
    const requiresCompany = role === 'DONO_EMPRESA' || role === 'FUNCIONARIO_EMPRESA';

    if (requiresCompany && !companyId) {
      throw new Error('company_id e obrigatorio para perfis de empresa');
    }

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      if (!user) throw new Error('Usuario nao encontrado');

      if (requiresCompany && companyId) {
        const company = await tx.company.findUnique({
          where: { id: companyId },
          select: { id: true, status: true }
        });
        if (!company) throw new Error('Empresa nao encontrada');
        if (company.status !== 'active') throw new Error('Empresa inativa');
      }

      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.create({
        data: {
          userId,
          role,
          companyId: requiresCompany ? companyId : null
        }
      });

      return tx.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              company: {
                select: { id: true, name: true }
              }
            }
          }
        }
      });
    });
  }
}
