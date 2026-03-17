import { prisma } from '../db';
import { Prisma, Role, Status } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { decryptSecret, encryptSecret } from '../utils/crypto.util';

type SistemaStatusInput = 'active' | 'inactive' | 'pending';

const mapStatusToIsActive = (status?: SistemaStatusInput): boolean => status === 'active';
const mapIsActiveToStatus = (isActive: boolean): SistemaStatusInput => (isActive ? 'active' : 'inactive');

export class AdminService {
  private normalizeScopedRoles(input?: unknown): Role[] {
    const validRoles: Role[] = ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'];
    const roles = Array.isArray(input)
      ? input.filter((item): item is Role => validRoles.includes(item as Role))
      : [];
    return roles.length > 0 ? Array.from(new Set(roles)) : ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'];
  }

  private async ensureCommissionStaffModule() {
    await prisma.modulo.upsert({
      where: { codigo: 'commissions_staff' },
      update: {
        nome: 'Comissões (Funcionário)',
        descricao: 'Consulta de comissões para funcionários',
        nicho: 'geral',
        status: 'active',
      },
      create: {
        nome: 'Comissões (Funcionário)',
        descricao: 'Consulta de comissões para funcionários',
        codigo: 'commissions_staff',
        icone: 'wallet',
        nicho: 'geral',
        precoMensal: 0,
        isCore: false,
        status: 'active',
      } as any,
    });

    await prisma.modulo.upsert({
      where: { codigo: 'permissions' },
      update: {
        nome: 'Permissoes de Equipe',
        descricao: 'Controle de permissoes dos funcionarios por modulo',
        nicho: 'geral',
        status: 'active',
        allowedRoles: ['DONO_EMPRESA'] as any,
      },
      create: {
        nome: 'Permissoes de Equipe',
        descricao: 'Controle de permissoes dos funcionarios por modulo',
        codigo: 'permissions',
        icone: 'shield',
        nicho: 'geral',
        precoMensal: 0,
        isCore: true,
        isPro: false,
        allowedRoles: ['DONO_EMPRESA'] as any,
        status: 'active',
      } as any,
    });

    await prisma.modulo.upsert({
      where: { codigo: 'collections' },
      update: {
        nome: 'Cobranca e Inadimplencia',
        descricao: 'Gestao de cobrancas e recuperacao',
        nicho: 'geral',
        status: 'active',
        isPro: true,
      },
      create: {
        nome: 'Cobranca e Inadimplencia',
        descricao: 'Gestao de cobrancas e recuperacao',
        codigo: 'collections',
        icone: 'wallet',
        nicho: 'geral',
        precoMensal: 59.9,
        isCore: false,
        isPro: true,
        status: 'active',
      } as any,
    });
  }

  private toNumber(value: unknown): number {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private monthKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }

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
          select: { moduloId: true, allowedRoles: true }
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

      for (const { moduloId, allowedRoles } of sistemaModulos) {
        for (const companyId of companyIds) {
          await tx.companyModule.upsert({
            where: {
              companyId_moduloId: {
                companyId,
                moduloId,
              },
            },
            update: {
              isActive: true,
              allowedRoles,
            },
            create: {
              companyId,
              moduloId,
              isActive: true,
              allowedRoles,
            },
          });
        }
      }
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
        select: { moduloId: true, allowedRoles: true }
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

      for (const { moduloId, allowedRoles } of sistemaModulos) {
        await tx.companyModule.upsert({
          where: {
            companyId_moduloId: {
              companyId,
              moduloId,
            },
          },
          update: {
            isActive: true,
            allowedRoles,
          },
          create: {
            companyId,
            moduloId,
            isActive: true,
            allowedRoles,
          },
        });
      }
    }

  async getDashboardMetrics() {
    const [activeCompanies, activeUsers, activeModules, totalMrr, openTickets] = await Promise.all([
      prisma.company.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.modulo.count({ where: { status: 'active' } }),
      prisma.company.aggregate({
        where: { status: 'active' },
        _sum: { monthlyRevenue: true },
      }),
      (prisma as any).supportTicket.count({
        where: { status: { in: ['aberto', 'em_andamento', 'aguardando_cliente'] } },
      }),
    ]);

    return {
      totalCompanies: activeCompanies,
      activeUsers,
      totalMRR: Number(totalMrr._sum.monthlyRevenue || 0),
      openTickets,
      gatewaysActive: 0,
      modulesActive: activeModules,
    };
  }

  async listSupportTickets(queryParams?: { status?: string; company_id?: string }) {
    const status = String(queryParams?.status || '').trim();
    const companyId = String(queryParams?.company_id || '').trim();
    const where: any = {};
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;

    const items = await (prisma as any).supportTicket.findMany({
      where,
      include: {
        company: { select: { id: true, name: true, slug: true } },
        createdByUser: { select: { id: true, fullName: true, email: true } },
        respondedByUser: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((item: any) => ({
      id: item.id,
      company_id: item.companyId,
      title: item.title,
      description: item.description,
      priority: item.priority,
      status: item.status,
      category: item.category,
      response: item.response,
      responded_at: item.respondedAt,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
      company: item.company ? { id: item.company.id, name: item.company.name, slug: item.company.slug } : null,
      created_by: item.createdByUser
        ? { id: item.createdByUser.id, name: item.createdByUser.fullName, email: item.createdByUser.email }
        : null,
      responded_by: item.respondedByUser
        ? { id: item.respondedByUser.id, name: item.respondedByUser.fullName, email: item.respondedByUser.email }
        : null,
    }));
  }

  async updateSupportTicketStatus(ticketId: string, status: string, actorUserId?: string) {
    const normalized = String(status || '').trim().toLowerCase();
    const allowed = ['aberto', 'em_andamento', 'aguardando_cliente', 'resolvido', 'fechado'];
    if (!allowed.includes(normalized)) {
      throw new Error('Status invalido para ticket');
    }

    const updated = await (prisma as any).supportTicket.update({
      where: { id: ticketId },
      data: {
        status: normalized,
        respondedByUserId: actorUserId || undefined,
        respondedAt: normalized === 'resolvido' || normalized === 'fechado' ? new Date() : undefined,
      },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        createdByUser: { select: { id: true, fullName: true, email: true } },
        respondedByUser: { select: { id: true, fullName: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: actorUserId || null,
        companyId: updated.companyId,
        action: 'SUPPORT_TICKET_STATUS_UPDATED',
        resource: 'support_tickets',
        details: {
          ticketId: updated.id,
          status: updated.status,
        },
      },
    });

    return updated;
  }

  async respondSupportTicket(ticketId: string, response: string, actorUserId?: string) {
    const normalizedResponse = String(response || '').trim();
    if (!normalizedResponse) throw new Error('Resposta obrigatoria');

    const updated = await (prisma as any).supportTicket.update({
      where: { id: ticketId },
      data: {
        response: normalizedResponse,
        status: 'resolvido',
        respondedByUserId: actorUserId || undefined,
        respondedAt: new Date(),
      },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        createdByUser: { select: { id: true, fullName: true, email: true } },
        respondedByUser: { select: { id: true, fullName: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: actorUserId || null,
        companyId: updated.companyId,
        action: 'SUPPORT_TICKET_RESPONDED',
        resource: 'support_tickets',
        details: {
          ticketId: updated.id,
          status: updated.status,
        },
      },
    });

    return updated;
  }

  async getFinancialOverview() {
    const [paidOrders, monthlyNewCustomers, activeUsersByCompany] = await Promise.all([
      prisma.order.findMany({
        where: { status: 'paid' },
        select: {
          companyId: true,
          total: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.customer.findMany({
        select: {
          companyId: true,
          createdAt: true,
        },
      }),
      prisma.userRole.groupBy({
        by: ['companyId'],
        where: {
          companyId: { not: null },
          role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
        },
        _count: { _all: true },
      }),
    ]);

    const customerMap = new Map<string, number>();
    for (const customer of monthlyNewCustomers) {
      const key = `${customer.companyId}:${this.monthKey(customer.createdAt)}`;
      customerMap.set(key, (customerMap.get(key) || 0) + 1);
    }

    const activeUsersMap = new Map<string, number>();
    for (const item of activeUsersByCompany) {
      if (item.companyId) {
        activeUsersMap.set(item.companyId, item._count._all);
      }
    }

    const metricMap = new Map<
      string,
      { companyId: string; month: Date; revenue: number; mrr: number }
    >();

    for (const order of paidOrders) {
      const monthStart = new Date(order.createdAt.getFullYear(), order.createdAt.getMonth(), 1);
      const key = `${order.companyId}:${this.monthKey(monthStart)}`;
      const current = metricMap.get(key);
      const amount = this.toNumber(order.total);

      if (current) {
        current.revenue += amount;
        current.mrr += amount;
      } else {
        metricMap.set(key, {
          companyId: order.companyId,
          month: monthStart,
          revenue: amount,
          mrr: amount,
        });
      }
    }

    const metricsRows = Array.from(metricMap.entries())
      .map(([key, value]) => ({
        id: key,
        company_id: value.companyId,
        month: value.month,
        revenue: value.revenue,
        mrr: value.mrr,
        churn_rate: 0,
        new_customers: customerMap.get(key) || 0,
        active_users: activeUsersMap.get(value.companyId) || 0,
        created_at: value.month,
      }))
      .sort((a, b) => a.month.getTime() - b.month.getTime());

    const companies = await prisma.company.findMany({
      where: { status: 'active' },
      orderBy: { monthlyRevenue: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        monthlyRevenue: true,
        logoUrl: true,
        sistemaBaseId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return {
      metrics: metricsRows.map((row) => ({
        id: row.id,
        company_id: row.company_id,
        month: row.month instanceof Date ? row.month.toISOString() : String(row.month),
        revenue: this.toNumber(row.revenue),
        mrr: this.toNumber(row.mrr),
        churn_rate: this.toNumber(row.churn_rate),
        new_customers: this.toNumber(row.new_customers),
        active_users: this.toNumber(row.active_users),
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
      })),
      companies: companies.map((company) => ({
        id: company.id,
        name: company.name,
        slug: company.slug,
        plan: company.plan,
        status: company.status,
        monthly_revenue: this.toNumber(company.monthlyRevenue),
        logo_url: company.logoUrl,
        sistema_base_id: company.sistemaBaseId,
        created_at: company.createdAt,
        updated_at: company.updatedAt
      }))
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
    await this.ensureCommissionStaffModule();
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
    nicho?: string;
    preco_mensal?: number;
    is_core?: boolean;
    is_pro?: boolean;
    allowed_roles?: Role[];
    status?: Status;
  }) {
    const allowedRoles =
      Array.isArray(data.allowed_roles) && data.allowed_roles.length > 0
        ? data.allowed_roles
        : ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'];

    return prisma.modulo.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        codigo: data.codigo,
        icone: data.icone,
        nicho: data.nicho || 'geral',
        precoMensal: data.preco_mensal || 0,
        isCore: data.is_core || false,
        isPro: data.is_pro === true,
        allowedRoles,
        status: data.status || 'active'
      } as any
    });
  }

  async listPaymentGateways() {
    const gateways = await (prisma as any).paymentGateway.findMany({
      include: {
        company: {
          select: { id: true, name: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return gateways.map((gateway: any) => ({
      id: gateway.id,
      empresa_id: gateway.companyId,
      provedor: gateway.provider,
      nome_exibicao: gateway.displayName,
      public_key: gateway.publicKey,
      secret_key_encrypted: gateway.secretKeyEncrypted ? decryptSecret(gateway.secretKeyEncrypted) : null,
      webhook_secret_encrypted: gateway.webhookSecretEncrypted
        ? decryptSecret(gateway.webhookSecretEncrypted)
        : null,
      ambiente: gateway.environment,
      is_active: gateway.isActive,
      webhook_url: gateway.webhookUrl,
      configuracoes: gateway.settings,
      created_at: gateway.createdAt,
      updated_at: gateway.updatedAt,
      company: gateway.company,
    }));
  }

  async createPaymentGateway(data: {
    empresa_id: string;
    provedor: string;
    nome_exibicao: string;
    public_key?: string | null;
    secret_key?: string | null;
    webhook_secret?: string | null;
    ambiente?: string;
    webhook_url?: string | null;
    configuracoes?: unknown;
    is_active?: boolean;
  }) {
    const companyId = String(data.empresa_id || '').trim();
    const provider = String(data.provedor || '').trim().toLowerCase();
    const displayName = String(data.nome_exibicao || '').trim();

    if (!companyId || !provider || !displayName) {
      throw new Error('Campos obrigatorios: empresa_id, provedor, nome_exibicao');
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, status: true },
    });
    if (!company) throw new Error('Empresa nao encontrada');

    return prisma.$transaction(async (tx) => {
      if (data.is_active === true) {
        await (tx as any).paymentGateway.updateMany({
          where: { companyId },
          data: { isActive: false },
        });
      }

      return (tx as any).paymentGateway.create({
        data: {
          companyId,
          provider,
          displayName,
          publicKey: data.public_key || null,
          secretKeyEncrypted: data.secret_key ? encryptSecret(data.secret_key) : null,
          webhookSecretEncrypted: data.webhook_secret ? encryptSecret(data.webhook_secret) : null,
          environment: String(data.ambiente || 'sandbox'),
          webhookUrl: data.webhook_url || null,
          settings: (data.configuracoes as any) ?? null,
          isActive: data.is_active === true,
        },
      });
    });
  }

  async updatePaymentGateway(
    gatewayId: string,
    data: {
      nome_exibicao?: string;
      public_key?: string | null;
      secret_key?: string | null;
      webhook_secret?: string | null;
      ambiente?: string;
      webhook_url?: string | null;
      configuracoes?: unknown;
      is_active?: boolean;
    }
  ) {
    const payload: any = {};
    if (typeof data.nome_exibicao === 'string') payload.displayName = data.nome_exibicao.trim();
    if (Object.prototype.hasOwnProperty.call(data, 'public_key')) payload.publicKey = data.public_key || null;
    if (typeof data.secret_key === 'string') payload.secretKeyEncrypted = encryptSecret(data.secret_key);
    if (typeof data.webhook_secret === 'string') {
      payload.webhookSecretEncrypted = encryptSecret(data.webhook_secret);
    }
    if (typeof data.ambiente === 'string') payload.environment = data.ambiente;
    if (Object.prototype.hasOwnProperty.call(data, 'webhook_url')) payload.webhookUrl = data.webhook_url || null;
    if (Object.prototype.hasOwnProperty.call(data, 'configuracoes')) payload.settings = data.configuracoes as any;
    if (typeof data.is_active === 'boolean') payload.isActive = data.is_active;

    return prisma.$transaction(async (tx) => {
      const existing = await (tx as any).paymentGateway.findUnique({
        where: { id: gatewayId },
        select: { companyId: true },
      });
      if (!existing) throw new Error('Gateway nao encontrado');

      if (payload.isActive === true) {
        await (tx as any).paymentGateway.updateMany({
          where: { companyId: existing.companyId },
          data: { isActive: false },
        });
      }

      return (tx as any).paymentGateway.update({
        where: { id: gatewayId },
        data: payload,
      });
    });
  }

  async deletePaymentGateway(gatewayId: string) {
    return (prisma as any).paymentGateway.delete({ where: { id: gatewayId } });
  }

  async updateModulo(moduloId: string, data: {
    nome?: string;
    descricao?: string;
    icone?: string;
    nicho?: string;
    preco_mensal?: number;
    is_core?: boolean;
    is_pro?: boolean;
    allowed_roles?: Role[];
    status?: Status;
  }) {
    const nextAllowedRoles =
      Array.isArray(data.allowed_roles) && data.allowed_roles.length > 0
        ? data.allowed_roles
        : data.allowed_roles === undefined
          ? undefined
          : ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'];

    return prisma.modulo.update({
      where: { id: moduloId },
      data: {
        nome: data.nome,
        descricao: data.descricao,
        icone: data.icone,
        nicho: data.nicho,
        precoMensal: data.preco_mensal,
        isCore: data.is_core,
        isPro: data.is_pro,
        allowedRoles: nextAllowedRoles,
        status: data.status
      } as any
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
      modulos: Array<{ modulo_id: string; is_default?: boolean; allowed_roles?: Role[] } | string>
    ) {
      const normalizedItems = Array.from(
        new Map(
          modulos
            .map((item) => {
              if (typeof item === 'string') {
                return [
                  item,
                  {
                    modulo_id: item,
                    allowed_roles: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] as Role[],
                  },
                ] as const;
              }
              const moduloId = String(item?.modulo_id || '').trim();
              if (!moduloId) return null;
              return [
                moduloId,
                {
                  modulo_id: moduloId,
                  allowed_roles: this.normalizeScopedRoles(item?.allowed_roles),
                },
              ] as const;
            })
            .filter((item): item is readonly [string, { modulo_id: string; allowed_roles: Role[] }] => Boolean(item))
        ).values()
      );

      const rawModuloIds = normalizedItems.map((item) => item.modulo_id);

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
            data: normalizedItems
              .filter((item) => moduloIds.includes(item.modulo_id))
              .map((item) => ({
                sistemaBaseId: sistemaId,
                moduloId: item.modulo_id,
                isMandatory: false,
                allowedRoles: item.allowed_roles,
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

  async getTenantTheme(companyId: string) {
    return prisma.companyTheme.findUnique({
      where: { companyId }
    });
  }

  async upsertTenantTheme(
    companyId: string,
    data: {
      company_display_name?: string | null;
      logo_path?: string | null;
      favicon_path?: string | null;
      login_cover_path?: string | null;
      primary_color?: string;
      primary_foreground?: string;
      secondary_color?: string;
      secondary_foreground?: string;
      accent_color?: string;
      accent_foreground?: string;
      background_color?: string;
      foreground_color?: string;
      card_color?: string;
      card_foreground?: string;
      muted_color?: string;
      muted_foreground?: string;
      border_color?: string;
      destructive_color?: string;
      sidebar_background?: string;
      sidebar_foreground?: string;
      sidebar_primary?: string;
      sidebar_accent?: string;
      border_radius?: string;
      font_family?: string;
      dark_mode_enabled?: boolean;
    }
  ) {
    const payload: Prisma.CompanyThemeUncheckedCreateInput = {
      companyId,
      companyDisplayName: data.company_display_name ?? null,
      logoPath: data.logo_path ?? null,
      faviconPath: data.favicon_path ?? null,
      loginCoverPath: data.login_cover_path ?? null,
      primaryColor: data.primary_color ?? '217 91% 60%',
      primaryForeground: data.primary_foreground ?? '222 47% 6%',
      secondaryColor: data.secondary_color ?? '217 33% 17%',
      secondaryForeground: data.secondary_foreground ?? '210 40% 98%',
      accentColor: data.accent_color ?? '187 85% 53%',
      accentForeground: data.accent_foreground ?? '222 47% 6%',
      backgroundColor: data.background_color ?? '222 47% 6%',
      foregroundColor: data.foreground_color ?? '210 40% 98%',
      cardColor: data.card_color ?? '222 47% 8%',
      cardForeground: data.card_foreground ?? '210 40% 98%',
      mutedColor: data.muted_color ?? '217 33% 12%',
      mutedForeground: data.muted_foreground ?? '215 20% 55%',
      borderColor: data.border_color ?? '217 33% 17%',
      destructiveColor: data.destructive_color ?? '0 84% 60%',
      sidebarBackground: data.sidebar_background ?? '222 47% 7%',
      sidebarForeground: data.sidebar_foreground ?? '210 40% 98%',
      sidebarPrimary: data.sidebar_primary ?? '217 91% 60%',
      sidebarAccent: data.sidebar_accent ?? '217 33% 17%',
      borderRadius: data.border_radius ?? '0.75rem',
      fontFamily: data.font_family ?? 'Inter',
      darkModeEnabled: data.dark_mode_enabled ?? true
    };

    return prisma.companyTheme.upsert({
      where: { companyId },
      create: payload,
      update: payload
    });
  }

  async updateTenant(companyId: string, data: {
    name?: string;
    plan?: string;
    status?: Status;
    document?: string | null;
    logo_url?: string | null;
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
          logoUrl: Object.prototype.hasOwnProperty.call(data, 'logo_url')
            ? (data.logo_url || null)
            : undefined,
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
      if (requiresCompany && companyId) {
        const company = await tx.company.findUnique({
          where: { id: companyId },
          select: { id: true, status: true }
        });
        if (!company) throw new Error('Empresa nao encontrada');
        if (company.status !== 'active') throw new Error('Empresa inativa');
      }

      const existingUser = await tx.user.findUnique({ where: { email } });
      const existingRoles = existingUser
        ? await tx.userRole.findMany({
            where: { userId: existingUser.id },
            select: { id: true, role: true, companyId: true },
          })
        : [];

      if (existingRoles.length > 0) {
        throw new Error('Ja existe um usuario com este e-mail. Altere o perfil do usuario existente.');
      }

      const user = existingUser
        ? existingUser
        : await tx.user.create({
            data: {
              fullName,
              email,
              passwordHash: await bcrypt.hash(password, 10),
              isActive: true
            }
          });

      if (existingUser && !existingUser.isActive) {
        throw new Error('Ja existe um usuario com este e-mail, mas ele esta inativo');
      }

      if (existingUser && !existingUser.passwordHash) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash: await bcrypt.hash(password, 10),
          },
        });
      }

      const existingRole = await tx.userRole.findFirst({
        where: {
          userId: user.id,
          companyId: requiresCompany ? companyId : null
        },
        select: { id: true }
      });

      if (existingRole) {
        throw new Error('Este usuario ja possui acesso neste escopo');
      }

      await tx.userRole.create({
        data: {
          userId: user.id,
          role,
          companyId: requiresCompany ? companyId : null
        }
      });

      if (role === 'DONO_EMPRESA' && companyId) {
        await tx.userRole.deleteMany({
          where: {
            companyId,
            role: 'DONO_EMPRESA',
            userId: { not: user.id },
          },
        });
      }

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
          companyId: requiresCompany ? companyId : null,
        },
      });

      if (role === 'DONO_EMPRESA' && companyId) {
        await tx.userRole.deleteMany({
          where: {
            companyId,
            role: 'DONO_EMPRESA',
            userId: { not: userId },
          },
        });
      }

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
