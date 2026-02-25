import { prisma } from '../db';
import { AuthenticatedUser } from '../types';
import { TABLE_CONFIG } from '../config/tableConfig';
import bcrypt from 'bcryptjs';
import { TaskStatus } from '@prisma/client';
import { PaymentService } from './payment.service';
import { decryptSecret, encryptSecret } from '../utils/crypto.util';

class CompanyServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'CompanyServiceError';
    this.statusCode = statusCode;
  }
}

export class CompanyService {
  private paymentService = new PaymentService();
  private moduleAccessCache = new Map<string, { allowed: boolean; expiresAt: number }>();
  private moduleAccessCacheTtlMs = Number(process.env.MODULE_ACCESS_CACHE_TTL_MS || 30000);
  private appointmentStatuses = new Set([
    'pendente',
    'confirmado',
    'cancelado',
    'concluido',
    'no_show',
  ]);
  private ownerDefaultModuleAliases = new Set([
    'dashboard',
    'reports',
    'relatorios',
    'finance',
    'financeiro',
    'financial',
    'users',
    'equipe',
    'funcionarios',
    'team',
    'gateway',
    'gateways',
    'commissions_owner',
    'comissoes_dono',
  ]);

  private toNumber(value: unknown): number {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private getModuleCacheKey(companyId: string, moduleCodes: string[]) {
    const normalized = moduleCodes
      .map((code) => String(code || '').trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join('|');
    return `${companyId}:${normalized}`;
  }

  private getCachedModuleAccess(companyId: string, moduleCodes: string[]) {
    const key = this.getModuleCacheKey(companyId, moduleCodes);
    const cached = this.moduleAccessCache.get(key);
    if (!cached) return null;
    if (cached.expiresAt < Date.now()) {
      this.moduleAccessCache.delete(key);
      return null;
    }
    return cached.allowed;
  }

  private setCachedModuleAccess(companyId: string, moduleCodes: string[], allowed: boolean) {
    const key = this.getModuleCacheKey(companyId, moduleCodes);
    this.moduleAccessCache.set(key, {
      allowed,
      expiresAt: Date.now() + this.moduleAccessCacheTtlMs,
    });
  }

  private getMonthBounds(referenceDate: Date) {
    const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
    return { start, end };
  }

  private monthKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }

  private async syncCompanyMonthlyRevenue(
    tx: any,
    companyId: string,
    referenceDate: Date
  ) {
    const { start, end } = this.getMonthBounds(referenceDate);

    const agg = await tx.order.aggregate({
      where: {
        companyId,
        status: 'paid',
        createdAt: { gte: start, lt: end },
      },
      _sum: { total: true },
    });

    await tx.company.update({
      where: { id: companyId },
      data: { monthlyRevenue: Number(agg._sum.total || 0) },
    });
  }

  private getModel(tableName: string) {
    const map: Record<string, any> = {
      customers: prisma.customer,
      products: prisma.product,
      appointments: prisma.appointment,
      appointment_services: (prisma as any).appointmentService,
      appointment_availability: (prisma as any).appointmentAvailability,
      orders: prisma.order,
    };
    return map[tableName];
  }

  private timeStringToMinutes(value: string) {
    const [h, m] = String(value || '').split(':').map((v) => Number(v));
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      throw new CompanyServiceError('Horario invalido. Use HH:mm', 400);
    }
    return h * 60 + m;
  }

  private minutesToTimeString(value: number) {
    const h = Math.floor(value / 60);
    const m = value % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private normalizeAppointmentStatus(input?: string, fallback = 'pendente') {
    const raw = String(input || '')
      .trim()
      .toLowerCase();

    const aliasMap: Record<string, string> = {
      scheduled: 'pendente',
      agendado: 'pendente',
      pending: 'pendente',
      confirmed: 'confirmado',
      canceled: 'cancelado',
      cancelled: 'cancelado',
      completed: 'concluido',
      done: 'concluido',
      'no-show': 'no_show',
      noshow: 'no_show',
      missed: 'no_show',
    };

    const normalized = aliasMap[raw] || raw || fallback;
    if (!this.appointmentStatuses.has(normalized)) {
      throw new CompanyServiceError(
        'Status de agendamento invalido. Use: pendente, confirmado, cancelado, concluido ou no_show',
        400
      );
    }

    return normalized;
  }

  private isAdminRole(role: AuthenticatedUser['role']) {
    return role === 'SUPER_ADMIN_EVOLUTECH' || role === 'ADMIN_EVOLUTECH';
  }

  private ensureOwnerCompanyRole(user: AuthenticatedUser) {
    if (user.role !== 'DONO_EMPRESA') {
      throw new CompanyServiceError('Apenas DONO_EMPRESA pode executar esta acao', 403);
    }
  }

  private normalizeCommissionPayoutStatus(input?: string) {
    const value = String(input || '').trim().toLowerCase();
    if (value === 'paid' || value === 'pago') return 'paid';
    if (value === 'pending' || value === 'pendente' || !value) return 'pending';
    throw new CompanyServiceError('status invalido. Use pending ou paid', 400);
  }

  private checkAccess(user: AuthenticatedUser, companyId: string) {
    if (this.isAdminRole(user.role)) return true;
    return user.companyId === companyId;
  }

  private resolveCompanyId(user: AuthenticatedUser, queryOrBody: any) {
    const companyId = this.isAdminRole(user.role)
      ? (queryOrBody.company_id || queryOrBody.companyId || user.companyId)
      : user.companyId;

    if (!companyId) throw new CompanyServiceError('Company ID obrigatório', 400);
    if (!this.checkAccess(user, companyId)) throw new CompanyServiceError('Acesso negado', 403);

    return companyId;
  }

  private async validateModuleAccess(table: string, user: AuthenticatedUser, companyId: string) {
    if (this.isAdminRole(user.role)) return;

    const config = TABLE_CONFIG[table];
    const moduleCodes = config?.moduleCodes || [];
    if (moduleCodes.length === 0) return;
    if (this.hasOwnerDefaultAccess(user, moduleCodes)) return;
    const cached = this.getCachedModuleAccess(companyId, moduleCodes);
    if (cached === true) return;

    const hasModule = await prisma.companyModule.findFirst({
      where: {
        companyId,
        isActive: true,
        modulo: {
          status: 'active',
          codigo: { in: moduleCodes },
        },
      },
      select: { id: true },
    });

    if (!hasModule) {
      this.setCachedModuleAccess(companyId, moduleCodes, false);
      throw new CompanyServiceError(
        `Módulo "${moduleCodes[0]}" não está ativo para esta empresa`,
        403
      );
    }
    this.setCachedModuleAccess(companyId, moduleCodes, true);
  }

  async listTableData(table: string, user: AuthenticatedUser, queryParams: any) {
    const model = this.getModel(table);
    const config = TABLE_CONFIG[table];
    if (!model || !config) throw new CompanyServiceError('Tabela não suportada ou não configurada', 400);

    const companyId = this.resolveCompanyId(user, queryParams);
    await this.validateModuleAccess(table, user, companyId);

    const page = Number(queryParams.page || 1);
    const pageSize = Number(queryParams.pageSize || 10);
    const search = (queryParams.search as string)?.trim();
    const orderBy = config.allowedOrderBy.includes(queryParams.orderBy)
      ? queryParams.orderBy
      : config.defaultOrderBy;
    const orderDirection = queryParams.orderDirection === 'asc' ? 'asc' : 'desc';

    const where: any = { companyId };
    if (table === 'appointments' && user.role === 'FUNCIONARIO_EMPRESA') {
      where.professionalId = user.id;
    }

    if (search && config.searchFields.length > 0) {
      where.OR = config.searchFields.map((field) => ({
        [field]: { contains: search, mode: 'insensitive' },
      }));
    }

    if (queryParams.is_active !== undefined) {
      where.isActive = String(queryParams.is_active) === 'true';
    }

    if (queryParams.status) {
      where.status =
        table === 'appointments'
          ? this.normalizeAppointmentStatus(String(queryParams.status))
          : queryParams.status;
    }

    if (queryParams.dateFrom || queryParams.dateTo) {
      where[config.dateField] = {};
      if (queryParams.dateFrom) where[config.dateField].gte = new Date(queryParams.dateFrom);
      if (queryParams.dateTo) where[config.dateField].lte = new Date(queryParams.dateTo);
    }

    const [data, total] = await Promise.all([
      model.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { [orderBy]: orderDirection },
      }),
      model.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async createRecord(table: string, user: AuthenticatedUser, data: any) {
    const model = this.getModel(table);
    if (!model) throw new CompanyServiceError('Tabela não suportada', 400);

    const companyId = this.resolveCompanyId(user, data);
    await this.validateModuleAccess(table, user, companyId);

    const payload = { ...data };
    delete payload.id;
    delete payload.company_id;
    delete payload.companyId;
    payload.companyId = companyId;
    if (table === 'appointments') {
      payload.status = this.normalizeAppointmentStatus(payload.status, 'pendente');
      if (user.role === 'FUNCIONARIO_EMPRESA') {
        payload.professionalId = user.id;
        payload.professionalName = user.fullName;
      }
    }

    return model.create({ data: payload });
  }

  async updateRecord(table: string, id: string, user: AuthenticatedUser, data: any) {
    const model = this.getModel(table);
    if (!model) throw new CompanyServiceError('Tabela não suportada', 400);

    const existing = await model.findUnique({
      where: { id },
      select: {
        companyId: true,
        ...(table === 'appointments' ? { professionalId: true } : {}),
      },
    });
    if (!existing) throw new CompanyServiceError('Registro não encontrado', 404);
    if (!this.checkAccess(user, existing.companyId)) throw new CompanyServiceError('Acesso negado', 403);

    if (
      table === 'appointments' &&
      user.role === 'FUNCIONARIO_EMPRESA' &&
      String((existing as any).professionalId || '') !== user.id
    ) {
      throw new CompanyServiceError('Acesso negado ao agendamento de outro profissional', 403);
    }

    await this.validateModuleAccess(table, user, existing.companyId);

    const payload = { ...data };
    delete payload.id;
    delete payload.companyId;
    delete payload.company_id;
    const targetType = String(payload.type || '').trim().toLowerCase();
    if (table === 'appointments' && payload.status !== undefined) {
      payload.status = this.normalizeAppointmentStatus(payload.status);
    }
    if (table === 'appointments' && user.role === 'FUNCIONARIO_EMPRESA') {
      payload.professionalId = user.id;
      payload.professionalName = user.fullName;
    }
    if (table === 'products' && targetType === 'service') {
      return prisma.$transaction(async (tx) => {
        const current = await tx.product.findUnique({ where: { id } });
        if (!current) throw new CompanyServiceError('Registro não encontrado', 404);

        const createdService = await (tx as any).appointmentService.create({
          data: {
            companyId: current.companyId,
            name: String(payload.name || current.name).trim(),
            description: payload.sku ? String(payload.sku).trim() : current.sku,
            durationMinutes: Math.max(1, Number(payload.stockQuantity || 30)),
            price: Number(payload.price ?? current.price ?? 0),
            isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : current.isActive,
          },
        });

        await tx.product.delete({ where: { id } });
        return createdService;
      });
    }

    if (table === 'appointment_services' && targetType === 'product') {
      return prisma.$transaction(async (tx) => {
        const current = await (tx as any).appointmentService.findUnique({ where: { id } });
        if (!current) throw new CompanyServiceError('Registro não encontrado', 404);

        const createdProduct = await tx.product.create({
          data: {
            companyId: current.companyId,
            name: String(payload.name || current.name).trim(),
            sku: payload.sku ? String(payload.sku).trim() : null,
            price: Number(payload.price ?? current.price ?? 0),
            stockQuantity: Math.max(0, Number(payload.stockQuantity || 0)),
            isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : current.isActive,
          },
        });

        await (tx as any).appointmentService.delete({ where: { id } });
        return createdProduct;
      });
    }

    delete payload.type;

    return model.update({
      where: { id },
      data: payload,
    });
  }

  async deleteRecord(table: string, id: string, user: AuthenticatedUser) {
    const model = this.getModel(table);
    if (!model) throw new CompanyServiceError('Tabela não suportada', 400);

    const existing = await model.findUnique({
      where: { id },
      select: {
        companyId: true,
        ...(table === 'appointments' ? { professionalId: true } : {}),
      },
    });
    if (!existing) throw new CompanyServiceError('Registro não encontrado', 404);
    if (!this.checkAccess(user, existing.companyId)) throw new CompanyServiceError('Acesso negado', 403);

    if (
      table === 'appointments' &&
      user.role === 'FUNCIONARIO_EMPRESA' &&
      String((existing as any).professionalId || '') !== user.id
    ) {
      throw new CompanyServiceError('Acesso negado ao agendamento de outro profissional', 403);
    }

    await this.validateModuleAccess(table, user, existing.companyId);

    await model.delete({ where: { id } });
    return { success: true };
  }

  async listAppointmentAvailability(
    user: AuthenticatedUser,
    queryParams: { professional_id?: string; company_id?: string }
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['appointments', 'agendamentos']);

    const requestedProfessionalId = String(queryParams.professional_id || '').trim();
    const professionalId =
      user.role === 'FUNCIONARIO_EMPRESA' ? user.id : requestedProfessionalId || undefined;

    const where: any = { companyId };
    if (professionalId) where.professionalId = professionalId;

    const rows = await (prisma as any).appointmentAvailability.findMany({
      where,
      orderBy: [{ professionalId: 'asc' }, { weekday: 'asc' }, { startTime: 'asc' }],
    });

    return rows.map((item: any) => ({
      id: item.id,
      company_id: item.companyId,
      professional_id: item.professionalId,
      weekday: item.weekday,
      start_time: item.startTime,
      end_time: item.endTime,
      is_active: item.isActive,
    }));
  }

  async saveAppointmentAvailability(
    user: AuthenticatedUser,
    professionalIdParam: string,
    payload: {
      company_id?: string;
      days: Array<{
        weekday: number;
        start_time: string;
        end_time: string;
        is_active?: boolean;
      }>;
    }
  ) {
    const companyId = this.resolveCompanyId(user, payload);
    await this.ensureAnyModuleAccess(user, companyId, ['appointments', 'agendamentos']);

    const professionalIdRaw = String(professionalIdParam || '').trim();
    const professionalId = user.role === 'FUNCIONARIO_EMPRESA' ? user.id : professionalIdRaw;
    if (!professionalId) throw new CompanyServiceError('professional_id obrigatorio', 400);

    const days = Array.isArray(payload.days) ? payload.days : [];
    if (days.length === 0) {
      throw new CompanyServiceError('Envie ao menos um horario no campo days', 400);
    }

    const professional = await prisma.userRole.findFirst({
      where: {
        companyId,
        userId: professionalId,
        role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
      },
      select: { id: true },
    });
    if (!professional) {
      throw new CompanyServiceError('Profissional nao encontrado nesta empresa', 404);
    }

    const normalized = days.map((item) => {
      const weekday = Number(item.weekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        throw new CompanyServiceError('weekday deve ser entre 0 (domingo) e 6 (sabado)', 400);
      }

      const startTime = String(item.start_time || '').trim();
      const endTime = String(item.end_time || '').trim();
      const startMin = this.timeStringToMinutes(startTime);
      const endMin = this.timeStringToMinutes(endTime);
      if (endMin <= startMin) {
        throw new CompanyServiceError('end_time deve ser maior que start_time', 400);
      }

      return {
        weekday,
        startTime,
        endTime,
        isActive: item.is_active !== false,
      };
    });

    await prisma.$transaction(async (tx) => {
      await (tx as any).appointmentAvailability.deleteMany({
        where: { companyId, professionalId },
      });

      await (tx as any).appointmentAvailability.createMany({
        data: normalized.map((item) => ({
          companyId,
          professionalId,
          weekday: item.weekday,
          startTime: item.startTime,
          endTime: item.endTime,
          isActive: item.isActive,
        })),
      });
    });

    return this.listAppointmentAvailability(user, { company_id: companyId, professional_id: professionalId });
  }

  private async ensureAnyModuleAccess(user: AuthenticatedUser, companyId: string, moduleCodes: string[]) {
    if (this.isAdminRole(user.role)) return;
    if (this.hasOwnerDefaultAccess(user, moduleCodes)) return;
    const cached = this.getCachedModuleAccess(companyId, moduleCodes);
    if (cached === true) return;

    const hasModule = await prisma.companyModule.findFirst({
      where: {
        companyId,
        isActive: true,
        modulo: {
          status: 'active',
          codigo: { in: moduleCodes },
        },
      },
      select: { id: true },
    });

    if (!hasModule) {
      this.setCachedModuleAccess(companyId, moduleCodes, false);
      throw new CompanyServiceError(`Modulo "${moduleCodes[0]}" nao esta ativo para esta empresa`, 403);
    }
    this.setCachedModuleAccess(companyId, moduleCodes, true);
  }

  private hasOwnerDefaultAccess(user: AuthenticatedUser, moduleCodes: string[]) {
    if (user.role !== 'DONO_EMPRESA') return false;
    return moduleCodes.some((code) =>
      this.ownerDefaultModuleAliases.has(String(code || '').trim().toLowerCase())
    );
  }

  async listPdvProducts(user: AuthenticatedUser, queryParams: any) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['pdv', 'orders', 'pedidos']);

    const search = String(queryParams.search || '').trim();
    const [products, services] = await Promise.all([
      prisma.product.findMany({
        where: {
          companyId,
          isActive: true,
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { sku: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          stockQuantity: true,
        },
        take: 200,
      }),
      (prisma as any).appointmentService.findMany({
        where: {
          companyId,
          isActive: true,
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { description: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          price: true,
          durationMinutes: true,
        },
        take: 200,
      }),
    ]);

    return [
      ...products.map((item) => ({
        id: item.id,
        type: 'product',
        name: item.name,
        sku: item.sku,
        price: Number(item.price || 0),
        stockQuantity: item.stockQuantity,
        durationMinutes: null,
      })),
      ...services.map((item: any) => ({
        id: item.id,
        type: 'service',
        name: item.name,
        sku: null,
        price: Number(item.price || 0),
        stockQuantity: null,
        durationMinutes: Number(item.durationMinutes || 0),
      })),
    ];
  }

  private parseDateRange(
    queryParams: { dateFrom?: string; dateTo?: string } | undefined,
    fallbackDays = 30
  ) {
    const parseLocalDate = (raw: string) => {
      const value = String(raw || '').trim();
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return new Date(NaN);
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    };

    const now = new Date();
    const rawFrom = String(queryParams?.dateFrom || '').trim();
    const rawTo = String(queryParams?.dateTo || '').trim();

    const end = rawTo ? parseLocalDate(rawTo) : new Date(now);
    if (Number.isNaN(end.getTime())) {
      throw new CompanyServiceError('dateTo invalida', 400);
    }
    end.setHours(23, 59, 59, 999);

    const start = rawFrom ? parseLocalDate(rawFrom) : new Date(end);
    if (Number.isNaN(start.getTime())) {
      throw new CompanyServiceError('dateFrom invalida', 400);
    }
    if (!rawFrom) {
      start.setDate(start.getDate() - fallbackDays);
    }
    start.setHours(0, 0, 0, 0);

    if (start > end) {
      throw new CompanyServiceError('dateFrom nao pode ser maior que dateTo', 400);
    }

    return { start, end };
  }

  private parseMonthRef(monthRaw?: string) {
    const input = String(monthRaw || '').trim();
    const now = new Date();

    if (!input) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
      return {
        month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        start,
        end,
      };
    }

    const match = input.match(/^(\d{4})-(\d{2})$/);
    if (!match) throw new CompanyServiceError('month invalido. Use YYYY-MM', 400);

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new CompanyServiceError('month invalido. Use YYYY-MM', 400);
    }

    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0, 0);
    return { month: `${year}-${String(month).padStart(2, '0')}`, start, end };
  }

  async getReportsOverview(
    user: AuthenticatedUser,
    queryParams: { dateFrom?: string; dateTo?: string; company_id?: string; companyId?: string } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['relatorios', 'reports']);
    const { start, end } = this.parseDateRange(queryParams, 30);

    const [customersTotal, productsTotal, customersInRangeCount, ordersInRange, appointmentsGroupedByStatus, pdvLogs] =
      await Promise.all([
        prisma.customer.count({ where: { companyId } }),
        prisma.product.count({ where: { companyId, isActive: true } }),
        prisma.customer.count({
          where: { companyId, createdAt: { gte: start, lte: end } },
        }),
        prisma.order.findMany({
          where: { companyId, createdAt: { gte: start, lte: end } },
          select: { id: true, status: true, total: true, createdAt: true },
        }),
        (prisma as any).appointment.groupBy({
          by: ['status'],
          where: { companyId, createdAt: { gte: start, lte: end } },
          _count: { _all: true },
        }),
        prisma.auditLog.findMany({
          where: {
            companyId,
            action: 'PDV_CHECKOUT',
            createdAt: { gte: start, lte: end },
          },
          select: { details: true },
        }),
      ]);

    const paidOrders = ordersInRange.filter((order) => String(order.status).toLowerCase() === 'paid');
    const totalRevenue = paidOrders.reduce((sum, order) => sum + this.toNumber(order.total), 0);

    const ordersByStatusMap = new Map<string, number>();
    for (const order of ordersInRange) {
      const key = String(order.status || 'unknown').toLowerCase();
      ordersByStatusMap.set(key, (ordersByStatusMap.get(key) || 0) + 1);
    }

    const appointmentsByStatusMap = new Map<string, number>(
      (appointmentsGroupedByStatus as any[]).map((item: any) => [
        String(item.status || 'unknown').toLowerCase(),
        Number(item?._count?._all || 0),
      ])
    );
    const appointmentsTotal = Array.from(appointmentsByStatusMap.values()).reduce((sum, value) => sum + value, 0);

    const dayMap = new Map<string, number>();
    const dayCursor = new Date(start);
    while (dayCursor <= end) {
      const key = dayCursor.toISOString().slice(0, 10);
      dayMap.set(key, 0);
      dayCursor.setDate(dayCursor.getDate() + 1);
    }
    for (const order of paidOrders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      dayMap.set(key, (dayMap.get(key) || 0) + this.toNumber(order.total));
    }

    const topItemsMap = new Map<
      string,
      { itemType: 'product' | 'service'; itemName: string; quantity: number; revenue: number }
    >();
    for (const log of pdvLogs) {
      const details = (log.details || {}) as any;
      const items = Array.isArray(details.items) ? details.items : [];
      for (const item of items) {
        const itemType = item?.itemType === 'service' ? 'service' : 'product';
        const itemName = String(item?.itemName || '').trim();
        if (!itemName) continue;
        const quantity = Number(item?.quantity || 0);
        const revenue = Number(item?.lineTotal || 0);
        const key = `${itemType}:${itemName}`;
        const current = topItemsMap.get(key);
        if (current) {
          current.quantity += quantity;
          current.revenue += revenue;
        } else {
          topItemsMap.set(key, { itemType, itemName, quantity, revenue });
        }
      }
    }

    const topItems = Array.from(topItemsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      period: {
        date_from: start.toISOString(),
        date_to: end.toISOString(),
      },
      summary: {
        customers_total: customersTotal,
        products_total: productsTotal,
        new_customers: customersInRangeCount,
        orders_total: ordersInRange.length,
        paid_orders: paidOrders.length,
        appointments_total: appointmentsTotal,
        revenue_total: totalRevenue,
      },
      charts: {
        revenue_by_day: Array.from(dayMap.entries()).map(([date, revenue]) => ({ date, revenue })),
        orders_by_status: Array.from(ordersByStatusMap.entries()).map(([status, value]) => ({ status, value })),
        appointments_by_status: Array.from(appointmentsByStatusMap.entries()).map(([status, value]) => ({
          status,
          value,
        })),
        top_items: topItems,
      },
    };
  }

  async listCommissionProfiles(user: AuthenticatedUser) {
    const companyId = this.resolveCompanyId(user, {});
    await this.ensureAnyModuleAccess(user, companyId, [
      'commissions_owner',
      'comissoes_dono',
      'commissions_staff',
      'commissions',
      'comissoes',
    ]);

    const professionalFilter =
      user.role === 'FUNCIONARIO_EMPRESA' ? { userId: user.id } : {};

    const [professionals, profiles] = await Promise.all([
      prisma.userRole.findMany({
        where: {
          companyId,
          ...professionalFilter,
          role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
          user: { isActive: true },
        },
        select: {
          userId: true,
          role: true,
          user: { select: { fullName: true, email: true, isActive: true } },
        },
        orderBy: { user: { fullName: 'asc' } },
      }),
      (prisma as any).commissionProfile.findMany({
        where: { companyId },
        select: {
          id: true,
          professionalId: true,
          serviceCommissionPct: true,
          productCommissionPct: true,
          monthlyFixedAmount: true,
          isActive: true,
          updatedAt: true,
        },
      }),
    ]);

    const profileMap = new Map<string, any>(profiles.map((item: any) => [item.professionalId, item]));

    return professionals.map((item) => {
      const profile = profileMap.get(item.userId);
      return {
        professional_id: item.userId,
        professional_name: item.user.fullName,
        professional_email: item.user.email,
        role: item.role,
        is_active: item.user.isActive,
        profile_id: profile?.id || null,
        service_commission_pct: Number(profile?.serviceCommissionPct ?? 40),
        product_commission_pct: Number(profile?.productCommissionPct ?? 10),
        monthly_fixed_amount: Number(profile?.monthlyFixedAmount ?? 0),
        commission_profile_active: profile?.isActive !== false,
        updated_at: profile?.updatedAt || null,
      };
    });
  }

  async upsertCommissionProfile(
    user: AuthenticatedUser,
    professionalId: string,
    payload: {
      service_commission_pct?: number;
      product_commission_pct?: number;
      monthly_fixed_amount?: number;
      is_active?: boolean;
      company_id?: string;
    }
  ) {
    this.ensureOwnerCompanyRole(user);
    const companyId = this.resolveCompanyId(user, payload);
    await this.ensureAnyModuleAccess(user, companyId, ['commissions_owner', 'comissoes_dono']);

    const professional = await prisma.userRole.findFirst({
      where: {
        companyId,
        userId: professionalId,
        role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
        user: { isActive: true },
      },
      select: { userId: true },
    });
    if (!professional) throw new CompanyServiceError('Profissional nao encontrado na empresa', 404);

    const serviceCommissionPct = Number(payload.service_commission_pct ?? 40);
    const productCommissionPct = Number(payload.product_commission_pct ?? 10);
    const monthlyFixedAmount = Number(payload.monthly_fixed_amount ?? 0);
    const isActive = payload.is_active !== false;

    if (serviceCommissionPct < 0 || serviceCommissionPct > 100) {
      throw new CompanyServiceError('service_commission_pct deve estar entre 0 e 100', 400);
    }
    if (productCommissionPct < 0 || productCommissionPct > 100) {
      throw new CompanyServiceError('product_commission_pct deve estar entre 0 e 100', 400);
    }

    const saved = await prisma.$transaction(async (tx) => {
      const existing = await (tx as any).commissionProfile.findFirst({
        where: { companyId, professionalId },
        select: { id: true },
      });

      if (existing) {
        return (tx as any).commissionProfile.update({
          where: { id: existing.id },
          data: {
            serviceCommissionPct,
            productCommissionPct,
            monthlyFixedAmount,
            isActive,
          },
        });
      }

      return (tx as any).commissionProfile.create({
        data: {
          companyId,
          professionalId,
          serviceCommissionPct,
          productCommissionPct,
          monthlyFixedAmount,
          isActive,
        },
      });
    });

    return {
      id: saved.id,
      company_id: saved.companyId,
      professional_id: saved.professionalId,
      service_commission_pct: Number(saved.serviceCommissionPct || 0),
      product_commission_pct: Number(saved.productCommissionPct || 0),
      monthly_fixed_amount: Number(saved.monthlyFixedAmount || 0),
      is_active: saved.isActive,
      updated_at: saved.updatedAt,
    };
  }

  async createCommissionAdjustment(
    user: AuthenticatedUser,
    payload: {
      professional_id?: string;
      month?: string;
      amount?: number;
      reason?: string;
      company_id?: string;
    }
  ) {
    this.ensureOwnerCompanyRole(user);
    const companyId = this.resolveCompanyId(user, payload);
    await this.ensureAnyModuleAccess(user, companyId, ['commissions_owner', 'comissoes_dono']);

    const professionalId = String(payload.professional_id || '').trim();
    const amount = Number(payload.amount || 0);
    const reason = String(payload.reason || '').trim() || null;
    if (!professionalId) throw new CompanyServiceError('professional_id obrigatorio', 400);
    if (!Number.isFinite(amount) || amount === 0) {
      throw new CompanyServiceError('amount obrigatorio e diferente de zero', 400);
    }

    const professional = await prisma.userRole.findFirst({
      where: {
        companyId,
        userId: professionalId,
        role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
      },
      select: { userId: true },
    });
    if (!professional) throw new CompanyServiceError('Profissional nao encontrado na empresa', 404);

    const { start } = this.parseMonthRef(payload.month);
    const created = await (prisma as any).commissionAdjustment.create({
      data: {
        companyId,
        professionalId,
        monthRef: start,
        amount,
        reason,
        createdByUserId: user.id,
      },
    });

    return {
      id: created.id,
      company_id: created.companyId,
      professional_id: created.professionalId,
      month: created.monthRef.toISOString().slice(0, 7),
      amount: Number(created.amount || 0),
      reason: created.reason || null,
      created_by_user_id: created.createdByUserId || null,
      created_at: created.createdAt,
    };
  }

  async getCommissionsOverview(
    user: AuthenticatedUser,
    queryParams: { month?: string; professional_id?: string; company_id?: string; companyId?: string } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, [
      'commissions_owner',
      'comissoes_dono',
      'commissions_staff',
      'commissions',
      'comissoes',
    ]);

    const requestedProfessionalId = String(queryParams.professional_id || '').trim();
    const cleanProfessionalId =
      user.role === 'FUNCIONARIO_EMPRESA' ? user.id : requestedProfessionalId;
    const monthRef = this.parseMonthRef(queryParams.month);

    const professionals = await prisma.userRole.findMany({
      where: {
        companyId,
        role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
        ...(cleanProfessionalId ? { userId: cleanProfessionalId } : {}),
        user: { isActive: true },
      },
      select: {
        userId: true,
        role: true,
        user: { select: { fullName: true, email: true } },
      },
    });

    const professionalIds = professionals.map((item) => item.userId);
    if (professionalIds.length === 0) {
      return {
        period: { month: monthRef.month, start: monthRef.start.toISOString(), end: monthRef.end.toISOString() },
        summary: { professionals: 0, service_revenue: 0, product_revenue: 0, commission_total: 0 },
        data: [],
      };
    }

    const [profiles, appointments, pdvLogs, adjustments, services, payouts] = await Promise.all([
      (prisma as any).commissionProfile.findMany({
        where: { companyId, professionalId: { in: professionalIds }, isActive: true },
        select: {
          professionalId: true,
          serviceCommissionPct: true,
          productCommissionPct: true,
          monthlyFixedAmount: true,
        },
      }),
      (prisma as any).appointment.findMany({
        where: {
          companyId,
          professionalId: { in: professionalIds },
          status: 'concluido',
          scheduledAt: { gte: monthRef.start, lt: monthRef.end },
        },
        select: {
          professionalId: true,
          serviceId: true,
          serviceName: true,
        },
      }),
      prisma.auditLog.findMany({
        where: {
          companyId,
          userId: { in: professionalIds },
          action: 'PDV_CHECKOUT',
          createdAt: { gte: monthRef.start, lt: monthRef.end },
        },
        select: { userId: true, details: true },
      }),
      (prisma as any).commissionAdjustment.findMany({
        where: {
          companyId,
          professionalId: { in: professionalIds },
          monthRef: monthRef.start,
        },
        select: { professionalId: true, amount: true },
      }),
      Promise.resolve([]),
      (prisma as any).commissionPayout.findMany({
        where: {
          companyId,
          professionalId: { in: professionalIds },
          monthRef: monthRef.start,
        },
        select: {
          professionalId: true,
          computedCommission: true,
          amountPaid: true,
          status: true,
          paidAt: true,
          note: true,
          updatedAt: true,
        },
      }),
    ]);

    const profileByProfessional = new Map<string, any>(
      profiles.map((item: any) => [item.professionalId, item])
    );
    const appointmentServiceIds = Array.from(
      new Set(
        (appointments as any[])
          .map((item: any) => String(item.serviceId || '').trim())
          .filter(Boolean)
      )
    );
    const appointmentServiceNames = Array.from(
      new Set(
        (appointments as any[])
          .map((item: any) => String(item.serviceName || '').trim())
          .filter(Boolean)
      )
    );
    const servicesData = appointmentServiceIds.length || appointmentServiceNames.length
      ? await (prisma as any).appointmentService.findMany({
          where: {
            companyId,
            OR: [
              ...(appointmentServiceIds.length ? [{ id: { in: appointmentServiceIds } }] : []),
              ...(appointmentServiceNames.length ? [{ name: { in: appointmentServiceNames } }] : []),
            ],
          },
          select: { id: true, name: true, price: true },
        })
      : services;
    const servicePriceById = new Map<string, number>(
      (servicesData as any[]).map((item: any) => [item.id, Number(item.price || 0)])
    );
    const servicePriceByName = new Map<string, number>(
      (servicesData as any[]).map((item: any) => [String(item.name || '').trim().toLowerCase(), Number(item.price || 0)])
    );

    const appointmentRevenueByProfessional = new Map<string, number>();
    for (const appointment of appointments as any[]) {
      const professionalId = String(appointment.professionalId || '');
      if (!professionalId) continue;
      const byId = appointment.serviceId ? servicePriceById.get(String(appointment.serviceId)) : undefined;
      const byName = servicePriceByName.get(String(appointment.serviceName || '').trim().toLowerCase());
      const servicePrice = Number(byId ?? byName ?? 0);
      appointmentRevenueByProfessional.set(
        professionalId,
        (appointmentRevenueByProfessional.get(professionalId) || 0) + servicePrice
      );
    }

    const productRevenueByProfessional = new Map<string, number>();
    for (const log of pdvLogs) {
      const professionalId = String(log.userId || '').trim();
      if (!professionalId) continue;
      const details: any = log.details || {};
      const items = Array.isArray(details.items) ? details.items : [];
      const totalProducts = items
        .filter((item: any) => String(item.itemType || '').toLowerCase() === 'product')
        .reduce((sum: number, item: any) => sum + this.toNumber(item.lineTotal), 0);
      productRevenueByProfessional.set(
        professionalId,
        (productRevenueByProfessional.get(professionalId) || 0) + totalProducts
      );
    }

    const adjustmentsByProfessional = new Map<string, number>();
    for (const item of adjustments as any[]) {
      const professionalId = String(item.professionalId || '').trim();
      if (!professionalId) continue;
      adjustmentsByProfessional.set(
        professionalId,
        (adjustmentsByProfessional.get(professionalId) || 0) + this.toNumber(item.amount)
      );
    }
    const payoutByProfessional = new Map<string, any>(
      (payouts as any[]).map((item: any) => [String(item.professionalId || ''), item])
    );

    const rows = professionals.map((item) => {
      const professionalId = item.userId;
      const profile = profileByProfessional.get(professionalId);
      const servicePct = Number(profile?.serviceCommissionPct ?? 40);
      const productPct = Number(profile?.productCommissionPct ?? 10);
      const monthlyFixed = Number(profile?.monthlyFixedAmount ?? 0);
      const serviceRevenue = this.toNumber(appointmentRevenueByProfessional.get(professionalId));
      const productRevenue = this.toNumber(productRevenueByProfessional.get(professionalId));
      const monthAdjustments = this.toNumber(adjustmentsByProfessional.get(professionalId));

      const serviceCommission = (serviceRevenue * servicePct) / 100;
      const productCommission = (productRevenue * productPct) / 100;
      const totalCommission = serviceCommission + productCommission + monthlyFixed + monthAdjustments;
      const payout = payoutByProfessional.get(professionalId);
      const payoutStatus = String(payout?.status || 'pending').toLowerCase();
      const amountPaid = this.toNumber(payout?.amountPaid);
      const amountPending = Math.max(0, totalCommission - amountPaid);

      return {
        professional_id: professionalId,
        professional_name: item.user.fullName,
        professional_email: item.user.email,
        role: item.role,
        service_revenue: serviceRevenue,
        product_revenue: productRevenue,
        service_commission_pct: servicePct,
        product_commission_pct: productPct,
        monthly_fixed_amount: monthlyFixed,
        monthly_adjustments: monthAdjustments,
        service_commission_amount: serviceCommission,
        product_commission_amount: productCommission,
        total_commission: totalCommission,
        payout_status: payoutStatus,
        amount_paid: amountPaid,
        amount_pending: amountPending,
        paid_at: payout?.paidAt || null,
        payout_note: payout?.note || null,
        payout_updated_at: payout?.updatedAt || null,
      };
    });

    const summary = rows.reduce(
      (acc, row) => {
        acc.professionals += 1;
        acc.service_revenue += row.service_revenue;
        acc.product_revenue += row.product_revenue;
        acc.commission_total += row.total_commission;
        return acc;
      },
      { professionals: 0, service_revenue: 0, product_revenue: 0, commission_total: 0 }
    );

    return {
      period: {
        month: monthRef.month,
        start: monthRef.start.toISOString(),
        end: monthRef.end.toISOString(),
      },
      summary,
      data: rows.sort((a, b) => b.total_commission - a.total_commission),
    };
  }

  async exportCommissionsCsv(
    user: AuthenticatedUser,
    queryParams: { month?: string; professional_id?: string; company_id?: string; companyId?: string } = {}
  ) {
    this.ensureOwnerCompanyRole(user);
    const result = await this.getCommissionsOverview(user, queryParams);
    const header = [
      'Mes',
      'Profissional',
      'Email',
      'Cargo',
      'Receita Servicos',
      'Receita Produtos',
      '% Servicos',
      '% Produtos',
      'Fixo Mensal',
      'Ajustes',
      'Comissao Servicos',
      'Comissao Produtos',
      'Comissao Total',
      'Status Pagamento',
      'Valor Pago',
      'Valor Pendente',
      'Pago Em',
    ];

    const escapeCsv = (value: unknown) => {
      const raw = String(value ?? '');
      if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    };

    const lines = [
      header.join(','),
      ...result.data.map((row: any) =>
        [
          result.period.month,
          row.professional_name,
          row.professional_email || '',
          row.role,
          row.service_revenue.toFixed(2),
          row.product_revenue.toFixed(2),
          row.service_commission_pct.toFixed(2),
          row.product_commission_pct.toFixed(2),
          row.monthly_fixed_amount.toFixed(2),
          row.monthly_adjustments.toFixed(2),
          row.service_commission_amount.toFixed(2),
          row.product_commission_amount.toFixed(2),
          row.total_commission.toFixed(2),
          row.payout_status,
          row.amount_paid.toFixed(2),
          row.amount_pending.toFixed(2),
          row.paid_at ? new Date(row.paid_at).toISOString() : '',
        ]
          .map(escapeCsv)
          .join(',')
      ),
    ];

    return lines.join('\n');
  }

  async upsertCommissionPayout(
    user: AuthenticatedUser,
    payload: {
      professional_id?: string;
      month?: string;
      status?: string;
      amount_paid?: number;
      note?: string;
      company_id?: string;
    }
  ) {
    this.ensureOwnerCompanyRole(user);
    const companyId = this.resolveCompanyId(user, payload);
    await this.ensureAnyModuleAccess(user, companyId, ['commissions_owner', 'comissoes_dono']);

    const professionalId = String(payload.professional_id || '').trim();
    if (!professionalId) throw new CompanyServiceError('professional_id obrigatorio', 400);

    const professional = await prisma.userRole.findFirst({
      where: {
        companyId,
        userId: professionalId,
        role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
      },
      select: { userId: true },
    });
    if (!professional) throw new CompanyServiceError('Profissional nao encontrado na empresa', 404);

    const monthRef = this.parseMonthRef(payload.month);
    const status = this.normalizeCommissionPayoutStatus(payload.status);
    const note = String(payload.note || '').trim() || null;

    const overview = await this.getCommissionsOverview(user, {
      month: monthRef.month,
      professional_id: professionalId,
      company_id: companyId,
    });
    const row = Array.isArray(overview.data) ? overview.data[0] : null;
    if (!row) throw new CompanyServiceError('Nao foi possivel calcular comissao para o profissional', 404);
    const computedCommission = this.toNumber(row.total_commission);
    const amountPaidInput =
      payload.amount_paid !== undefined ? this.toNumber(payload.amount_paid) : computedCommission;
    if (amountPaidInput < 0) throw new CompanyServiceError('amount_paid nao pode ser negativo', 400);

    const saved = await prisma.$transaction(async (tx) => {
      const existing = await (tx as any).commissionPayout.findFirst({
        where: { companyId, professionalId, monthRef: monthRef.start },
        select: { id: true },
      });

      const data = {
        computedCommission,
        amountPaid: amountPaidInput,
        status,
        paidAt: status === 'paid' ? new Date() : null,
        note,
        createdByUserId: user.id,
      };

      if (existing) {
        return (tx as any).commissionPayout.update({
          where: { id: existing.id },
          data,
        });
      }

      return (tx as any).commissionPayout.create({
        data: {
          companyId,
          professionalId,
          monthRef: monthRef.start,
          ...data,
        },
      });
    });

    return {
      id: saved.id,
      company_id: saved.companyId,
      professional_id: saved.professionalId,
      month: saved.monthRef.toISOString().slice(0, 7),
      computed_commission: Number(saved.computedCommission || 0),
      amount_paid: Number(saved.amountPaid || 0),
      status: saved.status,
      paid_at: saved.paidAt,
      note: saved.note || null,
      updated_at: saved.updatedAt,
    };
  }

  async listCommissionPayouts(
    user: AuthenticatedUser,
    queryParams: { month?: string; professional_id?: string; company_id?: string; companyId?: string } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, [
      'commissions_owner',
      'comissoes_dono',
      'commissions_staff',
      'commissions',
      'comissoes',
    ]);

    const monthRef = this.parseMonthRef(queryParams.month);
    const requestedProfessionalId = String(queryParams.professional_id || '').trim();
    const professionalId = user.role === 'FUNCIONARIO_EMPRESA' ? user.id : requestedProfessionalId || undefined;

    const payouts = await (prisma as any).commissionPayout.findMany({
      where: {
        companyId,
        monthRef: monthRef.start,
        ...(professionalId ? { professionalId } : {}),
      },
      include: {
        professional: { select: { id: true, fullName: true, email: true } },
        createdByUser: { select: { id: true, fullName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      period: {
        month: monthRef.month,
        start: monthRef.start.toISOString(),
        end: monthRef.end.toISOString(),
      },
      data: payouts.map((item: any) => ({
        id: item.id,
        company_id: item.companyId,
        professional_id: item.professionalId,
        professional_name: item.professional?.fullName || null,
        professional_email: item.professional?.email || null,
        computed_commission: Number(item.computedCommission || 0),
        amount_paid: Number(item.amountPaid || 0),
        status: item.status,
        paid_at: item.paidAt,
        note: item.note || null,
        created_by_user_id: item.createdByUserId || null,
        created_by_user_name: item.createdByUser?.fullName || null,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      })),
    };
  }

  async checkoutPdv(
    user: AuthenticatedUser,
    data: {
      customerName?: string;
      paymentMethod: string;
      discount?: number;
      items: Array<{
        itemType?: 'product' | 'service';
        itemId?: string;
        productId?: string;
        quantity: number;
      }>;
    }
  ) {
    const companyId = this.resolveCompanyId(user, data);
    await this.ensureAnyModuleAccess(user, companyId, ['pdv', 'orders', 'pedidos']);

    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) throw new CompanyServiceError('Carrinho vazio', 400);
    if (!data.paymentMethod) throw new CompanyServiceError('Forma de pagamento obrigatoria', 400);

    const normalizedItems = items.map((item) => ({
      itemType: item.itemType === 'service' ? 'service' : 'product',
      itemId: String(item.itemId || item.productId || '').trim(),
      quantity: Number(item.quantity || 0),
    }));

    if (normalizedItems.some((item) => !item.itemId || item.quantity <= 0)) {
      throw new CompanyServiceError('Itens invalidos no carrinho', 400);
    }

    return prisma.$transaction(async (tx) => {
      const productIds = Array.from(
        new Set(normalizedItems.filter((item) => item.itemType === 'product').map((item) => item.itemId))
      );
      const serviceIds = Array.from(
        new Set(normalizedItems.filter((item) => item.itemType === 'service').map((item) => item.itemId))
      );

      const [products, services] = await Promise.all([
        productIds.length
          ? tx.product.findMany({
              where: { id: { in: productIds }, companyId, isActive: true },
            })
          : Promise.resolve([]),
        serviceIds.length
          ? (tx as any).appointmentService.findMany({
              where: { id: { in: serviceIds }, companyId, isActive: true },
            })
          : Promise.resolve([]),
      ]);

      const productMap = new Map<string, (typeof products)[number]>(
        products.map((product) => [product.id, product])
      );
      const serviceMap = new Map<string, any>(
        (services as any[]).map((service: any) => [service.id, service])
      );

      let subtotal = 0;
      const soldItems = normalizedItems.map((item) => {
        if (item.itemType === 'service') {
          const service = serviceMap.get(item.itemId);
          if (!service) {
            throw new CompanyServiceError('Servico nao encontrado', 400);
          }

          const unitPrice = Number(service.price || 0);
          const lineTotal = unitPrice * item.quantity;
          subtotal += lineTotal;

          return {
            itemType: 'service',
            itemId: service.id,
            itemName: service.name,
            quantity: item.quantity,
            unitPrice,
            lineTotal,
            remainingStock: null as number | null,
          };
        }

        const product = productMap.get(item.itemId);
        if (!product) {
          throw new CompanyServiceError('Produto nao encontrado no estoque da empresa', 400);
        }
        if (product.stockQuantity < item.quantity) {
          throw new CompanyServiceError(`Estoque insuficiente para "${product.name}"`, 400);
        }

        const unitPrice = Number(product.price || 0);
        const lineTotal = unitPrice * item.quantity;
        subtotal += lineTotal;

        return {
          itemType: 'product',
          itemId: product.id,
          itemName: product.name,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
          remainingStock: product.stockQuantity - item.quantity,
        };
      });

      for (const item of soldItems) {
        if (item.itemType !== 'product') continue;
        await tx.product.update({
          where: { id: item.itemId },
          data: {
            stockQuantity: item.remainingStock as number,
          },
        });
      }

      const discount = Math.max(0, Number(data.discount || 0));
      const total = Math.max(0, subtotal - discount);

      const paymentMethod = String(data.paymentMethod || '').trim().toLowerCase();
      const allowedPaymentMethods = ['dinheiro', 'pix', 'credito', 'debito', 'cartao'];
      if (!allowedPaymentMethods.includes(paymentMethod)) {
        throw new CompanyServiceError('Forma de pagamento invalida', 400);
      }

      const isPix = paymentMethod === 'pix';
      const activeGateway = isPix
        ? await this.paymentService.getCompanyActiveGateway(companyId)
        : null;

      if (isPix && !activeGateway) {
        throw new CompanyServiceError('Configure um gateway ativo para processar PIX', 400);
      }

      if (total <= 0) {
        throw new CompanyServiceError('Total invalido para checkout', 400);
      }

      const order = await tx.order.create({
        data: {
          companyId,
          customerName: data.customerName?.trim() || null,
          status: isPix ? 'pending_pix' : 'paid',
          total,
        },
      });

      let gatewayPayment: any = null;
      if (isPix && activeGateway) {
        if (activeGateway.provider === 'stripe') {
          gatewayPayment = await this.paymentService.createStripePixPayment(tx, {
            companyId,
            orderId: order.id,
            amount: total,
            customerName: order.customerName,
          });
        } else if (activeGateway.provider === 'mercadopago') {
          gatewayPayment = await this.paymentService.createMercadoPagoPixPayment(tx, {
            companyId,
            orderId: order.id,
            amount: total,
            customerName: order.customerName,
            customerEmail: null,
          });
        } else if (activeGateway.provider === 'pagbank') {
          gatewayPayment = await this.paymentService.createPagBankPixPayment(tx, {
            companyId,
            orderId: order.id,
            amount: total,
            customerName: order.customerName,
          });
        }
      }

      if (order.status === 'paid') {
        await this.syncCompanyMonthlyRevenue(tx, companyId, order.createdAt);
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          companyId,
          action: 'PDV_CHECKOUT',
          resource: 'orders',
          details: {
            orderId: order.id,
            paymentMethod,
            paymentGateway: gatewayPayment
              ? {
                  provider: gatewayPayment.provider,
                  externalPaymentId: gatewayPayment.externalPaymentId,
                  status: gatewayPayment.status,
                }
              : null,
            subtotal,
            discount,
            total,
            items: soldItems,
          },
        },
      });

      return {
        order: {
          id: order.id,
          total: Number(order.total || 0),
          status: order.status,
          customerName: order.customerName,
          createdAt: order.createdAt,
        },
        summary: {
          subtotal,
          discount,
          total,
          items: soldItems,
        },
        payment_gateway: gatewayPayment
          ? {
              provider: gatewayPayment.provider,
              status: gatewayPayment.status,
              externalPaymentId: gatewayPayment.externalPaymentId,
              qrCodeText: gatewayPayment.qrCodeText,
              qrCodeImageUrl: gatewayPayment.qrCodeImageUrl,
              paymentUrl: gatewayPayment.paymentUrl || null,
            }
          : null,
      };
    }, { maxWait: 10000, timeout: 30000 });
  }

  async listBillingCharges(
    user: AuthenticatedUser,
    queryParams: { status?: string; page?: number; pageSize?: number; search?: string }
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['billing', 'cobrancas']);

    const status = String(queryParams.status || '').trim().toLowerCase();
    const search = String(queryParams.search || '').trim();
    const page = Math.max(1, Number(queryParams.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(queryParams.pageSize || 20)));

    const where: any = {
      companyId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { customerName: { contains: search, mode: 'insensitive' as const } },
              { customerEmail: { contains: search, mode: 'insensitive' as const } },
              { orderId: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      (prisma as any).billingCharge.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              paymentTransactions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                  id: true,
                  provider: true,
                  status: true,
                  qrCodeText: true,
                  qrCodeImageUrl: true,
                  paymentLinkUrl: true,
                  externalPaymentId: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      (prisma as any).billingCharge.count({ where }),
    ]);

    return {
      data: items.map((item: any) => ({
        id: item.id,
        company_id: item.companyId,
        order_id: item.orderId,
        title: item.title,
        description: item.description,
        customer_name: item.customerName,
        customer_email: item.customerEmail,
        customer_phone: item.customerPhone,
        amount: Number(item.amount || 0),
        payment_method: item.paymentMethod,
        status: item.status,
        due_date: item.dueDate,
        paid_at: item.paidAt,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
        transaction: item.order?.paymentTransactions?.[0] || null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async createBillingCharge(
    user: AuthenticatedUser,
    data: {
      title?: string;
      description?: string;
      customer_name?: string;
      customer_email?: string;
      customer_phone?: string;
      amount?: number;
      due_date?: string;
      payment_method?: string;
    }
  ) {
    const companyId = this.resolveCompanyId(user, data);
    await this.ensureAnyModuleAccess(user, companyId, ['billing', 'cobrancas']);

    const title = String(data.title || '').trim();
    const customerName = String(data.customer_name || '').trim();
    const customerEmail = String(data.customer_email || '').trim() || null;
    const customerPhone = String(data.customer_phone || '').trim() || null;
    const amount = Number(data.amount || 0);
    const paymentMethod = String(data.payment_method || 'pix').trim().toLowerCase();
    const description = String(data.description || '').trim() || null;
    const dueDate = data.due_date ? new Date(String(data.due_date)) : null;

    if (!title || !customerName || amount <= 0) {
      throw new CompanyServiceError('Campos obrigatorios: title, customer_name, amount', 400);
    }
    if (!['pix', 'credito', 'debito', 'cartao'].includes(paymentMethod)) {
      throw new CompanyServiceError('payment_method invalido. Use pix, credito, debito ou cartao', 400);
    }
    if (dueDate && Number.isNaN(dueDate.getTime())) {
      throw new CompanyServiceError('due_date invalida', 400);
    }

    return prisma.$transaction(async (tx) => {
      const activeGateway = await this.paymentService.getCompanyActiveGateway(companyId);
      if (!activeGateway) {
        throw new CompanyServiceError('Configure e ative um gateway antes de criar cobrancas', 400);
      }

      const orderStatus =
        paymentMethod === 'pix' ? 'pending_pix' : 'pending_gateway';

      const order = await tx.order.create({
        data: {
          companyId,
          customerName,
          total: amount,
          status: orderStatus,
        },
      });

      const charge = await (tx as any).billingCharge.create({
        data: {
          companyId,
          orderId: order.id,
          title,
          description,
          customerName,
          customerEmail,
          customerPhone,
          amount,
          paymentMethod,
          status: 'pending',
          dueDate,
        },
      });

      let gatewayPayment: any = null;
      if (paymentMethod === 'pix') {
        if (activeGateway.provider === 'stripe') {
          gatewayPayment = await this.paymentService.createStripePixPayment(tx, {
            companyId,
            orderId: order.id,
            amount,
            customerName,
          });
        } else if (activeGateway.provider === 'mercadopago') {
          gatewayPayment = await this.paymentService.createMercadoPagoPixPayment(tx, {
            companyId,
            orderId: order.id,
            amount,
            customerName,
            customerEmail,
          });
        } else if (activeGateway.provider === 'pagbank') {
          gatewayPayment = await this.paymentService.createPagBankPixPayment(tx, {
            companyId,
            orderId: order.id,
            amount,
            customerName,
          });
        }
      } else {
        if (activeGateway.provider === 'stripe') {
          gatewayPayment = await this.paymentService.createStripeCardPaymentLink(tx, {
            companyId,
            orderId: order.id,
            amount,
            customerName,
            paymentMethod: paymentMethod as 'credito' | 'debito' | 'cartao',
          });
        } else if (activeGateway.provider === 'mercadopago') {
          gatewayPayment = await this.paymentService.createMercadoPagoPaymentLink(tx, {
            companyId,
            orderId: order.id,
            amount,
            customerName,
            paymentMethod: paymentMethod as 'credito' | 'debito' | 'cartao',
          });
        } else if (activeGateway.provider === 'pagbank') {
          gatewayPayment = await this.paymentService.createPagBankPaymentLink(tx, {
            companyId,
            orderId: order.id,
            amount,
            customerName,
            paymentMethod: paymentMethod as 'credito' | 'debito' | 'cartao',
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          companyId,
          action: 'BILLING_CHARGE_CREATED',
          resource: 'billing_charges',
          details: {
            billingChargeId: charge.id,
            orderId: order.id,
            provider: activeGateway.provider,
            amount,
            customerName,
          },
        },
      });

      return {
        id: charge.id,
        company_id: charge.companyId,
        order_id: charge.orderId,
        title: charge.title,
        description: charge.description,
        customer_name: charge.customerName,
        customer_email: charge.customerEmail,
        customer_phone: charge.customerPhone,
        amount: Number(charge.amount || 0),
        payment_method: charge.paymentMethod,
        status: charge.status,
        due_date: charge.dueDate,
        created_at: charge.createdAt,
        updated_at: charge.updatedAt,
        payment_gateway: gatewayPayment
          ? {
              provider: gatewayPayment.provider,
              status: gatewayPayment.status,
              externalPaymentId: gatewayPayment.externalPaymentId,
              qrCodeText: gatewayPayment.qrCodeText,
              qrCodeImageUrl: gatewayPayment.qrCodeImageUrl,
              paymentUrl: gatewayPayment.paymentUrl || null,
            }
          : null,
      };
    }, { maxWait: 10000, timeout: 30000 });
  }

  async confirmPixPayment(user: AuthenticatedUser, orderId: string, payload?: any) {
    const companyId = this.resolveCompanyId(user, payload || {});
    await this.ensureAnyModuleAccess(user, companyId, ['pdv', 'orders', 'pedidos']);

    const order = await prisma.order.findFirst({
      where: { id: orderId, companyId },
      select: { id: true, status: true, total: true, customerName: true, createdAt: true },
    });

    if (!order) {
      throw new CompanyServiceError('Pedido nao encontrado', 404);
    }

    if (order.status === 'paid') {
      return {
        id: order.id,
        status: order.status,
        total: Number(order.total || 0),
        customerName: order.customerName,
        createdAt: order.createdAt,
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const paidOrder = await tx.order.update({
        where: { id: order.id },
        data: { status: 'paid' },
      });

      await this.syncCompanyMonthlyRevenue(tx, companyId, paidOrder.createdAt);

      await tx.auditLog.create({
        data: {
          userId: user.id,
          companyId,
          action: 'PIX_CONFIRMED',
          resource: 'orders',
          details: {
            orderId: paidOrder.id,
            previousStatus: order.status,
            newStatus: paidOrder.status,
          },
        },
      });

      return paidOrder;
    });

    return {
      id: updated.id,
      status: updated.status,
      total: Number(updated.total || 0),
      customerName: updated.customerName,
      createdAt: updated.createdAt,
    };
  }

  async listPdvOrders(
    user: AuthenticatedUser,
    queryParams: {
      status?: string;
      limit?: number;
      page?: number;
      pageSize?: number;
      company_id?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['pdv', 'orders', 'pedidos']);

    const status = String(queryParams.status || '').trim();
    const search = String(queryParams.search || '').trim();
    const page = Math.max(1, Number(queryParams.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(queryParams.pageSize || queryParams.limit || 20)));
    const dateFrom = queryParams.dateFrom ? new Date(queryParams.dateFrom) : null;
    const dateTo = queryParams.dateTo ? new Date(queryParams.dateTo) : null;

    const createdAtFilter: any = {};
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) {
      createdAtFilter.gte = dateFrom;
    }
    if (dateTo && !Number.isNaN(dateTo.getTime())) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      createdAtFilter.lte = end;
    }

    const where = {
      companyId,
      ...(status ? { status } : {}),
      ...(Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}),
      ...(search
        ? {
            OR: [
              { customerName: { contains: search, mode: 'insensitive' as const } },
              { id: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
        select: {
          id: true,
          customerName: true,
          total: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id,
        customerName: item.customerName,
        total: Number(item.total || 0),
        status: item.status,
        createdAt: item.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async importProducts(
    user: AuthenticatedUser,
    data: {
      products: Array<{
        name?: string;
        sku?: string | null;
        price?: number;
        stockQuantity?: number;
        isActive?: boolean;
      }>;
    }
  ) {
    const companyId = this.resolveCompanyId(user, data);
    await this.ensureAnyModuleAccess(user, companyId, ['products', 'produtos']);

    const items = Array.isArray(data.products) ? data.products : [];
    if (items.length === 0) {
      throw new CompanyServiceError('Nenhum produto enviado para importacao', 400);
    }

    const normalized = items.map((item) => ({
      name: String(item.name || '').trim(),
      sku: item.sku ? String(item.sku).trim() : null,
      price: Number(item.price || 0),
      stockQuantity: Number(item.stockQuantity || 0),
      isActive: item.isActive !== false,
    }));

    const valid = normalized.filter((item) => item.name && item.price >= 0 && item.stockQuantity >= 0);
    if (valid.length === 0) {
      throw new CompanyServiceError('Nenhum registro valido encontrado para importacao', 400);
    }

    let created = 0;
    let updated = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of valid) {
        if (item.sku) {
          const existing = await tx.product.findFirst({
            where: { companyId, sku: item.sku },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          });

          if (existing) {
            await tx.product.update({
              where: { id: existing.id },
              data: {
                name: item.name,
                price: item.price,
                stockQuantity: item.stockQuantity,
                isActive: item.isActive,
              },
            });
            updated += 1;
            continue;
          }
        }

        await tx.product.create({
          data: {
            companyId,
            name: item.name,
            sku: item.sku,
            price: item.price,
            stockQuantity: item.stockQuantity,
            isActive: item.isActive,
          },
        });
        created += 1;
      }
    });

    return {
      received: items.length,
      processed: valid.length,
      created,
      updated,
      skipped: items.length - valid.length,
    };
  }

  private generateTemporaryPassword() {
    const randomBlock = Math.random().toString(36).slice(2, 10);
    return `Func@${randomBlock}`;
  }

  private maskSecret(value?: string | null) {
    const raw = String(value || '');
    if (!raw) return null;
    if (raw.length <= 6) return '***';
    return `${raw.slice(0, 3)}***${raw.slice(-3)}`;
  }

  private ensureOwner(user: AuthenticatedUser) {
    if (user.role !== 'DONO_EMPRESA') {
      throw new CompanyServiceError('Somente dono da empresa pode executar esta acao', 403);
    }
  }

  private ensureOwnerCompanyId(user: AuthenticatedUser) {
    this.ensureOwner(user);
    const companyId = user.companyId;
    if (!companyId) throw new CompanyServiceError('Company ID obrigatorio', 400);
    return companyId;
  }

  async listMyPaymentGateways(user: AuthenticatedUser) {
    const companyId = this.ensureOwnerCompanyId(user);

    const gateways = await (prisma as any).paymentGateway.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    return gateways.map((gateway: any) => ({
      id: gateway.id,
      empresa_id: gateway.companyId,
      provedor: gateway.provider,
      nome_exibicao: gateway.displayName,
      public_key: gateway.publicKey,
      secret_key_masked: this.maskSecret(
        gateway.secretKeyEncrypted ? decryptSecret(gateway.secretKeyEncrypted) : null
      ),
      webhook_secret_masked: this.maskSecret(
        gateway.webhookSecretEncrypted ? decryptSecret(gateway.webhookSecretEncrypted) : null
      ),
      ambiente: gateway.environment,
      is_active: gateway.isActive,
      webhook_url: gateway.webhookUrl,
      configuracoes: gateway.settings,
      created_at: gateway.createdAt,
      updated_at: gateway.updatedAt,
    }));
  }

  async connectMyPaymentGateway(
    user: AuthenticatedUser,
    data: {
      provedor?: string;
      nome_exibicao?: string;
      public_key?: string;
      secret_key?: string;
      webhook_secret?: string;
      ambiente?: string;
      webhook_url?: string;
      configuracoes?: unknown;
    }
  ) {
    const companyId = this.ensureOwnerCompanyId(user);
    const provider = String(data.provedor || '').trim().toLowerCase();
    const allowedProviders = new Set(['stripe', 'mercadopago', 'pagbank']);
    if (!allowedProviders.has(provider)) {
      throw new CompanyServiceError('Provedor nao suportado. Use stripe, mercadopago ou pagbank', 400);
    }

    const secretKey = String(data.secret_key || '').trim();
    const publicKey = String(data.public_key || '').trim() || null;
    const webhookSecret = String(data.webhook_secret || '').trim() || null;
    const environment = String(data.ambiente || 'sandbox').trim().toLowerCase();

    const validation = await this.paymentService.validateGatewayCredentials({
      provider,
      environment,
      publicKey,
      secretKey,
    });

    const displayName =
      String(data.nome_exibicao || '').trim() ||
      `${provider.toUpperCase()} ${validation?.accountName ? `- ${validation.accountName}` : ''}`.trim();

    const saved = await prisma.$transaction(async (tx) => {
      await (tx as any).paymentGateway.updateMany({
        where: { companyId },
        data: { isActive: false },
      });

      const existing = await (tx as any).paymentGateway.findFirst({
        where: { companyId, provider },
        select: { id: true },
      });

      if (existing) {
        return (tx as any).paymentGateway.update({
          where: { id: existing.id },
          data: {
            displayName,
            publicKey,
            secretKeyEncrypted: encryptSecret(secretKey),
            webhookSecretEncrypted: webhookSecret ? encryptSecret(webhookSecret) : null,
            environment,
            webhookUrl: data.webhook_url || null,
            settings: {
              ...(data.configuracoes as any),
              accountValidation: validation,
            },
            isActive: true,
          },
        });
      }

      return (tx as any).paymentGateway.create({
        data: {
          companyId,
          provider,
          displayName,
          publicKey,
          secretKeyEncrypted: encryptSecret(secretKey),
          webhookSecretEncrypted: webhookSecret ? encryptSecret(webhookSecret) : null,
          environment,
          webhookUrl: data.webhook_url || null,
          settings: {
            ...(data.configuracoes as any),
            accountValidation: validation,
          },
          isActive: true,
        },
      });
    });

    return {
      id: saved.id,
      empresa_id: saved.companyId,
      provedor: saved.provider,
      nome_exibicao: saved.displayName,
      public_key: saved.publicKey,
      secret_key_masked: this.maskSecret(secretKey),
      webhook_secret_masked: this.maskSecret(webhookSecret),
      ambiente: saved.environment,
      is_active: saved.isActive,
      webhook_url: saved.webhookUrl,
      configuracoes: saved.settings,
      validation,
    };
  }

  async activateMyPaymentGateway(user: AuthenticatedUser, gatewayId: string) {
    const companyId = this.ensureOwnerCompanyId(user);

    const target = await (prisma as any).paymentGateway.findFirst({
      where: { id: gatewayId, companyId },
      select: { id: true },
    });
    if (!target) throw new CompanyServiceError('Gateway nao encontrado', 404);

    await prisma.$transaction(async (tx) => {
      await (tx as any).paymentGateway.updateMany({
        where: { companyId },
        data: { isActive: false },
      });
      await (tx as any).paymentGateway.update({
        where: { id: gatewayId },
        data: { isActive: true },
      });
    });

    return { success: true };
  }

  async deleteMyPaymentGateway(user: AuthenticatedUser, gatewayId: string) {
    const companyId = this.ensureOwnerCompanyId(user);

    const target = await (prisma as any).paymentGateway.findFirst({
      where: { id: gatewayId, companyId },
      select: { id: true },
    });
    if (!target) throw new CompanyServiceError('Gateway nao encontrado', 404);

    await (prisma as any).paymentGateway.delete({ where: { id: gatewayId } });
    return { success: true };
  }

  async getFinancialOverview(
    user: AuthenticatedUser,
    queryParams: { dateFrom?: string; dateTo?: string; company_id?: string; companyId?: string } = {}
  ) {
    const allowedRole = user.role === 'SUPER_ADMIN_EVOLUTECH' || user.role === 'DONO_EMPRESA';
    if (!allowedRole) {
      throw new CompanyServiceError('Sem permissao para acessar o financeiro', 403);
    }

    const isOwner = user.role === 'DONO_EMPRESA';
    const companyId = isOwner
      ? this.resolveCompanyId(user, queryParams)
      : String(queryParams.company_id || queryParams.companyId || '').trim() || null;

    if (isOwner && !companyId) {
      throw new CompanyServiceError('Company ID obrigatorio', 400);
    }
    if (isOwner) {
      await this.ensureAnyModuleAccess(user, companyId, ['financeiro', 'financial']);
    }
    const { start, end } = this.parseDateRange(queryParams, 180);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const historyStart = new Date(now.getFullYear(), now.getMonth() - 24, 1);

    const [paidOrders, monthlyNewCustomers, activeUsersByCompany, paidOrdersInRange, pendingOrdersInRange, paidTransactionsInRange, auditLogsInRange, customersTotalCount, lifetimeRevenueAgg, mrrCurrentAgg, mrrPreviousAgg] = await Promise.all([
      prisma.order.findMany({
        where: {
          ...(isOwner && companyId ? { companyId } : {}),
          status: 'paid',
          createdAt: { gte: historyStart },
        },
        select: {
          id: true,
          companyId: true,
          total: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.customer.findMany({
        where: isOwner && companyId
          ? { companyId, createdAt: { gte: historyStart } }
          : { createdAt: { gte: historyStart } },
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
          ...(isOwner && companyId ? { companyId } : {}),
        },
        _count: { _all: true },
      }),
      prisma.order.findMany({
        where: {
          ...(isOwner && companyId ? { companyId } : {}),
          status: 'paid',
          createdAt: { gte: start, lte: end },
        },
        select: { id: true, total: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.order.findMany({
        where: {
          ...(isOwner && companyId ? { companyId } : {}),
          status: { in: ['pending', 'pending_gateway', 'pending_pix'] },
          createdAt: { gte: start, lte: end },
        },
        select: { total: true, createdAt: true },
      }),
      (prisma as any).paymentTransaction.findMany({
        where: {
          ...(isOwner && companyId ? { companyId } : {}),
          status: 'paid',
          createdAt: { gte: start, lte: end },
        },
        select: { orderId: true, paymentMethod: true, amount: true },
      }),
      prisma.auditLog.findMany({
        where: {
          ...(isOwner && companyId ? { companyId } : {}),
          action: 'PDV_CHECKOUT',
          createdAt: { gte: start, lte: end },
        },
        select: { details: true },
      }),
      prisma.customer.count({
        where: isOwner && companyId ? { companyId } : undefined,
      }),
      prisma.order.aggregate({
        where: {
          ...(isOwner && companyId ? { companyId } : {}),
          status: 'paid',
        },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          ...(isOwner && companyId ? { companyId } : {}),
          status: 'paid',
          createdAt: { gte: monthStart },
        },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          ...(isOwner && companyId ? { companyId } : {}),
          status: 'paid',
          createdAt: { gte: prevMonthStart, lte: prevMonthEnd },
        },
        _sum: { total: true },
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
      where: isOwner && companyId ? { id: companyId } : { status: 'active' },
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

    const mrrCurrent = this.toNumber(mrrCurrentAgg._sum.total);
    const mrrPrevious = this.toNumber(mrrPreviousAgg._sum.total);
    const mrrGrowth = mrrPrevious > 0 ? ((mrrCurrent - mrrPrevious) / mrrPrevious) * 100 : 0;

    const lifetimeRevenue = this.toNumber(lifetimeRevenueAgg._sum.total);
    const ltv = customersTotalCount > 0 ? lifetimeRevenue / customersTotalCount : 0;
    const paidRevenueInRange = paidOrdersInRange.reduce((sum, item) => sum + this.toNumber(item.total), 0);
    const ticketMedio = paidOrdersInRange.length > 0 ? paidRevenueInRange / paidOrdersInRange.length : 0;
    const pendingAmount = pendingOrdersInRange.reduce((sum, item) => sum + this.toNumber(item.total), 0);

    const dailyMap = new Map<string, { paid: number; pending: number }>();
    const cursor = new Date(start);
    while (cursor <= end) {
      dailyMap.set(cursor.toISOString().slice(0, 10), { paid: 0, pending: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const item of paidOrdersInRange) {
      const key = item.createdAt.toISOString().slice(0, 10);
      const current = dailyMap.get(key) || { paid: 0, pending: 0 };
      current.paid += this.toNumber(item.total);
      dailyMap.set(key, current);
    }
    for (const item of pendingOrdersInRange) {
      const key = item.createdAt.toISOString().slice(0, 10);
      const current = dailyMap.get(key) || { paid: 0, pending: 0 };
      current.pending += this.toNumber(item.total);
      dailyMap.set(key, current);
    }

    const paidOrdersById = new Map<string, number>();
    for (const order of paidOrdersInRange as any[]) {
      if (order?.id) paidOrdersById.set(String(order.id), this.toNumber(order.total));
    }

    const paymentMethodsMap = new Map<string, number>();
    const ordersAlreadyCounted = new Set<string>();

    for (const tx of paidTransactionsInRange) {
      const method = String(tx.paymentMethod || 'desconhecido').toLowerCase();
      paymentMethodsMap.set(method, (paymentMethodsMap.get(method) || 0) + this.toNumber(tx.amount));
      if (tx.orderId) {
        ordersAlreadyCounted.add(String(tx.orderId));
      }
    }

    for (const log of auditLogsInRange) {
      const details = (log.details || {}) as any;
      const orderId = String(details?.orderId || '').trim();
      const paymentMethod = String(details?.paymentMethod || '').trim().toLowerCase();
      if (!orderId || !paymentMethod) continue;
      if (ordersAlreadyCounted.has(orderId)) continue;
      const paidAmount = paidOrdersById.get(orderId);
      if (!paidAmount || paidAmount <= 0) continue;
      paymentMethodsMap.set(paymentMethod, (paymentMethodsMap.get(paymentMethod) || 0) + paidAmount);
      ordersAlreadyCounted.add(orderId);
    }

    return {
      period: {
        date_from: start.toISOString(),
        date_to: end.toISOString(),
      },
      summary: {
        mrr_current: mrrCurrent,
        mrr_previous: mrrPrevious,
        mrr_growth_percent: mrrGrowth,
        ltv,
        ticket_medio: ticketMedio,
        revenue_in_period: paidRevenueInRange,
        pending_amount: pendingAmount,
        customers_total: customersTotalCount,
      },
      charts: {
        cashflow_by_day: Array.from(dailyMap.entries()).map(([date, values]) => ({
          date,
          paid: values.paid,
          pending: values.pending,
        })),
        payment_methods: Array.from(paymentMethodsMap.entries()).map(([payment_method, total]) => ({
          payment_method,
          total,
        })),
      },
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

  async listTeamMembers(user: AuthenticatedUser) {
    this.ensureOwner(user);
    const companyId = user.companyId;
    if (!companyId) throw new CompanyServiceError('Company ID obrigatorio', 400);

    const members = await prisma.userRole.findMany({
      where: {
        companyId,
        role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((member) => ({
      id: member.user.id,
      email: member.user.email,
      fullName: member.user.fullName,
      role: member.role,
      isActive: member.user.isActive,
      createdAt: member.user.createdAt,
    }));
  }

  async createTeamMember(
    user: AuthenticatedUser,
    data: { fullName: string; email: string; password?: string }
  ) {
    this.ensureOwner(user);
    const companyId = user.companyId;
    if (!companyId) throw new CompanyServiceError('Company ID obrigatorio', 400);

    const fullName = String(data.fullName || '').trim();
    const email = String(data.email || '').trim().toLowerCase();
    const temporaryPassword = String(data.password || '').trim() || this.generateTemporaryPassword();

    if (!fullName || !email) {
      throw new CompanyServiceError('Campos obrigatorios: fullName e email', 400);
    }

    if (temporaryPassword.length < 6) {
      throw new CompanyServiceError('Senha deve ter ao menos 6 caracteres', 400);
    }

    const created = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { email } });
      let targetUser = existingUser;

      if (!existingUser) {
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);
        targetUser = await tx.user.create({
          data: {
            email,
            fullName,
            passwordHash,
            isActive: true,
          },
        });
      } else {
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);
        targetUser = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            fullName: fullName || existingUser.fullName,
            passwordHash,
            isActive: true,
          },
        });
      }

      const existingRole = await tx.userRole.findFirst({
        where: {
          userId: targetUser.id,
          companyId,
        },
        select: { id: true },
      });

      if (existingRole) {
        throw new CompanyServiceError('Este usuario ja esta vinculado a esta empresa', 409);
      }

      await tx.userRole.create({
        data: {
          userId: targetUser.id,
          companyId,
          role: 'FUNCIONARIO_EMPRESA',
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          companyId,
          action: 'TEAM_MEMBER_CREATED',
          resource: 'profiles',
          details: {
            memberId: targetUser.id,
            memberEmail: targetUser.email,
            memberRole: 'FUNCIONARIO_EMPRESA',
          },
        },
      });

      return targetUser;
    });

    return {
      member: {
        id: created.id,
        email: created.email,
        fullName: created.fullName,
        role: 'FUNCIONARIO_EMPRESA',
        isActive: created.isActive,
        createdAt: created.createdAt,
      },
      credentials: {
        email: created.email,
        temporaryPassword,
        requiresPasswordChange: true,
      },
    };
  }

  private parseTaskStatus(status?: string): TaskStatus {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'doing') return 'doing';
    if (normalized === 'done') return 'done';
    return 'todo';
  }

  async listMyTasks(user: AuthenticatedUser, queryParams: any) {
    const companyId = this.resolveCompanyId(user, queryParams);
    const status = queryParams?.status ? this.parseTaskStatus(queryParams.status) : undefined;

    const tasks = await prisma.task.findMany({
      where: {
        companyId,
        userId: user.id,
        ...(status ? { status } : {}),
      },
      orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      position: task.position,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));
  }

  async createMyTask(
    user: AuthenticatedUser,
    data: { title?: string; description?: string; status?: string }
  ) {
    const companyId = this.resolveCompanyId(user, data);
    const title = String(data.title || '').trim();
    if (!title) throw new CompanyServiceError('Titulo da tarefa obrigatorio', 400);

    const status = this.parseTaskStatus(data.status);
    const maxPos = await prisma.task.aggregate({
      where: { companyId, userId: user.id, status },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;

    const created = await prisma.task.create({
      data: {
        companyId,
        userId: user.id,
        title,
        description: String(data.description || '').trim() || null,
        status,
        position,
      },
    });

    return {
      id: created.id,
      title: created.title,
      description: created.description,
      status: created.status,
      position: created.position,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async updateMyTask(
    user: AuthenticatedUser,
    taskId: string,
    data: { title?: string; description?: string }
  ) {
    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, companyId: true, userId: true },
    });
    if (!existing) throw new CompanyServiceError('Tarefa nao encontrada', 404);

    const companyId = this.resolveCompanyId(user, data);
    if (existing.companyId !== companyId || existing.userId !== user.id) {
      throw new CompanyServiceError('Acesso negado', 403);
    }

    const payload: any = {};
    if (typeof data.title === 'string') {
      const title = data.title.trim();
      if (!title) throw new CompanyServiceError('Titulo da tarefa obrigatorio', 400);
      payload.title = title;
    }
    if (typeof data.description === 'string') {
      payload.description = data.description.trim() || null;
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: payload,
    });

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      status: updated.status,
      position: updated.position,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteMyTask(user: AuthenticatedUser, taskId: string, payload?: any) {
    const companyId = this.resolveCompanyId(user, payload || {});
    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, companyId: true, userId: true, status: true, position: true },
    });
    if (!existing) throw new CompanyServiceError('Tarefa nao encontrada', 404);
    if (existing.companyId !== companyId || existing.userId !== user.id) {
      throw new CompanyServiceError('Acesso negado', 403);
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.delete({ where: { id: taskId } });
      await tx.task.updateMany({
        where: {
          companyId,
          userId: user.id,
          status: existing.status,
          position: { gt: existing.position },
        },
        data: { position: { decrement: 1 } },
      });
    });

    return { success: true };
  }

  async moveMyTask(
    user: AuthenticatedUser,
    taskId: string,
    data: { status?: string; targetIndex?: number; company_id?: string }
  ) {
    const companyId = this.resolveCompanyId(user, data);
    const targetStatus = this.parseTaskStatus(data.status);
    const requestedIndex = Number.isInteger(data.targetIndex) ? Number(data.targetIndex) : undefined;

    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, companyId: true, userId: true, status: true, position: true },
    });
    if (!existing) throw new CompanyServiceError('Tarefa nao encontrada', 404);
    if (existing.companyId !== companyId || existing.userId !== user.id) {
      throw new CompanyServiceError('Acesso negado', 403);
    }

    const moved = await prisma.$transaction(async (tx) => {
      // Remove gap from source column
      await tx.task.updateMany({
        where: {
          companyId,
          userId: user.id,
          status: existing.status,
          position: { gt: existing.position },
        },
        data: { position: { decrement: 1 } },
      });

      const targetCount = await tx.task.count({
        where: {
          companyId,
          userId: user.id,
          status: targetStatus,
          id: { not: taskId },
        },
      });
      const nextPos =
        typeof requestedIndex === 'number'
          ? Math.max(0, Math.min(requestedIndex, targetCount))
          : targetCount;

      // Open slot in target column
      await tx.task.updateMany({
        where: {
          companyId,
          userId: user.id,
          status: targetStatus,
          position: { gte: nextPos },
          id: { not: taskId },
        },
        data: { position: { increment: 1 } },
      });

      return tx.task.update({
        where: { id: taskId },
        data: {
          status: targetStatus,
          position: nextPos,
        },
      });
    });

    return {
      id: moved.id,
      title: moved.title,
      description: moved.description,
      status: moved.status,
      position: moved.position,
      createdAt: moved.createdAt,
      updatedAt: moved.updatedAt,
    };
  }

  async getPublicBookingCompany(slug: string) {
    const cleanSlug = String(slug || '').trim().toLowerCase();
    if (!cleanSlug) throw new CompanyServiceError('Slug da empresa obrigatorio', 400);

    const company = await prisma.company.findFirst({
      where: {
        slug: cleanSlug,
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!company) throw new CompanyServiceError('Empresa nao encontrada ou inativa', 404);
    return company;
  }

  async getPublicBookingOptions(slug: string) {
    const company = await this.getPublicBookingCompany(slug);

    const [professionals, services] = await Promise.all([
      prisma.userRole.findMany({
        where: {
          companyId: company.id,
          role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
          user: { isActive: true },
        },
        select: {
          userId: true,
          user: { select: { fullName: true } },
        },
        orderBy: { user: { fullName: 'asc' } },
      }),
      (prisma as any).appointmentService.findMany({
        where: { companyId: company.id, isActive: true },
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          price: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      company,
      professionals: professionals.map((item: any) => ({
        id: item.userId,
        name: item.user.fullName,
      })),
      services: services.map((item: any) => ({
        id: item.id,
        name: item.name,
        duration_minutes: item.durationMinutes,
        price: Number(item.price || 0),
      })),
    };
  }

  async listPublicAvailableSlots(
    slug: string,
    params: { date?: string; service_id?: string; professional_id?: string }
  ) {
    const company = await this.getPublicBookingCompany(slug);
    const dateRaw = String(params.date || '').trim();
    const serviceId = String(params.service_id || '').trim();
    const professionalId = String(params.professional_id || '').trim();

    if (!dateRaw || !serviceId || !professionalId) {
      throw new CompanyServiceError('Parametros obrigatorios: date, service_id, professional_id', 400);
    }

    const [year, month, day] = dateRaw.split('-').map((v) => Number(v));
    const date = new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || Number.isNaN(date.getTime())) {
      throw new CompanyServiceError('Data invalida', 400);
    }

    const service = await (prisma as any).appointmentService.findFirst({
      where: { id: serviceId, companyId: company.id, isActive: true },
      select: { id: true, durationMinutes: true },
    });
    if (!service) throw new CompanyServiceError('Servico invalido', 400);

    const professional = await prisma.userRole.findFirst({
      where: {
        companyId: company.id,
        userId: professionalId,
        role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
        user: { isActive: true },
      },
      select: { id: true },
    });
    if (!professional) throw new CompanyServiceError('Profissional invalido', 400);

    const weekday = date.getDay();
    const schedules = await (prisma as any).appointmentAvailability.findMany({
      where: { companyId: company.id, professionalId, weekday, isActive: true },
      orderBy: { startTime: 'asc' },
    });
    if (schedules.length === 0) {
      return { company, slots: [] };
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const booked = await (prisma as any).appointment.findMany({
      where: {
        companyId: company.id,
        professionalId,
        scheduledAt: { gte: startDate, lte: endDate },
        status: { notIn: ['cancelado', 'cancelled', 'no_show', 'no-show'] },
      },
      select: { scheduledAt: true, serviceId: true },
      orderBy: { scheduledAt: 'asc' },
    });

    const bookedServiceIds = Array.from(
      new Set(booked.map((item: any) => item.serviceId).filter((id: any) => typeof id === 'string'))
    );
    const bookedServices = bookedServiceIds.length
      ? await (prisma as any).appointmentService.findMany({
          where: { id: { in: bookedServiceIds } },
          select: { id: true, durationMinutes: true },
        })
      : [];
    const durationMap = new Map<string, number>(
      bookedServices.map((item: any) => [item.id, Number(item.durationMinutes || 30)])
    );

    const now = new Date();
    const slotDuration = Number(service.durationMinutes || 30);
    const slots: Array<{ time: string; scheduled_at: string }> = [];
    const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
      aStart < bEnd && bStart < aEnd;

    for (const schedule of schedules) {
      const windowStart = this.timeStringToMinutes(schedule.startTime);
      const windowEnd = this.timeStringToMinutes(schedule.endTime);

      for (let cursor = windowStart; cursor + slotDuration <= windowEnd; cursor += slotDuration) {
        const slotStart = new Date(startDate);
        slotStart.setHours(0, cursor, 0, 0);
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);
        if (slotStart <= now) continue;

        const slotStartMs = slotStart.getTime();
        const slotEndMs = slotEnd.getTime();
        const isBlocked = booked.some((item: any) => {
          const bookedStart = new Date(item.scheduledAt);
          const bookedDuration = Number(durationMap.get(item.serviceId || '') || slotDuration);
          const bookedEnd = new Date(bookedStart);
          bookedEnd.setMinutes(bookedEnd.getMinutes() + bookedDuration);
          return overlaps(slotStartMs, slotEndMs, bookedStart.getTime(), bookedEnd.getTime());
        });

        if (!isBlocked) {
          slots.push({
            time: this.minutesToTimeString(cursor),
            scheduled_at: slotStart.toISOString(),
          });
        }
      }
    }

    return { company, slots };
  }

  async listPublicAppointmentsByDate(slug: string, dateISO?: string, professionalId?: string) {
    const company = await this.getPublicBookingCompany(slug);
    const now = new Date();
    const cleanProfessionalId = String(professionalId || '').trim();

    let startDate = new Date(now);
    let endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);

    if (dateISO) {
      const parsed = new Date(dateISO);
      if (!Number.isNaN(parsed.getTime())) {
        startDate = new Date(parsed);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(parsed);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    const appointments = await (prisma as any).appointment.findMany({
      where: {
        companyId: company.id,
        ...(cleanProfessionalId ? { professionalId: cleanProfessionalId } : {}),
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          notIn: ['cancelado', 'cancelled', 'no_show', 'no-show'],
        },
      },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        customerName: true,
        serviceName: true,
        professionalName: true,
        professionalId: true,
        scheduledAt: true,
        status: true,
      },
    });

    return {
      company,
      appointments: appointments.map((item: any) => ({
        id: item.id,
        customer_name: item.customerName,
        service_name: item.serviceName,
        professional_name: item.professionalName,
        professional_id: item.professionalId,
        scheduled_at: item.scheduledAt,
        status: item.status,
      })),
    };
  }

  async createPublicAppointment(
    slug: string,
    payload: {
      customer_name?: string;
      customer_phone?: string;
      service_id?: string;
      professional_id?: string;
      scheduled_at?: string;
      notes?: string;
    }
  ) {
    const company = await this.getPublicBookingCompany(slug);
    const customerName = String(payload.customer_name || '').trim();
    const customerPhone = String(payload.customer_phone || '').trim();
    const serviceId = String(payload.service_id || '').trim();
    const professionalId = String(payload.professional_id || '').trim();
    const scheduledAtRaw = String(payload.scheduled_at || '').trim();
    const notes = String(payload.notes || '').trim();

    if (!customerName || !serviceId || !professionalId || !scheduledAtRaw) {
      throw new CompanyServiceError(
        'Campos obrigatorios: customer_name, service_id, professional_id, scheduled_at',
        400
      );
    }

    const [service, professional] = await Promise.all([
      (prisma as any).appointmentService.findFirst({
        where: {
          id: serviceId,
          companyId: company.id,
          isActive: true,
        },
        select: { id: true, name: true },
      }),
      prisma.userRole.findFirst({
        where: {
          companyId: company.id,
          userId: professionalId,
          role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
          user: { isActive: true },
        },
        select: {
          userId: true,
          user: { select: { fullName: true } },
        },
      }),
    ]);

    if (!service) {
      throw new CompanyServiceError('Servico invalido para esta empresa', 400);
    }

    if (!professional) {
      throw new CompanyServiceError('Profissional invalido para esta empresa', 400);
    }

    const scheduledAt = new Date(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new CompanyServiceError('Data/hora de agendamento invalida', 400);
    }

    if (scheduledAt.getTime() < Date.now()) {
      throw new CompanyServiceError('Nao e permitido agendar em horario passado', 400);
    }

    const newStart = scheduledAt.getTime();
    const newDuration = Number((service as any).durationMinutes || 30);
    const newEnd = newStart + newDuration * 60 * 1000;
    const dayStart = new Date(scheduledAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledAt);
    dayEnd.setHours(23, 59, 59, 999);

    const booked = await (prisma as any).appointment.findMany({
      where: {
        companyId: company.id,
        professionalId: professional.userId,
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['cancelado', 'cancelled', 'no_show', 'no-show'] },
      },
      select: { id: true, scheduledAt: true, serviceId: true },
    });

    const bookedServiceIds = Array.from(
      new Set(booked.map((item: any) => item.serviceId).filter((id: any) => typeof id === 'string'))
    );
    const bookedServices = bookedServiceIds.length
      ? await (prisma as any).appointmentService.findMany({
          where: { id: { in: bookedServiceIds } },
          select: { id: true, durationMinutes: true },
        })
      : [];
    const durationMap = new Map<string, number>(
      bookedServices.map((item: any) => [item.id, Number(item.durationMinutes || 30)])
    );
    const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
      aStart < bEnd && bStart < aEnd;

    const hasConflict = booked.some((item: any) => {
      const bookedStart = new Date(item.scheduledAt).getTime();
      const bookedDuration = Number(durationMap.get(item.serviceId || '') || newDuration);
      const bookedEnd = bookedStart + bookedDuration * 60 * 1000;
      return overlaps(newStart, newEnd, bookedStart, bookedEnd);
    });

    if (hasConflict) {
      throw new CompanyServiceError('Horario ja reservado, escolha outro', 409);
    }

    const created = await prisma.$transaction(async (tx) => {
      if (customerPhone) {
        const existingCustomer = await tx.customer.findFirst({
          where: { companyId: company.id, phone: customerPhone },
          select: { id: true },
        });

        if (existingCustomer) {
          await tx.customer.update({
            where: { id: existingCustomer.id },
            data: { name: customerName, isActive: true },
          });
        } else {
          await tx.customer.create({
            data: {
              companyId: company.id,
              name: customerName,
              phone: customerPhone,
              isActive: true,
            },
          });
        }
      }

      const appointment = await (tx as any).appointment.create({
        data: {
          companyId: company.id,
          serviceId: service.id,
          professionalId: professional.userId,
          customerName,
          serviceName: service.name,
          professionalName: professional.user.fullName,
          scheduledAt,
          status: 'pendente',
        } as any,
      });

      await tx.auditLog.create({
        data: {
          companyId: company.id,
          action: 'PUBLIC_APPOINTMENT_CREATED',
          resource: 'appointments',
          details: {
            appointmentId: appointment.id,
            customerName,
            customerPhone: customerPhone || null,
            serviceId: service.id,
            serviceName: service.name,
            professionalId: professional.userId,
            professionalName: professional.user.fullName,
            scheduledAt: scheduledAt.toISOString(),
            notes: notes || null,
            source: 'public_link',
          },
        },
      });

      return appointment;
    });

    return {
      id: created.id,
      company_name: company.name,
      customer_name: created.customerName,
      service_name: created.serviceName,
      professional_name: created.professionalName,
      service_id: created.serviceId,
      professional_id: created.professionalId,
      scheduled_at: created.scheduledAt,
      status: created.status,
    };
  }
}

export { CompanyServiceError };
