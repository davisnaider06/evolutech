import { prisma } from '../db';
import { Prisma, Role, Status } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { decryptSecret, encryptSecret } from '../utils/crypto.util';

type SistemaStatusInput = 'active' | 'inactive' | 'pending';

const mapStatusToIsActive = (status?: SistemaStatusInput): boolean => status === 'active';
const mapIsActiveToStatus = (isActive: boolean): SistemaStatusInput => (isActive ? 'active' : 'inactive');

export class AdminService {
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

  async getTenantTheme(companyId: string) {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from company_themes
      where company_id = ${companyId}
      limit 1
    `;

    return rows[0] || null;
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
    const payload = {
      company_display_name: data.company_display_name ?? null,
      logo_path: data.logo_path ?? null,
      favicon_path: data.favicon_path ?? null,
      login_cover_path: data.login_cover_path ?? null,
      primary_color: data.primary_color ?? '217 91% 60%',
      primary_foreground: data.primary_foreground ?? '222 47% 6%',
      secondary_color: data.secondary_color ?? '217 33% 17%',
      secondary_foreground: data.secondary_foreground ?? '210 40% 98%',
      accent_color: data.accent_color ?? '187 85% 53%',
      accent_foreground: data.accent_foreground ?? '222 47% 6%',
      background_color: data.background_color ?? '222 47% 6%',
      foreground_color: data.foreground_color ?? '210 40% 98%',
      card_color: data.card_color ?? '222 47% 8%',
      card_foreground: data.card_foreground ?? '210 40% 98%',
      muted_color: data.muted_color ?? '217 33% 12%',
      muted_foreground: data.muted_foreground ?? '215 20% 55%',
      border_color: data.border_color ?? '217 33% 17%',
      destructive_color: data.destructive_color ?? '0 84% 60%',
      sidebar_background: data.sidebar_background ?? '222 47% 7%',
      sidebar_foreground: data.sidebar_foreground ?? '210 40% 98%',
      sidebar_primary: data.sidebar_primary ?? '217 91% 60%',
      sidebar_accent: data.sidebar_accent ?? '217 33% 17%',
      border_radius: data.border_radius ?? '0.75rem',
      font_family: data.font_family ?? 'Inter',
      dark_mode_enabled: data.dark_mode_enabled ?? true
    };

    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      insert into company_themes (
        company_id,
        company_display_name,
        logo_path,
        favicon_path,
        login_cover_path,
        primary_color,
        primary_foreground,
        secondary_color,
        secondary_foreground,
        accent_color,
        accent_foreground,
        background_color,
        foreground_color,
        card_color,
        card_foreground,
        muted_color,
        muted_foreground,
        border_color,
        destructive_color,
        sidebar_background,
        sidebar_foreground,
        sidebar_primary,
        sidebar_accent,
        border_radius,
        font_family,
        dark_mode_enabled
      )
      values (
        ${companyId},
        ${payload.company_display_name},
        ${payload.logo_path},
        ${payload.favicon_path},
        ${payload.login_cover_path},
        ${payload.primary_color},
        ${payload.primary_foreground},
        ${payload.secondary_color},
        ${payload.secondary_foreground},
        ${payload.accent_color},
        ${payload.accent_foreground},
        ${payload.background_color},
        ${payload.foreground_color},
        ${payload.card_color},
        ${payload.card_foreground},
        ${payload.muted_color},
        ${payload.muted_foreground},
        ${payload.border_color},
        ${payload.destructive_color},
        ${payload.sidebar_background},
        ${payload.sidebar_foreground},
        ${payload.sidebar_primary},
        ${payload.sidebar_accent},
        ${payload.border_radius},
        ${payload.font_family},
        ${payload.dark_mode_enabled}
      )
      on conflict (company_id) do update set
        company_display_name = excluded.company_display_name,
        logo_path = excluded.logo_path,
        favicon_path = excluded.favicon_path,
        login_cover_path = excluded.login_cover_path,
        primary_color = excluded.primary_color,
        primary_foreground = excluded.primary_foreground,
        secondary_color = excluded.secondary_color,
        secondary_foreground = excluded.secondary_foreground,
        accent_color = excluded.accent_color,
        accent_foreground = excluded.accent_foreground,
        background_color = excluded.background_color,
        foreground_color = excluded.foreground_color,
        card_color = excluded.card_color,
        card_foreground = excluded.card_foreground,
        muted_color = excluded.muted_color,
        muted_foreground = excluded.muted_foreground,
        border_color = excluded.border_color,
        destructive_color = excluded.destructive_color,
        sidebar_background = excluded.sidebar_background,
        sidebar_foreground = excluded.sidebar_foreground,
        sidebar_primary = excluded.sidebar_primary,
        sidebar_accent = excluded.sidebar_accent,
        border_radius = excluded.border_radius,
        font_family = excluded.font_family,
        dark_mode_enabled = excluded.dark_mode_enabled,
        updated_at = now()
      returning *
    `;

    return rows[0] || null;
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

      const passwordHash = await bcrypt.hash(password, 10);
      const existingUser = await tx.user.findUnique({ where: { email } });
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              fullName,
              passwordHash,
              isActive: true
            }
          })
        : await tx.user.create({
            data: {
              fullName,
              email,
              passwordHash,
              isActive: true
            }
          });

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
