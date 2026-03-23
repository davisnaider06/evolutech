import { prisma } from '../db';
import { AuthenticatedUser } from '../types';
import { TABLE_CONFIG } from '../config/tableConfig';
import bcrypt from 'bcryptjs';
import { Prisma, TaskStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PaymentService } from './payment.service';
import { decryptSecret, encryptSecret } from '../utils/crypto.util';
import {
  PAYMENT_GATEWAY_CATALOG,
  PAYMENT_GATEWAY_CATALOG_MAP,
  SUPPORTED_PAYMENT_GATEWAYS,
} from '../config/paymentGatewayCatalog';

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
  private companyPlanCache = new Map<string, { plan: string; expiresAt: number }>();
  private companyPlanCacheTtlMs = Number(process.env.COMPANY_PLAN_CACHE_TTL_MS || 30000);
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
    'permissions',
    'permissoes',
    'gateway',
    'gateways',
    'commissions_owner',
    'comissoes_dono',
  ]);
  private defaultCompanyAllowedRoles = ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'];

  private toNumber(value: unknown): number {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private normalizeComparableText(value?: string | null) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private async findDeniedEmployeeModulePermission(
    db: typeof prisma,
    companyId: string,
    userId: string,
    moduleIds: string[]
  ) {
    if (!moduleIds.length) return null;
    const rows = await db.$queryRaw<Array<{ moduloId: string }>>(Prisma.sql`
      SELECT "modulo_id" AS "moduloId"
      FROM "employee_module_permissions"
      WHERE "empresa_id" = ${companyId}
        AND "user_id" = ${userId}
        AND "is_allowed" = false
        AND "modulo_id" IN (${Prisma.join(moduleIds)})
      LIMIT 1
    `);
    return rows[0] || null;
  }

  private async listEmployeeModulePermissionRows(
    db: typeof prisma,
    companyId: string,
    userId: string
  ) {
    return db.$queryRaw<Array<{ moduloId: string; isAllowed: boolean }>>(Prisma.sql`
      SELECT
        "modulo_id" AS "moduloId",
        "is_allowed" AS "isAllowed"
      FROM "employee_module_permissions"
      WHERE "empresa_id" = ${companyId}
        AND "user_id" = ${userId}
    `);
  }

  private async deleteEmployeeModulePermissions(
    db: typeof prisma,
    companyId: string,
    userId: string
  ) {
    await db.$executeRaw(Prisma.sql`
      DELETE FROM "employee_module_permissions"
      WHERE "empresa_id" = ${companyId}
        AND "user_id" = ${userId}
    `);
  }

  private async upsertEmployeeModulePermission(
    db: typeof prisma,
    payload: { companyId: string; userId: string; moduloId: string; isAllowed: boolean }
  ) {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    await db.$executeRaw(Prisma.sql`
      INSERT INTO "employee_module_permissions" (
        "id",
        "empresa_id",
        "user_id",
        "modulo_id",
        "is_allowed",
        "created_at",
        "updated_at"
      )
      VALUES (
        ${id},
        ${payload.companyId},
        ${payload.userId},
        ${payload.moduloId},
        ${payload.isAllowed},
        NOW(),
        NOW()
      )
      ON CONFLICT ("empresa_id", "user_id", "modulo_id")
      DO UPDATE SET
        "is_allowed" = EXCLUDED."is_allowed",
        "updated_at" = NOW()
    `);
  }

  private getModuleCacheKey(
    companyId: string,
    moduleCodes: string[],
    role: AuthenticatedUser['role'],
    userId?: string
  ) {
    const normalized = moduleCodes
      .map((code) => String(code || '').trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join('|');
    return `${companyId}:${role}:${userId || 'anonymous'}:${normalized}`;
  }

  private getCachedModuleAccess(
    companyId: string,
    moduleCodes: string[],
    role: AuthenticatedUser['role'],
    userId?: string
  ) {
    const key = this.getModuleCacheKey(companyId, moduleCodes, role, userId);
    const cached = this.moduleAccessCache.get(key);
    if (!cached) return null;
    if (cached.expiresAt < Date.now()) {
      this.moduleAccessCache.delete(key);
      return null;
    }
    return cached.allowed;
  }

  private setCachedModuleAccess(
    companyId: string,
    moduleCodes: string[],
    role: AuthenticatedUser['role'],
    allowed: boolean,
    userId?: string
  ) {
    const key = this.getModuleCacheKey(companyId, moduleCodes, role, userId);
    this.moduleAccessCache.set(key, {
      allowed,
      expiresAt: Date.now() + this.moduleAccessCacheTtlMs,
    });
  }

  private normalizeCompanyPlan(plan?: string | null) {
    const raw = String(plan || '').trim().toLowerCase();
    if (raw === 'pro' || raw === 'professional' || raw === 'enterprise') return 'pro';
    if (raw === 'start' || raw === 'starter' || raw === 'free') return 'start';
    return 'start';
  }

  private isProPlan(companyPlan: string) {
    return String(companyPlan || '').toLowerCase() === 'pro';
  }

  private async getCompanyPlan(companyId: string) {
    const cached = this.companyPlanCache.get(companyId);
    if (cached && cached.expiresAt > Date.now()) return cached.plan;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { plan: true },
    });
    const plan = this.normalizeCompanyPlan(company?.plan);
    this.companyPlanCache.set(companyId, {
      plan,
      expiresAt: Date.now() + this.companyPlanCacheTtlMs,
    });
    return plan;
  }

  private enforcePlanModuleAccess(companyPlan: string, requestedCodes: string[], matchedModules: any[]) {
    if (this.isProPlan(companyPlan)) return;
    const proOnly = matchedModules.find((item) => Boolean(item?.modulo?.isPro));
    if (!proOnly) return;

    throw new CompanyServiceError(
      `Modulo "${proOnly.modulo?.codigo || requestedCodes[0] || 'modulo'}" disponivel apenas no plano Pro`,
      403
    );
  }

  private enforceRoleModuleAccess(userRole: string, requestedCodes: string[], matchedModules: any[]) {
    const allowed = matchedModules.some((item) => {
      const roles = Array.isArray(item?.allowedRoles) && item.allowedRoles.length > 0
        ? item.allowedRoles
        : Array.isArray(item?.modulo?.allowedRoles) && item.modulo.allowedRoles.length > 0
        ? item.modulo.allowedRoles
        : this.defaultCompanyAllowedRoles;
      return roles.includes(userRole);
    });

    if (!allowed) {
      throw new CompanyServiceError(
        `Modulo "${requestedCodes[0] || 'modulo'}" nao permitido para o perfil atual`,
        403
      );
    }
  }

  private async enforceEmployeePermissionOverride(
    user: AuthenticatedUser,
    companyId: string,
    matchedModules: any[]
  ) {
    if (user.role !== 'FUNCIONARIO_EMPRESA') return;
    if (!matchedModules.length) return;

    const moduleIds = matchedModules
      .map((item) => String(item?.modulo?.id || ''))
      .filter(Boolean);
    if (!moduleIds.length) return;

    const denied = await this.findDeniedEmployeeModulePermission(prisma, companyId, user.id, moduleIds);

    if (denied) {
      throw new CompanyServiceError('Seu acesso a este modulo foi desabilitado pelo dono da empresa', 403);
    }
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
      cash_transactions: (prisma as any).cashTransaction,
      courses: (prisma as any).course,
      course_accesses: (prisma as any).courseAccess,
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

  private async getOrCreateLoyaltySettings(tx: any, companyId: string) {
    const existing = await (tx as any).companyLoyaltySettings.findUnique({
      where: { companyId },
    });
    if (existing) return existing;
    return (tx as any).companyLoyaltySettings.create({
      data: {
        companyId,
        pointsPerService: 1,
        cashbackPercent: 0,
        tenthServiceFree: true,
        pointValue: 1,
        isActive: true,
      },
    });
  }

  private async findCustomerByName(tx: any, companyId: string, customerName?: string | null) {
    const name = String(customerName || '').trim();
    if (!name) return null;
    return tx.customer.findFirst({
      where: {
        companyId,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true, name: true, email: true, phone: true, isActive: true },
    });
  }

  private async getOrCreateLoyaltyProfile(tx: any, companyId: string, customerId: string) {
    const existing = await (tx as any).customerLoyaltyProfile.findFirst({
      where: { companyId, customerId },
    });
    if (existing) return existing;
    return (tx as any).customerLoyaltyProfile.create({
      data: { companyId, customerId },
    });
  }

  private checkAccess(user: AuthenticatedUser, companyId: string) {
    if (this.isAdminRole(user.role)) return true;
    return user.companyId === companyId;
  }

  private resolveCompanyId(user: AuthenticatedUser, queryOrBody: any) {
    const companyId = this.isAdminRole(user.role)
      ? (queryOrBody.company_id || queryOrBody.companyId || user.companyId)
      : user.companyId;

    if (!companyId) throw new CompanyServiceError('Company ID obrigatorio', 400);
    if (!this.checkAccess(user, companyId)) throw new CompanyServiceError('Acesso negado', 403);

    return companyId;
  }

  private async validateModuleAccess(table: string, user: AuthenticatedUser, companyId: string) {
    if (this.isAdminRole(user.role)) return;

    const config = TABLE_CONFIG[table];
    const moduleCodes = config?.moduleCodes || [];
    if (moduleCodes.length === 0) return;
    const companyPlan = await this.getCompanyPlan(companyId);

    if (this.hasOwnerDefaultAccess(user, moduleCodes)) return;
    const cached = this.getCachedModuleAccess(companyId, moduleCodes, user.role, user.id);
    if (cached === true) return;

    const hasModule = await (prisma as any).companyModule.findFirst({
      where: {
        companyId,
        isActive: true,
        modulo: {
          status: 'active',
          codigo: { in: moduleCodes },
        },
      },
      select: {
        id: true,
        allowedRoles: true,
        modulo: {
          select: {
            id: true,
            codigo: true,
            isPro: true,
            allowedRoles: true,
          },
        },
      },
    });

    if (!hasModule) {
      this.setCachedModuleAccess(companyId, moduleCodes, user.role, false, user.id);
      throw new CompanyServiceError(
        `M�dulo "${moduleCodes[0]}" n�o est� ativo para esta empresa`,
        403
      );
    }
    this.enforcePlanModuleAccess(companyPlan, moduleCodes, hasModule ? [hasModule] : []);
    this.enforceRoleModuleAccess(user.role, moduleCodes, hasModule ? [hasModule] : []);
    await this.enforceEmployeePermissionOverride(user, companyId, hasModule ? [hasModule] : []);
    this.setCachedModuleAccess(companyId, moduleCodes, user.role, true, user.id);
  }

  async listTableData(table: string, user: AuthenticatedUser, queryParams: any) {
    const model = this.getModel(table);
    const config = TABLE_CONFIG[table];
    if (!model || !config) throw new CompanyServiceError('Tabela n�o suportada ou n�o configurada', 400);

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

    if (table === 'cash_transactions') {
      const transactionType = String(queryParams.type || '').trim().toLowerCase();
      const category = String(queryParams.category || '').trim();
      const paymentMethod = String(queryParams.payment_method || '').trim().toLowerCase();

      if (transactionType) where.type = transactionType;
      if (category) where.category = category;
      if (paymentMethod) where.paymentMethod = paymentMethod;
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
    if (!model) throw new CompanyServiceError('Tabela n�o suportada', 400);

    const companyId = this.resolveCompanyId(user, data);
    await this.validateModuleAccess(table, user, companyId);
    if (
      (table === 'courses' || table === 'course_accesses') &&
      !['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'].includes(user.role)
    ) {
      throw new CompanyServiceError('Apenas usuarios da empresa podem gerenciar cursos', 403);
    }

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
    if (table === 'cash_transactions') {
      payload.transactionDate = payload.transactionDate || payload.transaction_date
        ? new Date(String(payload.transactionDate || payload.transaction_date))
        : new Date();
      payload.createdBy = user.id;
      delete payload.transaction_date;
      if (!payload.type || !['entrada', 'saida'].includes(String(payload.type))) {
        throw new CompanyServiceError('type invalido. Use entrada ou saida', 400);
      }
      if (!payload.description || !String(payload.description).trim()) {
        throw new CompanyServiceError('description obrigatorio', 400);
      }
      if (this.toNumber(payload.amount) <= 0) {
        throw new CompanyServiceError('amount deve ser maior que zero', 400);
      }
    }

    return model.create({ data: payload });
  }

  async updateRecord(table: string, id: string, user: AuthenticatedUser, data: any) {
    const model = this.getModel(table);
    if (!model) throw new CompanyServiceError('Tabela n�o suportada', 400);

    const existing = await model.findUnique({
      where: { id },
      select: {
        companyId: true,
        ...(table === 'appointments' ? { professionalId: true } : {}),
      },
    });
    if (!existing) throw new CompanyServiceError('Registro n�o encontrado', 404);
    if (!this.checkAccess(user, existing.companyId)) throw new CompanyServiceError('Acesso negado', 403);
    if (
      (table === 'courses' || table === 'course_accesses') &&
      !['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'].includes(user.role)
    ) {
      throw new CompanyServiceError('Apenas usuarios da empresa podem gerenciar cursos', 403);
    }

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
    if (table === 'cash_transactions') {
      if (payload.transaction_date !== undefined || payload.transactionDate !== undefined) {
        payload.transactionDate = new Date(String(payload.transactionDate || payload.transaction_date));
      }
      delete payload.transaction_date;
      if (payload.type !== undefined && !['entrada', 'saida'].includes(String(payload.type))) {
        throw new CompanyServiceError('type invalido. Use entrada ou saida', 400);
      }
      if (payload.amount !== undefined && this.toNumber(payload.amount) <= 0) {
        throw new CompanyServiceError('amount deve ser maior que zero', 400);
      }
    }
    if (table === 'appointments' && user.role === 'FUNCIONARIO_EMPRESA') {
      payload.professionalId = user.id;
      payload.professionalName = user.fullName;
    }
    if (table === 'products' && targetType === 'service') {
      return prisma.$transaction(async (tx) => {
        const current = await tx.product.findUnique({ where: { id } });
        if (!current) throw new CompanyServiceError('Registro n�o encontrado', 404);

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
        if (!current) throw new CompanyServiceError('Registro n�o encontrado', 404);

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
    if (!model) throw new CompanyServiceError('Tabela n�o suportada', 400);

    const existing = await model.findUnique({
      where: { id },
      select: {
        companyId: true,
        ...(table === 'appointments' ? { professionalId: true } : {}),
      },
    });
    if (!existing) throw new CompanyServiceError('Registro n�o encontrado', 404);
    if (!this.checkAccess(user, existing.companyId)) throw new CompanyServiceError('Acesso negado', 403);
    if (
      (table === 'courses' || table === 'course_accesses') &&
      !['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'].includes(user.role)
    ) {
      throw new CompanyServiceError('Apenas usuarios da empresa podem gerenciar cursos', 403);
    }

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

  // Módulo WhatsApp ////////////////////////////

  private normalizePhone(phone: unknown) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) {
      throw new CompanyServiceError('Telefone obrigatorio', 400);
    }
    if (digits.length === 10 || digits.length === 11) {
      return `55${digits}`;
    }
    if (digits.length === 12 || digits.length === 13) {
      return digits;
    }

    throw new CompanyServiceError('Telefone invalido. Use DDD + numero com ou sem codigo do pais', 400);
  }

  async sendWhatsApp(
    user: AuthenticatedUser,
    data: {
      phone?: string;
      message?: string;
      delayMessage?: number;
      company_id?: string;
      companyId?: string;
    }
  ) {
    const requestedCompanyId = String(data?.company_id || data?.companyId || '').trim() || null;
    const companyId = requestedCompanyId || user.companyId || null;

    if (requestedCompanyId && !this.checkAccess(user, requestedCompanyId)) {
      throw new CompanyServiceError('Acesso negado', 403);
    }
    const message = String(data?.message || '').trim();
    if (!message) {
      throw new CompanyServiceError('Mensagem obrigatoria', 400);
    }

    const phone = this.normalizePhone(data?.phone);
    const rawDelay = Number(data?.delayMessage ?? 0);
    const delayMessage = Number.isFinite(rawDelay) ? Math.max(0, rawDelay) : 0;

    const baseUrl = String(process.env.ZAPI_BASE_URL || 'https://api.z-api.io/instances').replace(/\/+$/, '');
    const instanceId = String(process.env.ZAPI_INSTANCE_ID || '').trim();
    const instanceToken = String(process.env.ZAPI_INSTANCE_TOKEN || '').trim();
    const clientToken = String(process.env.ZAPI_CLIENT_TOKEN || '').trim();

    if (!instanceId || !instanceToken) {
      throw new CompanyServiceError(
        'Z-API nao configurada. Defina ZAPI_INSTANCE_ID e ZAPI_INSTANCE_TOKEN no .env',
        500
      );
    }

    const endpoint = `${baseUrl}/${instanceId}/token/${instanceToken}/send-text`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (clientToken) {
      headers['Client-Token'] = clientToken;
    }

    let responseBody: any = null;
    let responseStatus = 0;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone,
          message,
          delayMessage,
        }),
      });

      responseStatus = response.status;
      const raw = await response.text();
      try {
        responseBody = raw ? JSON.parse(raw) : null;
      } catch {
        responseBody = raw || null;
      }

      if (!response.ok) {
        const providerMessage =
          typeof responseBody === 'string'
            ? responseBody
            : responseBody?.message || responseBody?.error || responseBody?.msg || '';
        throw new CompanyServiceError(
          `Falha ao enviar mensagem pela Z-API (status ${response.status})${
            providerMessage ? `: ${String(providerMessage).slice(0, 300)}` : ''
          }`,
          502
        );
      }
    } catch (error) {
      if (error instanceof CompanyServiceError) {
        throw error;
      }
      throw new CompanyServiceError(
        `Erro de comunicacao com a Z-API${error instanceof Error ? `: ${error.message}` : ''}`,
        502
      );
    }

    return {
      success: true,
      provider: 'z-api',
      companyId,
      phone,
      responseStatus,
      response: responseBody,
    };
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
    const companyPlan = await this.getCompanyPlan(companyId);

    if (this.hasOwnerDefaultAccess(user, moduleCodes)) return;
    const cached = this.getCachedModuleAccess(companyId, moduleCodes, user.role, user.id);
    if (cached === true) return;

    const hasModule = await (prisma as any).companyModule.findFirst({
      where: {
        companyId,
        isActive: true,
        modulo: {
          status: 'active',
          codigo: { in: moduleCodes },
        },
      },
      select: {
        id: true,
        modulo: {
          select: {
            id: true,
            codigo: true,
            isPro: true,
            allowedRoles: true,
          },
        },
      },
    });

    if (!hasModule) {
      this.setCachedModuleAccess(companyId, moduleCodes, user.role, false, user.id);
      throw new CompanyServiceError(`Modulo "${moduleCodes[0]}" nao esta ativo para esta empresa`, 403);
    }
    this.enforcePlanModuleAccess(companyPlan, moduleCodes, hasModule ? [hasModule] : []);
    this.enforceRoleModuleAccess(user.role, moduleCodes, hasModule ? [hasModule] : []);
    await this.enforceEmployeePermissionOverride(user, companyId, hasModule ? [hasModule] : []);
    this.setCachedModuleAccess(companyId, moduleCodes, user.role, true, user.id);
  }

  private hasOwnerDefaultAccess(user: AuthenticatedUser, moduleCodes: string[]) {
    if (user.role !== 'DONO_EMPRESA') return false;
    return moduleCodes.some((code) =>
      this.ownerDefaultModuleAliases.has(String(code || '').trim().toLowerCase())
    );
  }

  async getLoyaltySettings(user: AuthenticatedUser, queryParams: { company_id?: string; companyId?: string } = {}) {
    this.ensureOwnerCompanyRole(user);
    const companyId = this.resolveCompanyId(user, queryParams);
    const settings = await this.getOrCreateLoyaltySettings(prisma as any, companyId);
    return {
      company_id: settings.companyId,
      points_per_service: Number(settings.pointsPerService || 1),
      cashback_percent: Number(settings.cashbackPercent || 0),
      tenth_service_free: Boolean(settings.tenthServiceFree),
      point_value: Number(settings.pointValue || 1),
      is_active: Boolean(settings.isActive),
      updated_at: settings.updatedAt,
    };
  }

  async updateLoyaltySettings(
    user: AuthenticatedUser,
    data: {
      company_id?: string;
      points_per_service?: number;
      cashback_percent?: number;
      tenth_service_free?: boolean;
      point_value?: number;
      is_active?: boolean;
    }
  ) {
    this.ensureOwnerCompanyRole(user);
    const companyId = this.resolveCompanyId(user, data);
    const pointsPerService = Math.max(0, Number(data.points_per_service ?? 1));
    const cashbackPercent = Math.max(0, Math.min(100, Number(data.cashback_percent ?? 0)));
    const pointValue = Math.max(0, Number(data.point_value ?? 1));
    const isActive = data.is_active !== false;
    const tenthServiceFree = data.tenth_service_free !== false;

    const updated = await (prisma as any).companyLoyaltySettings.upsert({
      where: { companyId },
      create: {
        companyId,
        pointsPerService,
        cashbackPercent,
        pointValue,
        isActive,
        tenthServiceFree,
      },
      update: {
        pointsPerService,
        cashbackPercent,
        pointValue,
        isActive,
        tenthServiceFree,
      },
    });

    return {
      company_id: updated.companyId,
      points_per_service: Number(updated.pointsPerService || 1),
      cashback_percent: Number(updated.cashbackPercent || 0),
      tenth_service_free: Boolean(updated.tenthServiceFree),
      point_value: Number(updated.pointValue || 1),
      is_active: Boolean(updated.isActive),
      updated_at: updated.updatedAt,
    };
  }

  async getCustomerLoyaltyProfile(
    user: AuthenticatedUser,
    customerId: string,
    queryParams: { company_id?: string; companyId?: string } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['customers', 'clientes']);

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
      select: { id: true, name: true },
    });
    if (!customer) throw new CompanyServiceError('Cliente nao encontrado', 404);

    const [settings, profile, transactions] = await Promise.all([
      this.getOrCreateLoyaltySettings(prisma as any, companyId),
      this.getOrCreateLoyaltyProfile(prisma as any, companyId, customer.id),
      (prisma as any).customerLoyaltyTransaction.findMany({
        where: { companyId, customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      customer: { id: customer.id, name: customer.name },
      settings: {
        points_per_service: Number(settings.pointsPerService || 1),
        cashback_percent: Number(settings.cashbackPercent || 0),
        tenth_service_free: Boolean(settings.tenthServiceFree),
        point_value: Number(settings.pointValue || 1),
      },
      profile: {
        points_balance: this.toNumber(profile.pointsBalance),
        cashback_balance: this.toNumber(profile.cashbackBalance),
        total_points_earned: this.toNumber(profile.totalPointsEarned),
        total_points_redeemed: this.toNumber(profile.totalPointsRedeemed),
        total_cashback_earned: this.toNumber(profile.totalCashbackEarned),
        total_cashback_used: this.toNumber(profile.totalCashbackUsed),
        total_services_count: Number(profile.totalServicesCount || 0),
      },
      transactions: transactions.map((item: any) => ({
        id: item.id,
        transaction_type: item.transactionType,
        points_delta: this.toNumber(item.pointsDelta),
        cashback_delta: this.toNumber(item.cashbackDelta),
        amount_reference: this.toNumber(item.amountReference),
        notes: item.notes || null,
        created_at: item.createdAt,
      })),
    };
  }

  async previewLoyaltyForCheckout(
    user: AuthenticatedUser,
    data: {
      customer_name?: string;
      subtotal?: number;
      service_quantity?: number;
      manual_discount?: number;
      company_id?: string;
    }
  ) {
    const companyId = this.resolveCompanyId(user, data);
    await this.ensureAnyModuleAccess(user, companyId, ['pdv', 'orders', 'pedidos']);
    await this.reconcileCompanySubscriptions(companyId, user.id);

    const subtotal = Math.max(0, Number(data.subtotal || 0));
    const serviceQuantity = Math.max(0, Number(data.service_quantity || 0));
    const manualDiscount = Math.max(0, Number(data.manual_discount || 0));

    const settings = await this.getOrCreateLoyaltySettings(prisma as any, companyId);
    const customer = await this.findCustomerByName(prisma as any, companyId, data.customer_name);
    if (!customer || !settings.isActive) {
      return {
        customer_found: false,
        loyalty_active: Boolean(settings.isActive),
        automatic_discount: 0,
        cashback_to_earn: 0,
        points_to_earn: 0,
        estimated_total: Math.max(0, subtotal - manualDiscount),
      };
    }

    const profile = await this.getOrCreateLoyaltyProfile(prisma as any, companyId, customer.id);
    const cashbackAvailable = this.toNumber(profile.cashbackBalance);
    const remainingAfterManual = Math.max(0, subtotal - manualDiscount);
    const cashbackToUse = Math.min(cashbackAvailable, remainingAfterManual);

    let tenthServiceDiscount = 0;
    if (settings.tenthServiceFree && serviceQuantity > 0) {
      const prior = Number(profile.totalServicesCount || 0);
      const freeCount = Math.max(0, Math.floor((prior + serviceQuantity) / 10) - Math.floor(prior / 10));
      if (freeCount > 0) {
        const avgUnit = serviceQuantity > 0 ? remainingAfterManual / serviceQuantity : 0;
        tenthServiceDiscount = Math.max(0, avgUnit * freeCount);
      }
    }

    const automaticDiscount = Math.min(remainingAfterManual, cashbackToUse + tenthServiceDiscount);
    const estimatedTotal = Math.max(0, remainingAfterManual - automaticDiscount);
    const cashbackToEarn = Number((estimatedTotal * (this.toNumber(settings.cashbackPercent) / 100)).toFixed(2));
    const pointsToEarn = Number((serviceQuantity * Number(settings.pointsPerService || 0)).toFixed(2));

    return {
      customer_found: true,
      loyalty_active: Boolean(settings.isActive),
      customer: { id: customer.id, name: customer.name },
      profile: {
        points_balance: this.toNumber(profile.pointsBalance),
        cashback_balance: cashbackAvailable,
        total_services_count: Number(profile.totalServicesCount || 0),
      },
      automatic_discount: Number(automaticDiscount.toFixed(2)),
      cashback_discount: Number(cashbackToUse.toFixed(2)),
      tenth_service_discount: Number(tenthServiceDiscount.toFixed(2)),
      cashback_to_earn: cashbackToEarn,
      points_to_earn: pointsToEarn,
      estimated_total: Number(estimatedTotal.toFixed(2)),
    };
  }

  async previewPdvCheckout(
    user: AuthenticatedUser,
    data: {
      customer_name?: string;
      subtotal?: number;
      service_quantity?: number;
      manual_discount?: number;
      apply_loyalty?: boolean;
      company_id?: string;
    }
  ) {
    const companyId = this.resolveCompanyId(user, data);
    await this.ensureAnyModuleAccess(user, companyId, ['pdv', 'orders', 'pedidos']);

    const subtotal = Math.max(0, Number(data.subtotal || 0));
    const serviceQuantity = Math.max(0, Number(data.service_quantity || 0));
    const manualDiscount = Math.max(0, Number(data.manual_discount || 0));
    const applyLoyalty = data.apply_loyalty !== false;
    const now = new Date();

    const customer = await this.findCustomerByName(prisma as any, companyId, data.customer_name);
    const settings = await this.getOrCreateLoyaltySettings(prisma as any, companyId);

    const subscription = {
      enabled: false,
      subscription_id: null as string | null,
      plan_name: null as string | null,
      is_unlimited: false,
      covered_services: 0,
      discount: 0,
      remaining_services: null as number | null,
    };

    if (customer && serviceQuantity > 0) {
      const activeSubscription = await (prisma as any).customerSubscription.findFirst({
        where: {
          companyId,
          customerId: customer.id,
          status: 'active',
          startAt: { lte: now },
          endAt: { gte: now },
        },
        include: {
          plan: {
            select: { id: true, name: true, isUnlimited: true },
          },
        },
        orderBy: { endAt: 'asc' },
      });

      if (activeSubscription) {
        const remainingCover = activeSubscription.plan?.isUnlimited
          ? serviceQuantity
          : Math.max(0, Number(activeSubscription.remainingServices ?? 0));
        const coveredServiceQuantity = Math.max(0, Math.min(serviceQuantity, remainingCover));
        const avgServiceUnitPrice = serviceQuantity > 0 ? subtotal / serviceQuantity : 0;
        const subscriptionDiscount = Number((coveredServiceQuantity * avgServiceUnitPrice).toFixed(2));

        subscription.enabled = subscriptionDiscount > 0;
        subscription.subscription_id = activeSubscription.id;
        subscription.plan_name = activeSubscription.plan?.name || null;
        subscription.is_unlimited = Boolean(activeSubscription.plan?.isUnlimited);
        subscription.covered_services = coveredServiceQuantity;
        subscription.discount = subscriptionDiscount;
        subscription.remaining_services = activeSubscription.plan?.isUnlimited
          ? null
          : Math.max(0, Number(activeSubscription.remainingServices ?? 0) - coveredServiceQuantity);
      }
    }

    const loyalty = {
      enabled: false,
      customer_found: Boolean(customer),
      loyalty_active: Boolean(settings.isActive),
      customer: customer ? { id: customer.id, name: customer.name } : null,
      profile: null as null | { points_balance: number; cashback_balance: number; total_services_count: number },
      automatic_discount: 0,
      cashback_discount: 0,
      tenth_service_discount: 0,
      cashback_to_earn: 0,
      points_to_earn: 0,
    };

    if (customer && settings.isActive && applyLoyalty) {
      const profile = await this.getOrCreateLoyaltyProfile(prisma as any, companyId, customer.id);
      const cashbackAvailable = this.toNumber(profile.cashbackBalance);
      const remainingAfterManualAndSubscription = Math.max(
        0,
        subtotal - manualDiscount - Number(subscription.discount || 0)
      );
      const cashbackToUse = Math.min(cashbackAvailable, remainingAfterManualAndSubscription);

      const billableServiceQuantity = Math.max(0, serviceQuantity - Number(subscription.covered_services || 0));
      let tenthServiceDiscount = 0;
      if (settings.tenthServiceFree && billableServiceQuantity > 0) {
        const prior = Number(profile.totalServicesCount || 0);
        const freeCount = Math.max(
          0,
          Math.floor((prior + billableServiceQuantity) / 10) - Math.floor(prior / 10)
        );
        if (freeCount > 0) {
          const avgUnit =
            billableServiceQuantity > 0 ? remainingAfterManualAndSubscription / billableServiceQuantity : 0;
          tenthServiceDiscount = Math.max(0, avgUnit * freeCount);
        }
      }

      const automaticDiscount = Math.min(
        remainingAfterManualAndSubscription,
        cashbackToUse + tenthServiceDiscount
      );
      const estimatedAfterLoyalty = Math.max(0, remainingAfterManualAndSubscription - automaticDiscount);

      loyalty.enabled = automaticDiscount > 0 || billableServiceQuantity > 0;
      loyalty.profile = {
        points_balance: this.toNumber(profile.pointsBalance),
        cashback_balance: cashbackAvailable,
        total_services_count: Number(profile.totalServicesCount || 0),
      };
      loyalty.automatic_discount = Number(automaticDiscount.toFixed(2));
      loyalty.cashback_discount = Number(cashbackToUse.toFixed(2));
      loyalty.tenth_service_discount = Number(tenthServiceDiscount.toFixed(2));
      loyalty.cashback_to_earn = Number(
        (estimatedAfterLoyalty * (this.toNumber(settings.cashbackPercent) / 100)).toFixed(2)
      );
      loyalty.points_to_earn = Number(
        (billableServiceQuantity * Number(settings.pointsPerService || 0)).toFixed(2)
      );
    }

    const totalDiscount = Number(
      (manualDiscount + Number(subscription.discount || 0) + Number(loyalty.automatic_discount || 0)).toFixed(2)
    );
    const estimatedTotal = Number(Math.max(0, subtotal - totalDiscount).toFixed(2));

    return {
      customer_found: Boolean(customer),
      subscription,
      loyalty,
      discounts: {
        manual_discount: Number(manualDiscount.toFixed(2)),
        subscription_discount: Number(Number(subscription.discount || 0).toFixed(2)),
        loyalty_discount: Number(Number(loyalty.automatic_discount || 0).toFixed(2)),
        total_discount: totalDiscount,
      },
      estimated_total: estimatedTotal,
    };
  }

  private normalizeSubscriptionInterval(value?: string) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'monthly' || raw === 'mensal') return 'monthly';
    if (raw === 'quarterly' || raw === 'trimestral') return 'quarterly';
    if (raw === 'yearly' || raw === 'annual' || raw === 'anual') return 'yearly';
    throw new CompanyServiceError('intervalo invalido. Use monthly, quarterly ou yearly', 400);
  }

  private normalizeSubscriptionStatus(value?: string) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw || raw === 'active' || raw === 'ativo') return 'active';
    if (raw === 'pending' || raw === 'pendente') return 'pending';
    if (raw === 'expired' || raw === 'expirado') return 'expired';
    if (raw === 'canceled' || raw === 'cancelado') return 'canceled';
    if (raw === 'suspended' || raw === 'suspenso') return 'suspended';
    throw new CompanyServiceError('status invalido. Use active, pending, expired, canceled ou suspended', 400);
  }

  private calculateSubscriptionEndAt(startAt: Date, interval: 'monthly' | 'quarterly' | 'yearly') {
    const endAt = new Date(startAt);
    if (interval === 'quarterly') {
      endAt.setMonth(endAt.getMonth() + 3);
    } else if (interval === 'yearly') {
      endAt.setFullYear(endAt.getFullYear() + 1);
    } else {
      endAt.setMonth(endAt.getMonth() + 1);
    }
    endAt.setMilliseconds(endAt.getMilliseconds() - 1);
    return endAt;
  }

  private async reconcileCompanySubscriptions(companyId: string, actorUserId?: string | null) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const dueSubscriptions = await (tx as any).customerSubscription.findMany({
        where: {
          companyId,
          status: { in: ['active', 'pending'] },
          endAt: { lt: now },
        },
        include: {
          customer: { select: { id: true, name: true } },
          plan: {
            select: {
              id: true,
              name: true,
              interval: true,
              includedServices: true,
              isUnlimited: true,
              isActive: true,
            },
          },
        },
      });

      let expiredCount = 0;
      let renewedCount = 0;

      for (const item of dueSubscriptions) {
        const canRenew = Boolean(item.autoRenew && item.plan?.isActive);
        if (!canRenew) {
          await (tx as any).customerSubscription.update({
            where: { id: item.id },
            data: { status: 'expired' },
          });
          expiredCount += 1;
          continue;
        }

        const existingFuture = await (tx as any).customerSubscription.findFirst({
          where: {
            companyId,
            customerId: item.customerId,
            planId: item.planId,
            status: { in: ['active', 'pending'] },
            startAt: { gt: item.endAt },
          },
          select: { id: true },
        });

        await (tx as any).customerSubscription.update({
          where: { id: item.id },
          data: { status: 'expired' },
        });
        expiredCount += 1;

        if (existingFuture) continue;

        const startAt = new Date(item.endAt);
        startAt.setMilliseconds(startAt.getMilliseconds() + 1);
        const endAt = this.calculateSubscriptionEndAt(startAt, item.plan.interval);
        const remainingServices = item.plan.isUnlimited
          ? null
          : Math.max(0, Number(item.plan.includedServices || 0));

        const renewed = await (tx as any).customerSubscription.create({
          data: {
            companyId,
            customerId: item.customerId,
            planId: item.planId,
            status: 'active',
            startAt,
            endAt,
            remainingServices,
            autoRenew: true,
            amount: item.amount,
            notes: 'Renovacao automatica',
          },
        });

        const renewalOrder = await tx.order.create({
          data: {
            companyId,
            customerName: item.customer?.name || null,
            status: 'paid',
            total: item.amount,
          },
        });
        await this.syncCompanyMonthlyRevenue(tx, companyId, renewalOrder.createdAt);

        await tx.auditLog.create({
          data: {
            userId: actorUserId || null,
            companyId,
            action: 'SUBSCRIPTION_RENEWED',
            resource: 'customer_subscriptions',
            details: {
              previous_subscription_id: item.id,
              renewed_subscription_id: renewed.id,
              plan_id: item.planId,
              plan_name: item.plan?.name || null,
              customer_id: item.customerId,
              customer_name: item.customer?.name || null,
              renewal_order_id: renewalOrder.id,
              amount: Number(item.amount || 0),
            },
          },
        });

        renewedCount += 1;
      }

      return { expiredCount, renewedCount };
    });
  }

  async listSubscriptionPlans(
    user: AuthenticatedUser,
    queryParams: { company_id?: string; status?: string } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['subscriptions', 'assinaturas']);

    const onlyActive = String(queryParams.status || '').trim().toLowerCase() === 'active';
    const plans = await (prisma as any).subscriptionPlan.findMany({
      where: {
        companyId,
        ...(onlyActive ? { isActive: true } : {}),
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    return plans.map((item: any) => ({
      id: item.id,
      company_id: item.companyId,
      name: item.name,
      description: item.description || null,
      interval: item.interval,
      price: this.toNumber(item.price),
      included_services: item.includedServices ?? null,
      is_unlimited: Boolean(item.isUnlimited),
      is_active: Boolean(item.isActive),
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }));
  }

  async upsertSubscriptionPlan(
    user: AuthenticatedUser,
    data: {
      id?: string;
      company_id?: string;
      name?: string;
      description?: string;
      interval?: string;
      price?: number;
      included_services?: number | null;
      is_unlimited?: boolean;
      is_active?: boolean;
    }
  ) {
    this.ensureOwnerCompanyRole(user);
    const companyId = this.resolveCompanyId(user, data);
    await this.ensureAnyModuleAccess(user, companyId, ['subscriptions', 'assinaturas']);

    const name = String(data.name || '').trim();
    if (!name) throw new CompanyServiceError('name obrigatorio', 400);

    const interval = this.normalizeSubscriptionInterval(data.interval);
    const isUnlimited = Boolean(data.is_unlimited);
    const includedServicesRaw = data.included_services;
    const includedServices = isUnlimited
      ? null
      : Math.max(0, Number(includedServicesRaw ?? 0));

    const payload = {
      companyId,
      name,
      description: String(data.description || '').trim() || null,
      interval,
      price: Math.max(0, Number(data.price || 0)),
      includedServices,
      isUnlimited,
      isActive: data.is_active !== false,
    };

    const planId = String(data.id || '').trim();
    const saved = planId
      ? await (prisma as any).subscriptionPlan.update({
          where: { id: planId },
          data: payload,
        })
      : await (prisma as any).subscriptionPlan.create({
          data: payload,
        });

    return {
      id: saved.id,
      company_id: saved.companyId,
      name: saved.name,
      description: saved.description || null,
      interval: saved.interval,
      price: this.toNumber(saved.price),
      included_services: saved.includedServices ?? null,
      is_unlimited: Boolean(saved.isUnlimited),
      is_active: Boolean(saved.isActive),
      created_at: saved.createdAt,
      updated_at: saved.updatedAt,
    };
  }

  async listCustomerSubscriptions(
    user: AuthenticatedUser,
    queryParams: { company_id?: string; customer_id?: string; status?: string } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['subscriptions', 'assinaturas']);
    await this.reconcileCompanySubscriptions(companyId, user.id);

    const customerId = String(queryParams.customer_id || '').trim();
    const status = String(queryParams.status || '').trim();

    const rows = await (prisma as any).customerSubscription.findMany({
      where: {
        companyId,
        ...(customerId ? { customerId } : {}),
        ...(status ? { status: this.normalizeSubscriptionStatus(status) } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        plan: { select: { id: true, name: true, interval: true, includedServices: true, isUnlimited: true } },
      },
      orderBy: [{ status: 'asc' }, { endAt: 'asc' }],
    });

    return rows.map((item: any) => ({
      id: item.id,
      company_id: item.companyId,
      customer_id: item.customerId,
      customer_name: item.customer?.name || null,
      plan_id: item.planId,
      plan_name: item.plan?.name || null,
      interval: item.plan?.interval || null,
      status: item.status,
      start_at: item.startAt,
      end_at: item.endAt,
      remaining_services: item.remainingServices ?? null,
      is_unlimited: Boolean(item.plan?.isUnlimited),
      amount: this.toNumber(item.amount),
      auto_renew: Boolean(item.autoRenew),
      notes: item.notes || null,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }));
  }

  async upsertCustomerSubscription(
    user: AuthenticatedUser,
    data: {
      id?: string;
      company_id?: string;
      customer_id?: string;
      plan_id?: string;
      start_at?: string;
      auto_renew?: boolean;
      amount?: number;
      notes?: string;
      status?: string;
    }
  ) {
    this.ensureOwnerCompanyRole(user);
    const companyId = this.resolveCompanyId(user, data);
    await this.ensureAnyModuleAccess(user, companyId, ['subscriptions', 'assinaturas']);

    const customerId = String(data.customer_id || '').trim();
    const planId = String(data.plan_id || '').trim();
    if (!customerId || !planId) {
      throw new CompanyServiceError('customer_id e plan_id sao obrigatorios', 400);
    }

    const [customer, plan] = await Promise.all([
      prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } }),
      (prisma as any).subscriptionPlan.findFirst({
        where: { id: planId, companyId, isActive: true },
        select: { id: true, interval: true, includedServices: true, isUnlimited: true, price: true },
      }),
    ]);

    if (!customer) throw new CompanyServiceError('Cliente nao encontrado', 404);
    if (!plan) throw new CompanyServiceError('Plano nao encontrado ou inativo', 404);

    const startAt = data.start_at ? new Date(data.start_at) : new Date();
    if (Number.isNaN(startAt.getTime())) throw new CompanyServiceError('start_at invalido', 400);
    const endAt = this.calculateSubscriptionEndAt(startAt, plan.interval);
    const amount = Math.max(0, Number(data.amount ?? plan.price ?? 0));
    const status = this.normalizeSubscriptionStatus(data.status || 'active');
    const remainingServices = plan.isUnlimited
      ? null
      : Math.max(0, Number(plan.includedServices || 0));

    const payload = {
      companyId,
      customerId,
      planId,
      startAt,
      endAt,
      amount,
      status,
      autoRenew: data.auto_renew !== false,
      notes: String(data.notes || '').trim() || null,
      remainingServices,
    };

    const subscriptionId = String(data.id || '').trim();
    const saved = subscriptionId
      ? await (prisma as any).customerSubscription.update({
          where: { id: subscriptionId },
          data: payload,
        })
      : await (prisma as any).customerSubscription.create({ data: payload });

    return {
      id: saved.id,
      company_id: saved.companyId,
      customer_id: saved.customerId,
      plan_id: saved.planId,
      status: saved.status,
      start_at: saved.startAt,
      end_at: saved.endAt,
      remaining_services: saved.remainingServices ?? null,
      amount: this.toNumber(saved.amount),
      auto_renew: Boolean(saved.autoRenew),
      notes: saved.notes || null,
      created_at: saved.createdAt,
      updated_at: saved.updatedAt,
    };
  }

  async listSubscriptionUsage(
    user: AuthenticatedUser,
    queryParams: {
      company_id?: string;
      customer_id?: string;
      subscription_id?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['subscriptions', 'assinaturas']);
    await this.reconcileCompanySubscriptions(companyId, user.id);

    const customerId = String(queryParams.customer_id || '').trim();
    const subscriptionId = String(queryParams.subscription_id || '').trim();
    const page = Math.max(1, Number(queryParams.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(queryParams.pageSize || 20)));

    const where: any = { companyId };
    if (subscriptionId) where.subscriptionId = subscriptionId;
    if (customerId) where.subscription = { customerId };
    if (queryParams.dateFrom || queryParams.dateTo) {
      where.usedAt = {};
      if (queryParams.dateFrom) where.usedAt.gte = new Date(String(queryParams.dateFrom));
      if (queryParams.dateTo) where.usedAt.lte = new Date(String(queryParams.dateTo));
    }

    const [rows, total] = await Promise.all([
      (prisma as any).subscriptionUsage.findMany({
        where,
        include: {
          subscription: {
            select: {
              id: true,
              customerId: true,
              customer: { select: { id: true, name: true, email: true, phone: true } },
              plan: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { usedAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      (prisma as any).subscriptionUsage.count({ where }),
    ]);

    return {
      data: rows.map((item: any) => ({
        id: item.id,
        company_id: item.companyId,
        subscription_id: item.subscriptionId,
        customer_id: item.subscription?.customerId || null,
        customer_name: item.subscription?.customer?.name || null,
        plan_id: item.subscription?.plan?.id || null,
        plan_name: item.subscription?.plan?.name || null,
        order_id: item.orderId || null,
        service_id: item.serviceId || null,
        service_name: item.serviceName || null,
        quantity: Number(item.quantity || 0),
        amount_discounted: this.toNumber(item.amountDiscounted),
        used_at: item.usedAt,
        created_by_user_id: item.createdByUserId || null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getCoursesOverview(
    user: AuthenticatedUser,
    queryParams: { company_id?: string; companyId?: string; dateFrom?: string; dateTo?: string } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['courses', 'cursos']);
    this.ensureOwnerCompanyRole(user);

    const accessWhere: any = { companyId };
    if (queryParams.dateFrom || queryParams.dateTo) {
      accessWhere.createdAt = {};
      if (queryParams.dateFrom) accessWhere.createdAt.gte = new Date(String(queryParams.dateFrom));
      if (queryParams.dateTo) accessWhere.createdAt.lte = new Date(String(queryParams.dateTo));
    }

    const [courses, accesses] = await Promise.all([
      (prisma as any).course.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      }),
      (prisma as any).courseAccess.findMany({
        where: accessWhere,
        include: {
          course: {
            select: {
              id: true,
              title: true,
              price: true,
              isActive: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const metricsByCourse = new Map<
      string,
      {
        sales_count: number;
        active_sales: number;
        pending_sales: number;
        canceled_sales: number;
        expired_sales: number;
        revenue_confirmed: number;
        revenue_pending: number;
        last_sale_at: Date | null;
      }
    >();

    let confirmedRevenue = 0;
    let pendingRevenue = 0;
    let activeSales = 0;
    let pendingSales = 0;

    for (const access of accesses) {
      const courseId = String(access.courseId || '');
      const status = String(access.status || '').toLowerCase();
      const amountPaid = this.toNumber(access.amountPaid);
      const current =
        metricsByCourse.get(courseId) || {
          sales_count: 0,
          active_sales: 0,
          pending_sales: 0,
          canceled_sales: 0,
          expired_sales: 0,
          revenue_confirmed: 0,
          revenue_pending: 0,
          last_sale_at: null,
        };

      current.sales_count += 1;
      if (!current.last_sale_at || new Date(access.createdAt).getTime() > current.last_sale_at.getTime()) {
        current.last_sale_at = access.createdAt;
      }

      if (status === 'active') {
        current.active_sales += 1;
        current.revenue_confirmed += amountPaid;
        confirmedRevenue += amountPaid;
        activeSales += 1;
      } else if (status === 'pending') {
        current.pending_sales += 1;
        current.revenue_pending += amountPaid;
        pendingRevenue += amountPaid;
        pendingSales += 1;
      } else if (status === 'canceled') {
        current.canceled_sales += 1;
      } else if (status === 'expired') {
        current.expired_sales += 1;
      }

      metricsByCourse.set(courseId, current);
    }

    return {
      summary: {
        total_courses: courses.length,
        active_courses: courses.filter((item: any) => Boolean(item.isActive)).length,
        total_sales: accesses.length,
        active_sales: activeSales,
        pending_sales: pendingSales,
        confirmed_revenue: confirmedRevenue,
        pending_revenue: pendingRevenue,
      },
      courses: courses.map((course: any) => {
        const metrics = metricsByCourse.get(course.id) || {
          sales_count: 0,
          active_sales: 0,
          pending_sales: 0,
          canceled_sales: 0,
          expired_sales: 0,
          revenue_confirmed: 0,
          revenue_pending: 0,
          last_sale_at: null,
        };

        return {
          id: course.id,
          title: course.title,
          description: course.description,
          content_type: course.contentType || 'video',
          content_url: course.contentUrl || null,
          cover_image_url: course.coverImageUrl || null,
          price: this.toNumber(course.price),
          is_active: Boolean(course.isActive),
          created_at: course.createdAt,
          updated_at: course.updatedAt,
          sales_count: metrics.sales_count,
          active_sales: metrics.active_sales,
          pending_sales: metrics.pending_sales,
          canceled_sales: metrics.canceled_sales,
          expired_sales: metrics.expired_sales,
          revenue_confirmed: metrics.revenue_confirmed,
          revenue_pending: metrics.revenue_pending,
          last_sale_at: metrics.last_sale_at,
        };
      }),
      recent_sales: accesses.map((item: any) => ({
        id: item.id,
        status: item.status,
        amount_paid: this.toNumber(item.amountPaid),
        start_at: item.startAt,
        end_at: item.endAt,
        created_at: item.createdAt,
        customer: item.customer
          ? {
              id: item.customer.id,
              name: item.customer.name,
              email: item.customer.email || null,
            }
          : null,
        course: item.course
          ? {
              id: item.course.id,
              title: item.course.title,
              price: this.toNumber(item.course.price),
              is_active: Boolean(item.course.isActive),
            }
          : null,
      })),
    };
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

  private parseReferenceDate(raw?: string) {
    const value = String(raw || '').trim();
    if (!value) {
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      return now;
    }

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new CompanyServiceError('referenceDate invalida. Use YYYY-MM-DD', 400);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (Number.isNaN(parsed.getTime())) {
      throw new CompanyServiceError('referenceDate invalida. Use YYYY-MM-DD', 400);
    }
    return parsed;
  }

  private parseSpecificDayRange(raw?: string) {
    const value = String(raw || '').trim();
    if (!value) return null;

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new CompanyServiceError('day invalido. Use YYYY-MM-DD', 400);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (Number.isNaN(start.getTime())) {
      throw new CompanyServiceError('day invalido. Use YYYY-MM-DD', 400);
    }

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private parsePeriodGroup(raw?: string) {
    const normalized = String(raw || 'daily').trim().toLowerCase();
    if (normalized === 'monthly' || normalized === 'yearly') {
      return normalized;
    }
    return 'daily';
  }

  private buildGroupedTimeline(
    start: Date,
    end: Date,
    periodGroup: 'daily' | 'monthly' | 'yearly'
  ) {
    const timeline = new Map<string, { label: string; paid: number; pending: number; revenue: number }>();

    if (periodGroup === 'yearly') {
      const cursor = new Date(start.getFullYear(), 0, 1, 0, 0, 0, 0);
      const limit = new Date(end.getFullYear(), 0, 1, 0, 0, 0, 0);
      while (cursor <= limit) {
        const year = cursor.getFullYear();
        const key = String(year);
        timeline.set(key, { label: key, paid: 0, pending: 0, revenue: 0 });
        cursor.setFullYear(cursor.getFullYear() + 1);
      }
      return timeline;
    }

    if (periodGroup === 'monthly') {
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 0, 0, 0, 0);
      const limit = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);
      while (cursor <= limit) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth() + 1;
        const key = `${year}-${String(month).padStart(2, '0')}`;
        const label = cursor.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        timeline.set(key, { label, paid: 0, pending: 0, revenue: 0 });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return timeline;
    }

    const cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      timeline.set(key, { label: key.slice(5), paid: 0, pending: 0, revenue: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return timeline;
  }

  private getTimelineKey(date: Date, periodGroup: 'daily' | 'monthly' | 'yearly') {
    if (periodGroup === 'yearly') {
      return String(date.getFullYear());
    }
    if (periodGroup === 'monthly') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    return date.toISOString().slice(0, 10);
  }

  private getNamedPeriodBounds(referenceDate: Date, period: 'day' | 'week' | 'month' | 'year') {
    const start = new Date(referenceDate);
    const end = new Date(referenceDate);

    if (period === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (period === 'week') {
      const weekday = referenceDate.getDay();
      const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;
      start.setDate(referenceDate.getDate() + offsetToMonday);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (period === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
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
    queryParams: {
      dateFrom?: string;
      dateTo?: string;
      company_id?: string;
      companyId?: string;
      customer?: string;
      service?: string;
      day?: string;
      period_group?: string;
    } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['relatorios', 'reports']);
    const specificDayRange = this.parseSpecificDayRange(queryParams.day);
    const { start, end } = specificDayRange || this.parseDateRange(queryParams, 30);
    const customerFilter = this.normalizeComparableText(queryParams.customer);
    const serviceFilter = this.normalizeComparableText(queryParams.service);
    const periodGroup = this.parsePeriodGroup(queryParams.period_group);

    const [customersTotal, productsTotal, customersInRangeCount, ordersInRange, appointmentsGroupedByStatus, pdvLogs] =
      await Promise.all([
        prisma.customer.count({ where: { companyId } }),
        prisma.product.count({ where: { companyId, isActive: true } }),
        prisma.customer.count({
          where: { companyId, createdAt: { gte: start, lte: end } },
        }),
        prisma.order.findMany({
          where: { companyId, createdAt: { gte: start, lte: end } },
          select: { id: true, status: true, total: true, createdAt: true, customerName: true },
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

    const pdvLogMap = new Map<
      string,
      {
        services: string[];
        items: Array<{ itemType: 'product' | 'service'; itemName: string; quantity: number; revenue: number }>;
      }
    >();
    for (const log of pdvLogs) {
      const details = (log.details || {}) as any;
      const orderId = String(details?.orderId || '').trim();
      if (!orderId) continue;
      const items = Array.isArray(details?.items) ? details.items : [];
      pdvLogMap.set(orderId, {
        services: items
          .filter((item: any) => String(item?.itemType || '').trim().toLowerCase() === 'service')
          .map((item: any) => this.normalizeComparableText(item?.itemName))
          .filter(Boolean),
        items: items.map((item: any) => ({
          itemType: item?.itemType === 'service' ? 'service' : 'product',
          itemName: String(item?.itemName || '').trim(),
          quantity: Number(item?.quantity || 0),
          revenue: Number(item?.lineTotal || 0),
        })),
      });
    }

    const filteredOrders = ordersInRange.filter((order) => {
      if (customerFilter && !this.normalizeComparableText(order.customerName).includes(customerFilter)) {
        return false;
      }
      if (serviceFilter) {
        const log = pdvLogMap.get(String(order.id));
        if (!log || !log.services.some((serviceName) => serviceName.includes(serviceFilter))) {
          return false;
        }
      }
      return true;
    });

    const paidOrders = filteredOrders.filter((order) => String(order.status).toLowerCase() === 'paid');
    const totalRevenue = paidOrders.reduce((sum, order) => sum + this.toNumber(order.total), 0);

    const ordersByStatusMap = new Map<string, number>();
    for (const order of filteredOrders) {
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

    const timeline = this.buildGroupedTimeline(start, end, periodGroup);
    for (const order of paidOrders) {
      const key = this.getTimelineKey(order.createdAt, periodGroup);
      const current = timeline.get(key);
      if (!current) continue;
      current.revenue += this.toNumber(order.total);
      timeline.set(key, current);
    }

    const topItemsMap = new Map<
      string,
      { itemType: 'product' | 'service'; itemName: string; quantity: number; revenue: number }
    >();
    for (const order of paidOrders) {
      const log = pdvLogMap.get(String(order.id));
      const items = log?.items || [];
      for (const item of items) {
        const itemType = item.itemType;
        const itemName = item.itemName;
        if (!itemName) continue;
        const quantity = Number(item.quantity || 0);
        const revenue = Number(item.revenue || 0);
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
      filters: {
        customer: customerFilter ? String(queryParams.customer || '').trim() : null,
        service: serviceFilter ? String(queryParams.service || '').trim() : null,
        day: specificDayRange ? String(queryParams.day || '').trim() : null,
        period_group: periodGroup,
      },
      summary: {
        customers_total: customersTotal,
        products_total: productsTotal,
        new_customers: customersInRangeCount,
        orders_total: filteredOrders.length,
        paid_orders: paidOrders.length,
        appointments_total: appointmentsTotal,
        revenue_total: totalRevenue,
      },
      charts: {
        revenue_by_day: Array.from(timeline.entries()).map(([date, values]) => ({ date, revenue: values.revenue })),
        revenue_by_period: Array.from(timeline.entries()).map(([date, values]) => ({
          date,
          label: values.label,
          revenue: values.revenue,
        })),
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

  async exportCommissionsExcel(
    user: AuthenticatedUser,
    queryParams: { month?: string; professional_id?: string; company_id?: string; companyId?: string } = {}
  ) {
    this.ensureOwnerCompanyRole(user);
    const result = await this.getCommissionsOverview(user, queryParams);
    const rows = (Array.isArray(result.data) ? result.data : []).map((row: any) => ({
      Mes: result.period.month,
      Profissional: row.professional_name || '',
      Email: row.professional_email || '',
      Cargo: row.role || '',
      ReceitaServicos: Number(row.service_revenue || 0),
      ReceitaProdutos: Number(row.product_revenue || 0),
      PercentualServicos: Number(row.service_commission_pct || 0),
      PercentualProdutos: Number(row.product_commission_pct || 0),
      FixoMensal: Number(row.monthly_fixed_amount || 0),
      Ajustes: Number(row.monthly_adjustments || 0),
      ComissaoServicos: Number(row.service_commission_amount || 0),
      ComissaoProdutos: Number(row.product_commission_amount || 0),
      ComissaoTotal: Number(row.total_commission || 0),
      StatusPagamento: row.payout_status || 'pending',
      ValorPago: Number(row.amount_paid || 0),
      ValorPendente: Number(row.amount_pending || 0),
      PagoEm: row.paid_at ? new Date(row.paid_at).toISOString() : '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 28 },
      { wch: 30 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 24 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Comissoes');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
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
      applyLoyalty?: boolean;
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
    await this.reconcileCompanySubscriptions(companyId, user.id);

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
      const customerNameNormalized = String(data.customerName || '').trim();
      const customerForSale = customerNameNormalized
        ? await this.findCustomerByName(tx as any, companyId, customerNameNormalized)
        : null;
      const serviceQuantity = soldItems
        .filter((item) => item.itemType === 'service')
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

      let subscriptionDiscount = 0;
      const subscriptionUsageDrafts: Array<{
        subscriptionId: string;
        serviceId: string;
        serviceName: string;
        quantity: number;
        amountDiscounted: number;
      }> = [];
      let coveredServiceQuantity = 0;
      let subscriptionSummary = {
        enabled: false,
        subscriptionId: null as string | null,
        planName: null as string | null,
        isUnlimited: false,
        coveredServices: 0,
        discount: 0,
        remainingServices: null as number | null,
      };

      if (customerForSale && serviceQuantity > 0) {
        const activeSubscription = await (tx as any).customerSubscription.findFirst({
          where: {
            companyId,
            customerId: customerForSale.id,
            status: 'active',
            startAt: { lte: new Date() },
            endAt: { gte: new Date() },
          },
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                isUnlimited: true,
              },
            },
          },
          orderBy: { endAt: 'asc' },
        });

        if (activeSubscription) {
          let remainingCover = activeSubscription.plan?.isUnlimited
            ? serviceQuantity
            : Math.max(0, Number(activeSubscription.remainingServices ?? 0));

          for (const item of soldItems) {
            if (item.itemType !== 'service' || remainingCover <= 0) continue;
            const coveredQty = Math.min(item.quantity, remainingCover);
            if (coveredQty <= 0) continue;
            const discountValue = Number((coveredQty * item.unitPrice).toFixed(2));
            subscriptionDiscount += discountValue;
            coveredServiceQuantity += coveredQty;
            remainingCover -= coveredQty;

            subscriptionUsageDrafts.push({
              subscriptionId: activeSubscription.id,
              serviceId: item.itemId,
              serviceName: item.itemName,
              quantity: coveredQty,
              amountDiscounted: discountValue,
            });
          }

          if (!activeSubscription.plan?.isUnlimited && coveredServiceQuantity > 0) {
            const nextRemaining = Math.max(0, Number(activeSubscription.remainingServices ?? 0) - coveredServiceQuantity);
            await (tx as any).customerSubscription.update({
              where: { id: activeSubscription.id },
              data: { remainingServices: nextRemaining },
            });
            subscriptionSummary.remainingServices = nextRemaining;
          }

          subscriptionSummary = {
            enabled: subscriptionDiscount > 0,
            subscriptionId: activeSubscription.id,
            planName: activeSubscription.plan?.name || null,
            isUnlimited: Boolean(activeSubscription.plan?.isUnlimited),
            coveredServices: coveredServiceQuantity,
            discount: Number(subscriptionDiscount.toFixed(2)),
            remainingServices: subscriptionSummary.remainingServices,
          };
        }
      }
      const manualDiscount = Math.max(0, Number(data.discount || 0));
      const billableServiceQuantity = Math.max(0, serviceQuantity - coveredServiceQuantity);
      const applyLoyalty = data.applyLoyalty !== false;

      let loyaltySummary = {
        enabled: false,
        customerId: null as string | null,
        customerName: null as string | null,
        pointsEarned: 0,
        cashbackEarned: 0,
        cashbackRedeemed: 0,
        tenthServiceDiscount: 0,
        automaticDiscount: 0,
      };

      if (applyLoyalty && customerForSale) {
        const settings = await this.getOrCreateLoyaltySettings(tx as any, companyId);
        const customer = customerForSale;

        if (settings.isActive && customer) {
          const profile = await this.getOrCreateLoyaltyProfile(tx as any, companyId, customer.id);
          const cashbackAvailable = this.toNumber(profile.cashbackBalance);
          const remainingAfterManual = Math.max(0, subtotal - manualDiscount - subscriptionDiscount);
          const cashbackToUse = Math.min(cashbackAvailable, remainingAfterManual);

          let tenthServiceDiscount = 0;
          if (settings.tenthServiceFree && billableServiceQuantity > 0) {
            const prior = Number(profile.totalServicesCount || 0);
            const freeCount = Math.max(
              0,
              Math.floor((prior + billableServiceQuantity) / 10) - Math.floor(prior / 10)
            );
            if (freeCount > 0) {
              const avgUnit =
                billableServiceQuantity > 0 ? remainingAfterManual / billableServiceQuantity : 0;
              tenthServiceDiscount = Math.max(0, avgUnit * freeCount);
            }
          }

          const automaticDiscount = Math.min(remainingAfterManual, cashbackToUse + tenthServiceDiscount);
          const baseAfterDiscount = Math.max(0, remainingAfterManual - automaticDiscount);
          const cashbackEarned = Number((baseAfterDiscount * (this.toNumber(settings.cashbackPercent) / 100)).toFixed(2));
          const pointsEarned = Number(
            (billableServiceQuantity * Number(settings.pointsPerService || 0)).toFixed(2)
          );

          const profileUpdateData: any = {};
          const netCashback = Number((cashbackEarned - cashbackToUse).toFixed(2));
          if (netCashback > 0) {
            profileUpdateData.cashbackBalance = { increment: netCashback };
          } else if (netCashback < 0) {
            profileUpdateData.cashbackBalance = { decrement: Math.abs(netCashback) };
          }
          if (cashbackToUse > 0) {
            profileUpdateData.totalCashbackUsed = { increment: cashbackToUse };
          }
          if (cashbackEarned > 0) {
            profileUpdateData.totalCashbackEarned = { increment: cashbackEarned };
          }
          if (pointsEarned > 0) {
            profileUpdateData.pointsBalance = { increment: pointsEarned };
            profileUpdateData.totalPointsEarned = { increment: pointsEarned };
          }
          if (billableServiceQuantity > 0) {
            profileUpdateData.totalServicesCount = { increment: billableServiceQuantity };
          }

          if (Object.keys(profileUpdateData).length > 0) {
            await (tx as any).customerLoyaltyProfile.update({
              where: { id: profile.id },
              data: profileUpdateData,
            });
          }

          if (cashbackToUse > 0) {
            await (tx as any).customerLoyaltyTransaction.create({
              data: {
                companyId,
                customerId: customer.id,
                profileId: profile.id,
                orderId: null,
                transactionType: 'redeem_cashback',
                pointsDelta: 0,
                cashbackDelta: -cashbackToUse,
                amountReference: cashbackToUse,
                notes: 'Cashback usado no checkout PDV',
                createdByUserId: user.id,
              },
            });
          }

          if (tenthServiceDiscount > 0) {
            await (tx as any).customerLoyaltyTransaction.create({
              data: {
                companyId,
                customerId: customer.id,
                profileId: profile.id,
                orderId: null,
                transactionType: 'tenth_service_discount',
                pointsDelta: 0,
                cashbackDelta: 0,
                amountReference: tenthServiceDiscount,
                notes: 'Desconto automatico por 10o servico',
                createdByUserId: user.id,
              },
            });
          }

          if (cashbackEarned > 0) {
            await (tx as any).customerLoyaltyTransaction.create({
              data: {
                companyId,
                customerId: customer.id,
                profileId: profile.id,
                orderId: null,
                transactionType: 'earn_cashback',
                pointsDelta: 0,
                cashbackDelta: cashbackEarned,
                amountReference: baseAfterDiscount,
                notes: 'Cashback ganho em compra no PDV',
                createdByUserId: user.id,
              },
            });
          }

          if (pointsEarned > 0) {
            await (tx as any).customerLoyaltyTransaction.create({
              data: {
                companyId,
                customerId: customer.id,
                profileId: profile.id,
                orderId: null,
                transactionType: 'earn_points',
                pointsDelta: pointsEarned,
                cashbackDelta: 0,
                amountReference: baseAfterDiscount,
                notes: 'Pontos ganhos por servicos no PDV',
                createdByUserId: user.id,
              },
            });
          }

          loyaltySummary = {
            enabled: true,
            customerId: customer.id,
            customerName: customer.name,
            pointsEarned,
            cashbackEarned,
            cashbackRedeemed: Number(cashbackToUse.toFixed(2)),
            tenthServiceDiscount: Number(tenthServiceDiscount.toFixed(2)),
            automaticDiscount: Number(automaticDiscount.toFixed(2)),
          };
        }
      }

      const discount = Number(
        (manualDiscount + subscriptionDiscount + loyaltySummary.automaticDiscount).toFixed(2)
      );
      const total = Math.max(0, Number((subtotal - discount).toFixed(2)));

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

      if (subscriptionUsageDrafts.length > 0) {
        await (tx as any).subscriptionUsage.createMany({
          data: subscriptionUsageDrafts.map((usage) => ({
            companyId,
            subscriptionId: usage.subscriptionId,
            orderId: order.id,
            serviceId: usage.serviceId,
            serviceName: usage.serviceName,
            quantity: usage.quantity,
            amountDiscounted: usage.amountDiscounted,
            createdByUserId: user.id,
          })),
        });
      }

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
            manualDiscount,
            discount,
            subscription: subscriptionSummary,
            loyalty: loyaltySummary,
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
          manualDiscount,
          subscription: subscriptionSummary,
          loyalty: loyaltySummary,
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
    await this.ensureAnyModuleAccess(user, companyId, ['collections', 'billing', 'cobrancas']);
    await this.autoMarkOverdueCharges(companyId);

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
    await this.ensureAnyModuleAccess(user, companyId, ['collections', 'billing', 'cobrancas']);

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

  private getCollectionReminderSteps() {
    return [
      { code: 'd0', daysAfterDue: 0 },
      { code: 'd3', daysAfterDue: 3 },
      { code: 'd7', daysAfterDue: 7 },
      { code: 'd15', daysAfterDue: 15 },
    ];
  }

  private addDays(baseDate: Date, days: number) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + days);
    return date;
  }

  private async autoMarkOverdueCharges(companyId: string) {
    await (prisma as any).billingCharge.updateMany({
      where: {
        companyId,
        status: 'pending',
        dueDate: { lt: new Date() },
      },
      data: { status: 'overdue' },
    });
  }

  private buildReminderMessage(
    charge: { title: string; amount: unknown; dueDate: Date | null; customerName: string },
    stepCode: string
  ) {
    const amount = Number(charge.amount || 0).toFixed(2).replace('.', ',');
    const dueDate = charge.dueDate ? charge.dueDate.toLocaleDateString('pt-BR') : 'sem vencimento';
    return `Olá ${charge.customerName}, sua cobrança "${charge.title}" no valor de R$ ${amount} venceu em ${dueDate}. Etapa ${stepCode}.`;
  }


  private getReminderRetryDelaysMinutes() {
    const parsed = String(process.env.COLLECTIONS_RETRY_DELAYS_MINUTES || '5,30,120')
      .split(',')
      .map((item) => Number(String(item).trim()))
      .filter((item) => Number.isFinite(item) && item > 0);
    return parsed.length > 0 ? parsed : [5, 30, 120];
  }

  private getNextReminderRetryAt(attemptCount: number, referenceDate = new Date()) {
    const retryDelays = this.getReminderRetryDelaysMinutes();
    const delayMinutes = retryDelays[attemptCount - 1];
    if (!delayMinutes) return null;
    return new Date(referenceDate.getTime() + delayMinutes * 60 * 1000);
  }

  private createCollectionsSystemUser(companyId: string | null = null): AuthenticatedUser {
    return {
      id: 'collections-system',
      email: 'collections-system@evolutech.local',
      fullName: 'Collections System',
      role: 'SUPER_ADMIN_EVOLUTECH',
      companyId,
      companyName: null,
    };
  }

  private async createCollectionsExecutionLog(data: {
    companyId: string;
    triggerSource: string;
    dryRun: boolean;
    sendNow: boolean;
    chargesAnalyzed?: number;
    remindersCreated?: number;
    remindersSent?: number;
    remindersFailed?: number;
    remindersRetried?: number;
    processedScheduled?: number;
    status?: string;
    errorMessage?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    return (prisma as any).collectionAutomationRun.create({
      data: {
        companyId: data.companyId,
        triggerSource: data.triggerSource,
        dryRun: data.dryRun,
        sendNow: data.sendNow,
        chargesAnalyzed: Number(data.chargesAnalyzed || 0),
        remindersCreated: Number(data.remindersCreated || 0),
        remindersSent: Number(data.remindersSent || 0),
        remindersFailed: Number(data.remindersFailed || 0),
        remindersRetried: Number(data.remindersRetried || 0),
        processedScheduled: Number(data.processedScheduled || 0),
        status: String(data.status || 'completed'),
        errorMessage: data.errorMessage || null,
        metadata: data.metadata || null,
      },
    });
  }

  private async executeReminderSend(
    reminderId: string,
    companyId: string,
    options?: {
      actorUserId?: string | null;
      triggerSource?: string;
    }
  ) {
    const triggerSource = String(options?.triggerSource || 'manual').trim() || 'manual';
    const reminder = await (prisma as any).billingReminder.findFirst({
      where: { id: reminderId, companyId },
      include: {
        billingCharge: {
          select: {
            id: true,
            title: true,
            customerName: true,
            customerPhone: true,
            amount: true,
            dueDate: true,
            status: true,
          },
        },
      },
    });

    if (!reminder) {
      throw new CompanyServiceError('Lembrete nao encontrado', 404);
    }
    if (reminder.status === 'canceled') {
      throw new CompanyServiceError('Lembrete cancelado nao pode ser enviado', 400);
    }
    if (reminder.billingCharge?.status === 'paid') {
      throw new CompanyServiceError('Cobranca paga nao pode receber lembrete', 400);
    }

    const now = new Date();
    const attemptCount = Number(reminder.attemptCount || 0) + 1;

    await (prisma as any).billingReminder.update({
      where: { id: reminder.id },
      data: {
        status: 'processing',
        errorMessage: null,
        lastAttemptAt: now,
        attemptCount,
        nextRetryAt: null,
      },
    });

    const phone = String(reminder.billingCharge?.customerPhone || '').trim();
    if (!phone) {
      const nextRetryAt = this.getNextReminderRetryAt(attemptCount, now);
      const failed = await (prisma as any).billingReminder.update({
        where: { id: reminder.id },
        data: {
          status: 'failed',
          errorMessage: 'Cliente sem telefone para WhatsApp',
          nextRetryAt,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: options?.actorUserId || null,
          companyId,
          action: 'COLLECTIONS_REMINDER_SEND_ATTEMPT',
          resource: 'billing_reminders',
          details: {
            reminderId: failed.id,
            billingChargeId: failed.billingChargeId,
            triggerSource,
            result: 'failed',
            attemptCount,
            nextRetryAt: nextRetryAt?.toISOString() || null,
            error: failed.errorMessage,
          },
        },
      });

      return {
        id: failed.id,
        billing_charge_id: failed.billingChargeId,
        status: failed.status,
        sent_at: failed.sentAt,
        error_message: failed.errorMessage,
        next_retry_at: failed.nextRetryAt,
        attempt_count: failed.attemptCount,
      };
    }

    try {
      await this.sendWhatsApp(this.createCollectionsSystemUser(companyId), {
        company_id: companyId,
        phone,
        message: this.buildReminderMessage(reminder.billingCharge, reminder.stepCode),
      });

      const sent = await (prisma as any).billingReminder.update({
        where: { id: reminder.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          errorMessage: null,
          nextRetryAt: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: options?.actorUserId || null,
          companyId,
          action: 'COLLECTIONS_REMINDER_SEND_ATTEMPT',
          resource: 'billing_reminders',
          details: {
            reminderId: sent.id,
            billingChargeId: sent.billingChargeId,
            triggerSource,
            result: 'sent',
            attemptCount,
          },
        },
      });

      return {
        id: sent.id,
        billing_charge_id: sent.billingChargeId,
        status: sent.status,
        sent_at: sent.sentAt,
        error_message: sent.errorMessage,
        next_retry_at: sent.nextRetryAt,
        attempt_count: sent.attemptCount,
      };
    } catch (error: any) {
      const nextRetryAt = this.getNextReminderRetryAt(attemptCount, now);
      const failed = await (prisma as any).billingReminder.update({
        where: { id: reminder.id },
        data: {
          status: 'failed',
          errorMessage: String(error?.message || 'Falha ao enviar WhatsApp').slice(0, 500),
          nextRetryAt,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: options?.actorUserId || null,
          companyId,
          action: 'COLLECTIONS_REMINDER_SEND_ATTEMPT',
          resource: 'billing_reminders',
          details: {
            reminderId: failed.id,
            billingChargeId: failed.billingChargeId,
            triggerSource,
            result: 'failed',
            attemptCount,
            nextRetryAt: nextRetryAt?.toISOString() || null,
            error: failed.errorMessage,
          },
        },
      });

      return {
        id: failed.id,
        billing_charge_id: failed.billingChargeId,
        status: failed.status,
        sent_at: failed.sentAt,
        error_message: failed.errorMessage,
        next_retry_at: failed.nextRetryAt,
        attempt_count: failed.attemptCount,
      };
    }
  }

  private async processDueCollectionRemindersInternal(
    companyId: string,
    options?: { actorUserId?: string | null; triggerSource?: string; limit?: number }
  ) {
    const now = new Date();
    const limit = Math.max(1, Math.min(200, Number(options?.limit || 50)));
    const reminders = await (prisma as any).billingReminder.findMany({
      where: {
        companyId,
        OR: [
          { status: 'scheduled', scheduledAt: { lte: now } },
          { status: 'failed', nextRetryAt: { not: null, lte: now } },
        ],
        billingCharge: {
          status: { in: ['pending', 'overdue'] },
        },
      },
      orderBy: [{ scheduledAt: 'asc' }, { nextRetryAt: 'asc' }, { createdAt: 'asc' }],
      take: limit,
      select: { id: true },
    });

    let sentCount = 0;
    let failedCount = 0;
    let retriedCount = 0;

    for (const reminder of reminders) {
      const result = await this.executeReminderSend(reminder.id, companyId, {
        actorUserId: options?.actorUserId || null,
        triggerSource: options?.triggerSource || 'worker',
      });
      if (Number(result.attempt_count || 0) > 1) retriedCount += 1;
      if (result.status === 'sent') sentCount += 1;
      if (result.status === 'failed') failedCount += 1;
    }

    return {
      processed_count: reminders.length,
      reminders_sent: sentCount,
      reminders_failed: failedCount,
      reminders_retried: retriedCount,
    };
  }

  async listCollectionReminders(
    user: AuthenticatedUser,
    queryParams: {
      status?: string;
      step_code?: string;
      page?: number;
      pageSize?: number;
      customer?: string;
      billing_charge_id?: string;
      date_from?: string;
      date_to?: string;
      company_id?: string;
      companyId?: string;
    } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['collections', 'billing', 'cobrancas']);

    const status = String(queryParams.status || '').trim().toLowerCase();
    const stepCode = String(queryParams.step_code || '').trim().toLowerCase();
    const customer = String(queryParams.customer || '').trim();
    const billingChargeId = String(queryParams.billing_charge_id || '').trim();
    const dateFrom = queryParams.date_from ? new Date(String(queryParams.date_from)) : null;
    const dateTo = queryParams.date_to ? new Date(String(queryParams.date_to)) : null;
    const page = Math.max(1, Number(queryParams.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(queryParams.pageSize || 20)));

    const scheduledAt: any = {};
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) {
      scheduledAt.gte = dateFrom;
    }
    if (dateTo && !Number.isNaN(dateTo.getTime())) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      scheduledAt.lte = end;
    }

    const where: any = {
      companyId,
      ...(status ? { status } : {}),
      ...(stepCode ? { stepCode } : {}),
      ...(billingChargeId ? { billingChargeId } : {}),
      ...(Object.keys(scheduledAt).length > 0 ? { scheduledAt } : {}),
      ...(customer
        ? {
            billingCharge: {
              OR: [
                { customerName: { contains: customer, mode: 'insensitive' as const } },
                { title: { contains: customer, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      (prisma as any).billingReminder.findMany({
        where,
        include: {
          billingCharge: {
            select: {
              id: true,
              title: true,
              customerName: true,
              customerPhone: true,
              amount: true,
              dueDate: true,
              status: true,
            },
          },
        },
        orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      (prisma as any).billingReminder.count({ where }),
    ]);

    return {
      data: items.map((item: any) => ({
        id: item.id,
        company_id: item.companyId,
        billing_charge_id: item.billingChargeId,
        step_code: item.stepCode,
        channel: item.channel,
        scheduled_at: item.scheduledAt,
        sent_at: item.sentAt,
        status: item.status,
        error_message: item.errorMessage,
        attempt_count: Number(item.attemptCount || 0),
        last_attempt_at: item.lastAttemptAt,
        next_retry_at: item.nextRetryAt,
        billing_charge: item.billingCharge
          ? {
              id: item.billingCharge.id,
              title: item.billingCharge.title,
              customer_name: item.billingCharge.customerName,
              customer_phone: item.billingCharge.customerPhone,
              amount: Number(item.billingCharge.amount || 0),
              due_date: item.billingCharge.dueDate,
              status: item.billingCharge.status,
            }
          : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async runCollectionsAutomation(
    user: AuthenticatedUser,
    payload: {
      company_id?: string;
      companyId?: string;
      dry_run?: boolean;
      send_now?: boolean;
      trigger_source?: string;
    } = {}
  ) {
    const companyId = this.resolveCompanyId(user, payload);
    await this.ensureAnyModuleAccess(user, companyId, ['collections', 'billing', 'cobrancas']);
    if (user.role === 'FUNCIONARIO_EMPRESA') {
      throw new CompanyServiceError('Apenas dono da empresa pode executar automacao de cobrancas', 403);
    }

    const dryRun = payload.dry_run === true;
    const sendNow = payload.send_now !== false;
    const triggerSource = String(payload.trigger_source || 'manual').trim() || 'manual';
    await this.autoMarkOverdueCharges(companyId);

    const now = new Date();
    const steps = this.getCollectionReminderSteps();
    const charges = await (prisma as any).billingCharge.findMany({
      where: {
        companyId,
        status: { in: ['pending', 'overdue'] },
        dueDate: { not: null },
      },
      select: {
        id: true,
        title: true,
        customerName: true,
        customerPhone: true,
        amount: true,
        dueDate: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    const createdReminderIds: string[] = [];
    const previewItems: Array<{
      billing_charge_id: string;
      title: string;
      customer_name: string;
      customer_phone: string | null;
      amount: number;
      due_date: Date | null;
      step_code: string;
      scheduled_at: Date;
      has_phone: boolean;
      already_exists: boolean;
      action: 'schedule' | 'skip_existing';
    }> = [];
    let scheduledCount = 0;
    let sentCount = 0;
    let failedCount = 0;

    for (const charge of charges) {
      if (!charge.dueDate) continue;
      for (const step of steps) {
        const scheduleAt = this.addDays(charge.dueDate, step.daysAfterDue);
        if (scheduleAt > now) continue;

        const existing = await (prisma as any).billingReminder.findFirst({
          where: {
            companyId,
            billingChargeId: charge.id,
            stepCode: step.code,
          },
          select: { id: true },
        });
        if (dryRun) {
          previewItems.push({
            billing_charge_id: charge.id,
            title: charge.title,
            customer_name: charge.customerName,
            customer_phone: charge.customerPhone || null,
            amount: Number(charge.amount || 0),
            due_date: charge.dueDate,
            step_code: step.code,
            scheduled_at: scheduleAt,
            has_phone: String(charge.customerPhone || '').trim().length > 0,
            already_exists: Boolean(existing),
            action: existing ? 'skip_existing' : 'schedule',
          });
        }
        if (existing) continue;

        if (dryRun) {
          scheduledCount += 1;
          continue;
        }

        const created = await (prisma as any).billingReminder.create({
          data: {
            companyId,
            billingChargeId: charge.id,
            stepCode: step.code,
            channel: 'whatsapp',
            scheduledAt: scheduleAt,
            status: sendNow ? 'processing' : 'scheduled',
            nextRetryAt: sendNow ? null : scheduleAt,
          },
          select: { id: true },
        });
        createdReminderIds.push(created.id);
        scheduledCount += 1;

        if (!sendNow) continue;
        const result = await this.executeReminderSend(created.id, companyId, {
          actorUserId: user.id,
          triggerSource,
        });
        if (result.status === 'sent') sentCount += 1;
        if (result.status === 'failed') failedCount += 1;
      }
    }

    await this.createCollectionsExecutionLog({
      companyId,
      triggerSource,
      dryRun,
      sendNow,
      chargesAnalyzed: charges.length,
      remindersCreated: scheduledCount,
      remindersSent: sentCount,
      remindersFailed: failedCount,
      status: 'completed',
      metadata: dryRun ? { preview_count: previewItems.length } : null,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId,
        action: 'COLLECTIONS_AUTOMATION_RUN',
        resource: 'billing_reminders',
        details: {
          dryRun,
          sendNow,
          triggerSource,
          chargesAnalyzed: charges.length,
          scheduledCount,
          sentCount,
          failedCount,
        },
      },
    });

    return {
      company_id: companyId,
      dry_run: dryRun,
      send_now: sendNow,
      charges_analyzed: charges.length,
      reminders_created: scheduledCount,
      reminders_sent: sentCount,
      reminders_failed: failedCount,
      reminder_ids: createdReminderIds,
      preview: dryRun ? previewItems : [],
    };
  }

  async reprocessCollectionReminder(
    user: AuthenticatedUser,
    reminderId: string,
    payload?: { company_id?: string; companyId?: string; send_now?: boolean }
  ) {
    const companyId = this.resolveCompanyId(user, payload || {});
    await this.ensureAnyModuleAccess(user, companyId, ['collections', 'billing', 'cobrancas']);
    if (user.role === 'FUNCIONARIO_EMPRESA') {
      throw new CompanyServiceError('Apenas dono da empresa pode reprocessar lembretes', 403);
    }

    const sendNow = payload?.send_now !== false;
    const reminder = await (prisma as any).billingReminder.findFirst({
      where: { id: reminderId, companyId },
      include: {
        billingCharge: {
          select: {
            id: true,
            title: true,
            customerName: true,
            customerPhone: true,
            amount: true,
            dueDate: true,
            status: true,
          },
        },
      },
    });
    if (!reminder) {
      throw new CompanyServiceError('Lembrete nao encontrado', 404);
    }
    if (reminder.status === 'canceled') {
      throw new CompanyServiceError('Lembrete cancelado nao pode ser reprocessado', 400);
    }
    if (reminder.billingCharge?.status === 'paid') {
      throw new CompanyServiceError('Cobranca paga nao pode ter lembrete reprocessado', 400);
    }

    const now = new Date();
    if (!sendNow) {
      const scheduled = await (prisma as any).billingReminder.update({
        where: { id: reminder.id },
        data: {
          status: 'scheduled',
          errorMessage: null,
          scheduledAt: now,
          nextRetryAt: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          companyId,
          action: 'COLLECTIONS_REMINDER_REPROCESSED',
          resource: 'billing_reminders',
          details: {
            reminderId: scheduled.id,
            billingChargeId: scheduled.billingChargeId,
            mode: 'scheduled',
          },
        },
      });

      return {
        id: scheduled.id,
        billing_charge_id: scheduled.billingChargeId,
        status: scheduled.status,
        sent_at: scheduled.sentAt,
        error_message: scheduled.errorMessage,
        next_retry_at: scheduled.nextRetryAt,
        attempt_count: scheduled.attemptCount,
      };
    }

    const result = await this.executeReminderSend(reminder.id, companyId, {
      actorUserId: user.id,
      triggerSource: 'manual-reprocess',
    });

    await this.createCollectionsExecutionLog({
      companyId,
      triggerSource: 'manual-reprocess',
      dryRun: false,
      sendNow: true,
      remindersSent: result.status === 'sent' ? 1 : 0,
      remindersFailed: result.status === 'failed' ? 1 : 0,
      remindersRetried: Number(result.attempt_count || 0) > 1 ? 1 : 0,
      processedScheduled: 1,
      status: result.status === 'sent' ? 'completed' : 'partial',
      metadata: {
        reminder_id: result.id,
        billing_charge_id: result.billing_charge_id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId,
        action: 'COLLECTIONS_REMINDER_REPROCESSED',
        resource: 'billing_reminders',
        details: {
          reminderId: result.id,
          billingChargeId: result.billing_charge_id,
          mode: 'send_now',
          result: result.status,
          attemptCount: result.attempt_count,
          nextRetryAt: result.next_retry_at || null,
        },
      },
    });

    return result;
  }

  async processDueCollectionReminders(
    user: AuthenticatedUser,
    payload?: { company_id?: string; companyId?: string; limit?: number }
  ) {
    const companyId = this.resolveCompanyId(user, payload || {});
    await this.ensureAnyModuleAccess(user, companyId, ['collections', 'billing', 'cobrancas']);
    if (user.role === 'FUNCIONARIO_EMPRESA') {
      throw new CompanyServiceError('Apenas dono da empresa pode processar lembretes agendados', 403);
    }

    await this.autoMarkOverdueCharges(companyId);
    const result = await this.processDueCollectionRemindersInternal(companyId, {
      actorUserId: user.id,
      triggerSource: 'manual-process-due',
      limit: Number(payload?.limit || 50),
    });

    await this.createCollectionsExecutionLog({
      companyId,
      triggerSource: 'manual-process-due',
      dryRun: false,
      sendNow: true,
      remindersSent: result.reminders_sent,
      remindersFailed: result.reminders_failed,
      remindersRetried: result.reminders_retried,
      processedScheduled: result.processed_count,
      status: 'completed',
    });

    return {
      company_id: companyId,
      ...result,
    };
  }

  async listCollectionsExecutionLogs(
    user: AuthenticatedUser,
    queryParams?: {
      company_id?: string;
      companyId?: string;
      page?: number;
      pageSize?: number;
      trigger_source?: string;
      status?: string;
      date_from?: string;
      date_to?: string;
    }
  ) {
    const companyId = this.resolveCompanyId(user, queryParams || {});
    await this.ensureAnyModuleAccess(user, companyId, ['collections', 'billing', 'cobrancas']);
    const page = Math.max(1, Number(queryParams?.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(queryParams?.pageSize || 20)));
    const triggerSource = String(queryParams?.trigger_source || '').trim();
    const status = String(queryParams?.status || '').trim();
    const dateFrom = queryParams?.date_from ? new Date(String(queryParams.date_from)) : null;
    const dateTo = queryParams?.date_to ? new Date(String(queryParams.date_to)) : null;
    const where: any = { companyId };

    if (triggerSource) where.triggerSource = triggerSource;
    if (status) where.status = status;
    if ((dateFrom && !Number.isNaN(dateFrom.getTime())) || (dateTo && !Number.isNaN(dateTo.getTime()))) {
      where.createdAt = {};
      if (dateFrom && !Number.isNaN(dateFrom.getTime())) where.createdAt.gte = dateFrom;
      if (dateTo && !Number.isNaN(dateTo.getTime())) where.createdAt.lte = dateTo;
    }

    const [items, total] = await Promise.all([
      (prisma as any).collectionAutomationRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      (prisma as any).collectionAutomationRun.count({
        where,
      }),
    ]);

    return {
      data: items.map((item: any) => ({
        id: item.id,
        company_id: item.companyId,
        trigger_source: item.triggerSource,
        dry_run: item.dryRun,
        send_now: item.sendNow,
        charges_analyzed: item.chargesAnalyzed,
        reminders_created: item.remindersCreated,
        reminders_sent: item.remindersSent,
        reminders_failed: item.remindersFailed,
        reminders_retried: item.remindersRetried,
        processed_scheduled: item.processedScheduled,
        status: item.status,
        error_message: item.errorMessage,
        metadata: item.metadata,
        created_at: item.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async exportCollectionsExecutionLogsExcel(
    user: AuthenticatedUser,
    queryParams?: {
      company_id?: string;
      companyId?: string;
      trigger_source?: string;
      status?: string;
      date_from?: string;
      date_to?: string;
    }
  ) {
    const companyId = this.resolveCompanyId(user, queryParams || {});
    await this.ensureAnyModuleAccess(user, companyId, ['collections', 'billing', 'cobrancas']);

    const result = await this.listCollectionsExecutionLogs(user, {
      ...(queryParams || {}),
      company_id: companyId,
      page: 1,
      pageSize: 1000,
    });

    const workbook = XLSX.utils.book_new();
    const resumo = [
      { campo: 'Empresa', valor: companyId },
      { campo: 'Total de execucoes', valor: result.total },
      { campo: 'Origem filtrada', valor: String(queryParams?.trigger_source || 'todas') },
      { campo: 'Status filtrado', valor: String(queryParams?.status || 'todos') },
      { campo: 'Data inicial', valor: String(queryParams?.date_from || '-') },
      { campo: 'Data final', valor: String(queryParams?.date_to || '-') },
      { campo: 'Exportado em', valor: new Date().toISOString() },
    ];

    const execucoes = result.data.map((item: any) => ({
      id: item.id,
      origem: item.trigger_source,
      status: item.status,
      simulacao: item.dry_run ? 'Sim' : 'Nao',
      envio_ativo: item.send_now ? 'Sim' : 'Nao',
      cobrancas_analisadas: item.charges_analyzed,
      lembretes_criados: item.reminders_created,
      lembretes_enviados: item.reminders_sent,
      lembretes_falhos: item.reminders_failed,
      lembretes_retry: item.reminders_retried,
      processados: item.processed_scheduled,
      erro: item.error_message || '',
      criado_em: item.created_at,
    }));

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(resumo), 'Resumo');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(execucoes), 'Execucoes');

    return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  }

  async runCollectionsBackgroundJobs() {
    const companies = await prisma.company.findMany({
      where: {
        status: 'active',
        modules: {
          some: {
            isActive: true,
            modulo: {
              codigo: { in: ['collections', 'billing', 'cobrancas'] },
            },
          },
        },
      },
      select: { id: true },
    });

    for (const company of companies) {
      try {
        await this.autoMarkOverdueCharges(company.id);
        const automationResult = await this.runCollectionsAutomation(
          this.createCollectionsSystemUser(company.id),
          {
            company_id: company.id,
            dry_run: false,
            send_now: false,
            trigger_source: 'job',
          }
        );
        const processingResult = await this.processDueCollectionRemindersInternal(company.id, {
          actorUserId: null,
          triggerSource: 'job',
          limit: 100,
        });

        await this.createCollectionsExecutionLog({
          companyId: company.id,
          triggerSource: 'job-cycle',
          dryRun: false,
          sendNow: true,
          chargesAnalyzed: automationResult.charges_analyzed,
          remindersCreated: automationResult.reminders_created,
          remindersSent: processingResult.reminders_sent,
          remindersFailed: processingResult.reminders_failed,
          remindersRetried: processingResult.reminders_retried,
          processedScheduled: processingResult.processed_count,
          status: 'completed',
        });
      } catch (error: any) {
        await this.createCollectionsExecutionLog({
          companyId: company.id,
          triggerSource: 'job-cycle',
          dryRun: false,
          sendNow: true,
          status: 'failed',
          errorMessage: String(error?.message || 'Falha no job de collections').slice(0, 500),
        });
      }
    }
  }

  async markBillingChargeAsPaid(
    user: AuthenticatedUser,
    billingChargeId: string,
    payload?: { company_id?: string; companyId?: string }
  ) {
    const companyId = this.resolveCompanyId(user, payload || {});
    await this.ensureAnyModuleAccess(user, companyId, ['collections', 'billing', 'cobrancas']);

    const charge = await (prisma as any).billingCharge.findFirst({
      where: { id: billingChargeId, companyId },
      select: {
        id: true,
        orderId: true,
        status: true,
        amount: true,
      },
    });
    if (!charge) throw new CompanyServiceError('Cobranca nao encontrada', 404);

    if (charge.status === 'paid') {
      return { id: charge.id, status: 'paid' };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const nextCharge = await (tx as any).billingCharge.update({
        where: { id: charge.id },
        data: {
          status: 'paid',
          paidAt: now,
        },
      });

      await (tx as any).billingReminder.updateMany({
        where: {
          companyId,
          billingChargeId: charge.id,
          status: { in: ['scheduled', 'processing', 'failed'] },
        },
        data: {
          status: 'canceled',
          errorMessage: null,
        },
      });

      await tx.order.update({
        where: { id: charge.orderId },
        data: { status: 'paid' },
      });

      const order = await tx.order.findUnique({
        where: { id: charge.orderId },
        select: { createdAt: true },
      });
      if (order) {
        await this.syncCompanyMonthlyRevenue(tx, companyId, order.createdAt);
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          companyId,
          action: 'BILLING_CHARGE_MARKED_PAID',
          resource: 'billing_charges',
          details: {
            billingChargeId: charge.id,
            orderId: charge.orderId,
            amount: Number(charge.amount || 0),
          },
        },
      });

      return nextCharge;
    });

    return {
      id: updated.id,
      status: updated.status,
      paid_at: updated.paidAt,
      updated_at: updated.updatedAt,
    };
  }

  async getCollectionsMetrics(
    user: AuthenticatedUser,
    queryParams: { company_id?: string; companyId?: string; dateFrom?: string; dateTo?: string } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['collections', 'billing', 'cobrancas']);
    await this.autoMarkOverdueCharges(companyId);

    const now = new Date();
    const dateFrom = queryParams.dateFrom ? new Date(String(queryParams.dateFrom)) : null;
    const dateTo = queryParams.dateTo ? new Date(String(queryParams.dateTo)) : null;

    const where: any = { companyId };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom && !Number.isNaN(dateFrom.getTime())) where.createdAt.gte = dateFrom;
      if (dateTo && !Number.isNaN(dateTo.getTime())) where.createdAt.lte = dateTo;
    }

    const [totals, overdueCount, upcomingCount] = await Promise.all([
      (prisma as any).billingCharge.groupBy({
        by: ['status'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      (prisma as any).billingCharge.count({
        where: {
          ...where,
          status: 'pending',
          dueDate: { lt: now },
        },
      }),
      (prisma as any).billingCharge.count({
        where: {
          ...where,
          status: 'pending',
          dueDate: { gte: now },
        },
      }),
    ]);

    const summary = totals.reduce(
      (acc: any, item: any) => {
        const status = String(item.status || '').toLowerCase();
        const amount = Number(item._sum?.amount || 0);
        const count = Number(item._count?._all || 0);
        if (status === 'paid') {
          acc.paid_amount += amount;
          acc.paid_count += count;
        } else if (status === 'overdue') {
          acc.overdue_amount += amount;
          acc.overdue_total_count += count;
        } else {
          acc.pending_amount += amount;
          acc.pending_count += count;
        }
        return acc;
      },
      {
        paid_amount: 0,
        paid_count: 0,
        overdue_amount: 0,
        overdue_total_count: 0,
        pending_amount: 0,
        pending_count: 0,
      }
    );

    return {
      summary: {
        ...summary,
        overdue_count: overdueCount,
        upcoming_count: upcomingCount,
      },
    };
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

  async getCustomerHistory(
    user: AuthenticatedUser,
    customerId: string,
    queryParams: { company_id?: string; companyId?: string } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['customers', 'clientes']);

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        document: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!customer) throw new CompanyServiceError('Cliente nao encontrado', 404);

    const [appointments, orders, manualEntries] = await Promise.all([
      (prisma as any).appointment.findMany({
        where: {
          companyId,
          OR: [
            { customerId: customer.id },
            { customerName: { equals: customer.name, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          customerId: true,
          customerName: true,
          serviceId: true,
          serviceName: true,
          professionalId: true,
          professionalName: true,
          scheduledAt: true,
          status: true,
          createdAt: true,
        },
        orderBy: { scheduledAt: 'desc' },
      }),
      prisma.order.findMany({
        where: {
          companyId,
          customerName: { equals: customer.name, mode: 'insensitive' },
        },
        select: {
          id: true,
          customerName: true,
          total: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      (prisma as any).customerServiceHistoryEntry.findMany({
        where: { companyId, customerId: customer.id },
        select: {
          id: true,
          source: true,
          appointmentId: true,
          serviceId: true,
          serviceName: true,
          professionalId: true,
          professionalName: true,
          serviceDate: true,
          amount: true,
          notes: true,
          returnInDays: true,
          returnDueAt: true,
          followUpSentAt: true,
          createdAt: true,
        },
        orderBy: { serviceDate: 'desc' },
      }),
    ]);

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
    const servicesData =
      appointmentServiceIds.length || appointmentServiceNames.length
        ? await (prisma as any).appointmentService.findMany({
            where: {
              companyId,
              OR: [
                ...(appointmentServiceIds.length ? [{ id: { in: appointmentServiceIds } }] : []),
                ...(appointmentServiceNames.length ? [{ name: { in: appointmentServiceNames } }] : []),
              ],
            },
            select: { id: true, name: true, price: true, recommendedReturnDays: true },
          })
        : [];

    const servicePriceById = new Map<string, number>(
      (servicesData as any[]).map((item: any) => [String(item.id), Number(item.price || 0)])
    );
    const servicePriceByName = new Map<string, number>(
      (servicesData as any[]).map((item: any) => [
        this.normalizeComparableText(item.name),
        Number(item.price || 0),
      ])
    );
    const serviceReturnDaysById = new Map<string, number>(
      (servicesData as any[])
        .filter((item: any) => Number(item.recommendedReturnDays || 0) > 0)
        .map((item: any) => [String(item.id), Number(item.recommendedReturnDays || 0)])
    );
    const serviceReturnDaysByName = new Map<string, number>(
      (servicesData as any[])
        .filter((item: any) => Number(item.recommendedReturnDays || 0) > 0)
        .map((item: any) => [this.normalizeComparableText(item.name), Number(item.recommendedReturnDays || 0)])
    );

    const normalizeStatusSafe = (value: unknown) => {
      try {
        return this.normalizeAppointmentStatus(String(value || ''), 'pendente');
      } catch (_error) {
        return 'pendente';
      }
    };

    const completedAppointments = (appointments as any[]).filter(
      (item: any) => normalizeStatusSafe(item.status) === 'concluido'
    );
    const appointmentTotalSpent = completedAppointments.reduce((sum: number, item: any) => {
      const byId = item.serviceId ? servicePriceById.get(String(item.serviceId)) : undefined;
      const byName = servicePriceByName.get(this.normalizeComparableText(item.serviceName));
      return sum + this.toNumber(byId ?? byName ?? 0);
    }, 0);
    const manualTotalSpent = (manualEntries as any[]).reduce(
      (sum: number, item: any) => sum + this.toNumber(item.amount),
      0
    );

    const paidOrders = orders.filter((item) => String(item.status || '').toLowerCase() === 'paid');
    const paidOrdersSpent = paidOrders.reduce((sum, item) => sum + this.toNumber(item.total), 0);

    const favoriteProfessionalMap = new Map<string, { name: string; count: number }>();
    for (const item of completedAppointments) {
      const normalizedName = this.normalizeComparableText(item.professionalName);
      if (!normalizedName) continue;
      const current = favoriteProfessionalMap.get(normalizedName);
      if (current) {
        current.count += 1;
      } else {
        favoriteProfessionalMap.set(normalizedName, {
          name: String(item.professionalName || '').trim(),
          count: 1,
        });
      }
    }
    for (const item of manualEntries as any[]) {
      const normalizedName = this.normalizeComparableText(item.professionalName);
      if (!normalizedName) continue;
      const current = favoriteProfessionalMap.get(normalizedName);
      if (current) {
        current.count += 1;
      } else {
        favoriteProfessionalMap.set(normalizedName, {
          name: String(item.professionalName || '').trim(),
          count: 1,
        });
      }
    }
    const favoriteProfessional = Array.from(favoriteProfessionalMap.values()).sort((a, b) => b.count - a.count)[0] || null;

    const mergedServiceHistory = [
      ...(appointments as any[]).map((item: any) => {
        const byId = item.serviceId ? servicePriceById.get(String(item.serviceId)) : undefined;
        const byName = servicePriceByName.get(this.normalizeComparableText(item.serviceName));
        const returnDays =
          (item.serviceId ? serviceReturnDaysById.get(String(item.serviceId)) : undefined) ??
          serviceReturnDaysByName.get(this.normalizeComparableText(item.serviceName)) ??
          null;
        const serviceDate = new Date(item.scheduledAt);
        const returnDueAt =
          Number(returnDays || 0) > 0
            ? new Date(serviceDate.getTime() + Number(returnDays) * 24 * 60 * 60 * 1000).toISOString()
            : null;

        return {
          history_id: `appointment:${item.id}`,
          source: 'appointment',
          appointment_id: item.id,
          service_id: item.serviceId || null,
          service_name: item.serviceName || null,
          professional_id: item.professionalId || null,
          professional_name: item.professionalName || null,
          scheduled_at: item.scheduledAt,
          service_date: item.scheduledAt,
          status: normalizeStatusSafe(item.status),
          price: this.toNumber(byId ?? byName ?? 0),
          notes: null,
          return_in_days: returnDays,
          return_due_at: returnDueAt,
          follow_up_sent_at: null,
        };
      }),
      ...(manualEntries as any[]).map((item: any) => ({
        history_id: item.id,
        source: String(item.source || 'manual').trim().toLowerCase() || 'manual',
        appointment_id: item.appointmentId || null,
        service_id: item.serviceId || null,
        service_name: item.serviceName || null,
        professional_id: item.professionalId || null,
        professional_name: item.professionalName || null,
        scheduled_at: item.serviceDate,
        service_date: item.serviceDate,
        status: 'retroativo',
        price: this.toNumber(item.amount),
        notes: item.notes || null,
        return_in_days: item.returnInDays != null ? Number(item.returnInDays) : null,
        return_due_at: item.returnDueAt ? new Date(item.returnDueAt).toISOString() : null,
        follow_up_sent_at: item.followUpSentAt ? new Date(item.followUpSentAt).toISOString() : null,
      })),
    ].sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime());

    const sortedServicesAsc = [...mergedServiceHistory].sort(
      (a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
    );
    const firstAppointmentAt = sortedServicesAsc[0]?.service_date
      ? new Date(sortedServicesAsc[0].service_date)
      : null;
    const lastAppointmentAt = sortedServicesAsc[sortedServicesAsc.length - 1]?.service_date
      ? new Date(sortedServicesAsc[sortedServicesAsc.length - 1].service_date)
      : null;

    let activeMonths = 0;
    let averageAppointmentsPerMonth = 0;
    let daysSinceLastAppointment: number | null = null;

    if (firstAppointmentAt && lastAppointmentAt) {
      activeMonths =
        (lastAppointmentAt.getFullYear() - firstAppointmentAt.getFullYear()) * 12 +
        (lastAppointmentAt.getMonth() - firstAppointmentAt.getMonth()) +
        1;
      averageAppointmentsPerMonth =
        activeMonths > 0 ? mergedServiceHistory.length / activeMonths : mergedServiceHistory.length;
      const dayMs = 24 * 60 * 60 * 1000;
      daysSinceLastAppointment = Math.max(
        0,
        Math.floor((Date.now() - lastAppointmentAt.getTime()) / dayMs)
      );
    }

    const nextFollowUp = mergedServiceHistory
      .filter((item) => item.return_due_at)
      .sort((a, b) => new Date(a.return_due_at as string).getTime() - new Date(b.return_due_at as string).getTime())[0] || null;

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        document: customer.document,
        is_active: customer.isActive,
        created_at: customer.createdAt,
      },
      summary: {
        total_services: mergedServiceHistory.length,
        completed_services: completedAppointments.length + (manualEntries as any[]).length,
        total_orders: orders.length,
        paid_orders: paidOrders.length,
        total_spent: paidOrdersSpent > 0 ? paidOrdersSpent : appointmentTotalSpent + manualTotalSpent,
        total_spent_orders: paidOrdersSpent,
        total_spent_services: appointmentTotalSpent + manualTotalSpent,
      },
      frequency: {
        first_appointment_at: firstAppointmentAt ? firstAppointmentAt.toISOString() : null,
        last_appointment_at: lastAppointmentAt ? lastAppointmentAt.toISOString() : null,
        active_months: activeMonths,
        average_appointments_per_month: Number(averageAppointmentsPerMonth.toFixed(2)),
        days_since_last_appointment: daysSinceLastAppointment,
      },
      favorite_professional: favoriteProfessional
        ? {
            name: favoriteProfessional.name,
            attendance_count: favoriteProfessional.count,
          }
        : null,
      follow_up: nextFollowUp
        ? {
            service_name: nextFollowUp.service_name,
            due_at: nextFollowUp.return_due_at,
            return_in_days: nextFollowUp.return_in_days,
          }
        : null,
      services_history: mergedServiceHistory.slice(0, 30),
      orders_history: orders.slice(0, 30).map((item) => ({
        order_id: item.id,
        status: item.status,
        total: this.toNumber(item.total),
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      })),
    };
  }

  async listCustomerServiceHistoryEntries(
    user: AuthenticatedUser,
    customerId: string,
    queryParams: { company_id?: string; companyId?: string } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['customers', 'clientes']);

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
      select: { id: true },
    });
    if (!customer) throw new CompanyServiceError('Cliente nao encontrado', 404);

    const rows = await (prisma as any).customerServiceHistoryEntry.findMany({
      where: { companyId, customerId },
      orderBy: { serviceDate: 'desc' },
    });

    return rows.map((item: any) => ({
      id: item.id,
      source: item.source,
      appointment_id: item.appointmentId || null,
      service_id: item.serviceId || null,
      service_name: item.serviceName,
      professional_id: item.professionalId || null,
      professional_name: item.professionalName || null,
      service_date: item.serviceDate,
      amount: this.toNumber(item.amount),
      notes: item.notes || null,
      return_in_days: item.returnInDays != null ? Number(item.returnInDays) : null,
      return_due_at: item.returnDueAt || null,
      follow_up_sent_at: item.followUpSentAt || null,
      created_at: item.createdAt,
    }));
  }

  async createCustomerServiceHistoryEntry(
    user: AuthenticatedUser,
    customerId: string,
    payload: {
      company_id?: string;
      companyId?: string;
      service_id?: string;
      service_name?: string;
      professional_id?: string;
      professional_name?: string;
      service_date?: string;
      amount?: number;
      notes?: string;
      return_in_days?: number | null;
    } = {}
  ) {
    const companyId = this.resolveCompanyId(user, payload);
    await this.ensureAnyModuleAccess(user, companyId, ['customers', 'clientes']);

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
      select: { id: true },
    });
    if (!customer) throw new CompanyServiceError('Cliente nao encontrado', 404);

    const serviceId = String(payload.service_id || '').trim() || null;
    const rawServiceName = String(payload.service_name || '').trim();
    const serviceDateRaw = String(payload.service_date || '').trim();
    const amount = this.toNumber(payload.amount);
    const notes = String(payload.notes || '').trim() || null;
    const returnInDaysRaw = payload.return_in_days == null ? null : Number(payload.return_in_days);

    if (!rawServiceName) {
      throw new CompanyServiceError('service_name obrigatorio', 400);
    }
    if (!serviceDateRaw) {
      throw new CompanyServiceError('service_date obrigatorio', 400);
    }
    const serviceDate = new Date(serviceDateRaw);
    if (Number.isNaN(serviceDate.getTime())) {
      throw new CompanyServiceError('service_date invalido', 400);
    }
    if (amount < 0) {
      throw new CompanyServiceError('amount nao pode ser negativo', 400);
    }
    const returnInDays =
      returnInDaysRaw != null && Number.isFinite(returnInDaysRaw) && returnInDaysRaw > 0
        ? Math.round(returnInDaysRaw)
        : null;
    const returnDueAt =
      returnInDays != null
        ? new Date(serviceDate.getTime() + returnInDays * 24 * 60 * 60 * 1000)
        : null;

    const created = await (prisma as any).customerServiceHistoryEntry.create({
      data: {
        companyId,
        customerId,
        source: 'manual',
        serviceId,
        serviceName: rawServiceName,
        professionalId: String(payload.professional_id || '').trim() || null,
        professionalName: String(payload.professional_name || '').trim() || null,
        serviceDate,
        amount,
        notes,
        returnInDays,
        returnDueAt,
        createdByUserId: user.id,
      },
    });

    return {
      id: created.id,
      service_name: created.serviceName,
      service_date: created.serviceDate,
      return_due_at: created.returnDueAt,
    };
  }

  async deleteCustomerServiceHistoryEntry(
    user: AuthenticatedUser,
    customerId: string,
    entryId: string,
    queryParams: { company_id?: string; companyId?: string } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['customers', 'clientes']);

    const existing = await (prisma as any).customerServiceHistoryEntry.findFirst({
      where: { id: entryId, companyId, customerId },
      select: { id: true },
    });
    if (!existing) {
      throw new CompanyServiceError('Historico retroativo nao encontrado', 404);
    }

    await (prisma as any).customerServiceHistoryEntry.delete({ where: { id: entryId } });
    return { success: true };
  }

  async listCustomerFollowUps(
    user: AuthenticatedUser,
    queryParams: {
      company_id?: string;
      companyId?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['customers', 'clientes']);

    const search = this.normalizeComparableText(queryParams.search);
    const statusFilter = String(queryParams.status || 'all').trim().toLowerCase();
    const page = Math.max(1, Number(queryParams.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(queryParams.pageSize || 20)));
    const dayRange = queryParams.dateFrom || queryParams.dateTo ? this.parseDateRange(queryParams as any, 30) : null;
    const now = new Date();

    const [manualEntries, appointments] = await Promise.all([
      (prisma as any).customerServiceHistoryEntry.findMany({
        where: { companyId, returnDueAt: { not: null } },
        select: {
          id: true,
          source: true,
          serviceName: true,
          professionalName: true,
          serviceDate: true,
          amount: true,
          notes: true,
          returnInDays: true,
          returnDueAt: true,
          followUpSentAt: true,
          customer: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: { returnDueAt: 'asc' },
      }),
      (prisma as any).appointment.findMany({
        where: { companyId },
        select: {
          id: true,
          customerId: true,
          customerName: true,
          serviceId: true,
          serviceName: true,
          professionalName: true,
          scheduledAt: true,
          status: true,
          customer: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: { scheduledAt: 'desc' },
      }),
    ]);

    const relevantServiceIds = Array.from(
      new Set(
        (appointments as any[])
          .map((item: any) => String(item.serviceId || '').trim())
          .filter(Boolean)
      )
    );
    const services = relevantServiceIds.length
      ? await (prisma as any).appointmentService.findMany({
          where: { companyId, id: { in: relevantServiceIds } },
          select: { id: true, name: true, recommendedReturnDays: true },
        })
      : [];
    const serviceReturnDaysById = new Map<string, number>(
      (services as any[])
        .filter((item: any) => Number(item.recommendedReturnDays || 0) > 0)
        .map((item: any) => [String(item.id), Number(item.recommendedReturnDays || 0)])
    );

    const autoFollowUps = (appointments as any[])
      .filter((item: any) => this.normalizeAppointmentStatus(String(item.status || ''), 'pendente') === 'concluido')
      .map((item: any) => {
        const returnInDays = item.serviceId ? serviceReturnDaysById.get(String(item.serviceId)) : undefined;
        if (!returnInDays || returnInDays <= 0) return null;
        const serviceDate = new Date(item.scheduledAt);
        const returnDueAt = new Date(serviceDate.getTime() + returnInDays * 24 * 60 * 60 * 1000);
        return {
          id: `appointment:${item.id}`,
          source: 'appointment',
          customer_id: item.customer?.id || item.customerId || null,
          customer_name: item.customer?.name || item.customerName || 'Cliente',
          customer_phone: item.customer?.phone || null,
          customer_email: item.customer?.email || null,
          service_name: item.serviceName || 'Servico',
          professional_name: item.professionalName || null,
          service_date: serviceDate.toISOString(),
          return_in_days: returnInDays,
          return_due_at: returnDueAt.toISOString(),
          follow_up_sent_at: null,
          amount: 0,
          notes: null,
        };
      })
      .filter(Boolean) as any[];

    const manualFollowUps = (manualEntries as any[]).map((item: any) => ({
      id: item.id,
      source: String(item.source || 'manual').trim().toLowerCase() || 'manual',
      customer_id: item.customer?.id || null,
      customer_name: item.customer?.name || 'Cliente',
      customer_phone: item.customer?.phone || null,
      customer_email: item.customer?.email || null,
      service_name: item.serviceName || 'Servico',
      professional_name: item.professionalName || null,
      service_date: item.serviceDate instanceof Date ? item.serviceDate.toISOString() : item.serviceDate,
      return_in_days: item.returnInDays != null ? Number(item.returnInDays) : null,
      return_due_at: item.returnDueAt instanceof Date ? item.returnDueAt.toISOString() : item.returnDueAt,
      follow_up_sent_at:
        item.followUpSentAt instanceof Date ? item.followUpSentAt.toISOString() : item.followUpSentAt || null,
      amount: this.toNumber(item.amount),
      notes: item.notes || null,
    }));

    const rows = [...manualFollowUps, ...autoFollowUps]
      .filter((item) => {
        if (!item.return_due_at) return false;
        const dueAt = new Date(item.return_due_at);
        if (dayRange && (dueAt < dayRange.start || dueAt > dayRange.end)) return false;
        const computedStatus =
          item.follow_up_sent_at
            ? 'sent'
            : dueAt < now
              ? 'overdue'
              : dueAt.toDateString() === now.toDateString()
                ? 'today'
                : 'upcoming';
        if (statusFilter !== 'all' && computedStatus !== statusFilter) return false;
        if (search) {
          const haystack = this.normalizeComparableText(
            `${item.customer_name} ${item.customer_phone || ''} ${item.service_name} ${item.professional_name || ''}`
          );
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .map((item) => {
        const dueAt = new Date(item.return_due_at as string);
        const status =
          item.follow_up_sent_at
            ? 'sent'
            : dueAt < now
              ? 'overdue'
              : dueAt.toDateString() === now.toDateString()
                ? 'today'
                : 'upcoming';
        return { ...item, status };
      })
      .sort((a, b) => new Date(a.return_due_at as string).getTime() - new Date(b.return_due_at as string).getTime());

    const paged = rows.slice((page - 1) * pageSize, page * pageSize);
    return { data: paged, total: rows.length, page, pageSize };
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
      support_level:
        PAYMENT_GATEWAY_CATALOG_MAP.get(String(gateway.provider || '').toLowerCase())?.supportLevel || 'planned',
      automatic_supported: SUPPORTED_PAYMENT_GATEWAYS.has(String(gateway.provider || '').toLowerCase()),
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

  async listPaymentGatewayCatalog() {
    return PAYMENT_GATEWAY_CATALOG;
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
    if (!provider) {
      throw new CompanyServiceError('Provedor obrigatorio', 400);
    }
    if (!PAYMENT_GATEWAY_CATALOG_MAP.has(provider)) {
      throw new CompanyServiceError('Provedor nao encontrado no catalogo de gateways', 400);
    }

    const secretKey = String(data.secret_key || '').trim();
    if (!secretKey) {
      throw new CompanyServiceError('Informe a secret key', 400);
    }
    const publicKey = String(data.public_key || '').trim() || null;
    const webhookSecret = String(data.webhook_secret || '').trim() || null;
    const environment = String(data.ambiente || 'sandbox').trim().toLowerCase();
    const catalogItem = PAYMENT_GATEWAY_CATALOG_MAP.get(provider)!;
    const automaticSupported = SUPPORTED_PAYMENT_GATEWAYS.has(provider);

    const validation = automaticSupported
      ? await this.paymentService.validateGatewayCredentials({
          provider,
          environment,
          publicKey,
          secretKey,
        })
      : null;

    const displayName =
      String(data.nome_exibicao || '').trim() ||
      `${catalogItem.label}${validation?.accountName ? ` - ${validation.accountName}` : ''}`.trim();

    const saved = await prisma.$transaction(async (tx) => {
      if (automaticSupported) {
        await (tx as any).paymentGateway.updateMany({
          where: { companyId },
          data: { isActive: false },
        });
      }

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
              supportLevel: catalogItem.supportLevel,
              automaticSupported,
              accountValidation: validation,
            },
            isActive: automaticSupported,
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
            supportLevel: catalogItem.supportLevel,
            automaticSupported,
            accountValidation: validation,
          },
          isActive: automaticSupported,
        },
      });
    });

    return {
      support_level: catalogItem.supportLevel,
      automatic_supported: automaticSupported,
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
      message: automaticSupported
        ? 'Gateway conectado e pronto para uso automatico.'
        : 'Gateway salvo no catalogo. Integracao automatica ainda nao disponivel para este provedor.',
    };
  }

  async activateMyPaymentGateway(user: AuthenticatedUser, gatewayId: string) {
    const companyId = this.ensureOwnerCompanyId(user);

    const target = await (prisma as any).paymentGateway.findFirst({
      where: { id: gatewayId, companyId },
      select: { id: true, provider: true },
    });
    if (!target) throw new CompanyServiceError('Gateway nao encontrado', 404);
    if (!SUPPORTED_PAYMENT_GATEWAYS.has(String(target.provider || '').toLowerCase())) {
      throw new CompanyServiceError('Este gateway esta salvo no catalogo, mas ainda nao possui ativacao automatica', 400);
    }

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
    queryParams: {
      dateFrom?: string;
      dateTo?: string;
      company_id?: string;
      companyId?: string;
      customer?: string;
      service?: string;
      day?: string;
      period_group?: string;
    } = {}
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
    const specificDayRange = this.parseSpecificDayRange(queryParams.day);
    const { start, end } = specificDayRange || this.parseDateRange(queryParams, 180);
    const customerFilter = this.normalizeComparableText(queryParams.customer);
    const serviceFilter = this.normalizeComparableText(queryParams.service);
    const periodGroup = this.parsePeriodGroup(queryParams.period_group);
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
        select: { id: true, total: true, createdAt: true, customerName: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.order.findMany({
        where: {
          ...(isOwner && companyId ? { companyId } : {}),
          status: { in: ['pending', 'pending_gateway', 'pending_pix'] },
          createdAt: { gte: start, lte: end },
        },
        select: { id: true, total: true, createdAt: true, customerName: true },
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
        select: { details: true, createdAt: true },
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
    const auditLogMap = new Map<
      string,
      {
        paymentMethod: string | null;
        services: string[];
      }
    >();
    for (const log of auditLogsInRange) {
      const details = (log.details || {}) as any;
      const orderId = String(details?.orderId || '').trim();
      if (!orderId) continue;
      const items = Array.isArray(details?.items) ? details.items : [];
      auditLogMap.set(orderId, {
        paymentMethod: String(details?.paymentMethod || '').trim().toLowerCase() || null,
        services: items
          .filter((item: any) => String(item?.itemType || '').trim().toLowerCase() === 'service')
          .map((item: any) => this.normalizeComparableText(item?.itemName))
          .filter(Boolean),
      });
    }

    const matchesFinancialFilters = (item: {
      id?: string | null;
      customerName?: string | null;
      createdAt: Date;
    }) => {
      if (customerFilter && !this.normalizeComparableText(item.customerName).includes(customerFilter)) {
        return false;
      }
      if (serviceFilter) {
        const log = auditLogMap.get(String(item.id || ''));
        if (!log || !log.services.some((serviceName) => serviceName.includes(serviceFilter))) {
          return false;
        }
      }
      return true;
    };

    const filteredPaidOrdersInRange = paidOrdersInRange.filter(matchesFinancialFilters);
    const filteredPendingOrdersInRange = pendingOrdersInRange.filter(matchesFinancialFilters);
    const filteredPaidOrderIds = new Set(filteredPaidOrdersInRange.map((item) => String(item.id)));

    const paidRevenueInRange = filteredPaidOrdersInRange.reduce((sum, item) => sum + this.toNumber(item.total), 0);
    const ticketMedio = filteredPaidOrdersInRange.length > 0 ? paidRevenueInRange / filteredPaidOrdersInRange.length : 0;
    const pendingAmount = filteredPendingOrdersInRange.reduce((sum, item) => sum + this.toNumber(item.total), 0);

    const timeline = this.buildGroupedTimeline(start, end, periodGroup);
    for (const item of filteredPaidOrdersInRange) {
      const key = this.getTimelineKey(item.createdAt, periodGroup);
      const current = timeline.get(key);
      if (!current) continue;
      current.paid += this.toNumber(item.total);
      timeline.set(key, current);
    }
    for (const item of filteredPendingOrdersInRange) {
      const key = this.getTimelineKey(item.createdAt, periodGroup);
      const current = timeline.get(key);
      if (!current) continue;
      current.pending += this.toNumber(item.total);
      timeline.set(key, current);
    }

    const paidOrdersById = new Map<string, number>();
    for (const order of filteredPaidOrdersInRange as any[]) {
      if (order?.id) paidOrdersById.set(String(order.id), this.toNumber(order.total));
    }

    const paymentMethodsMap = new Map<string, number>();
    const ordersAlreadyCounted = new Set<string>();

    for (const tx of paidTransactionsInRange) {
      const orderId = String(tx.orderId || '').trim();
      if (orderId && !filteredPaidOrderIds.has(orderId)) continue;
      const method = String(tx.paymentMethod || 'desconhecido').toLowerCase();
      paymentMethodsMap.set(method, (paymentMethodsMap.get(method) || 0) + this.toNumber(tx.amount));
      if (tx.orderId) {
        ordersAlreadyCounted.add(String(tx.orderId));
      }
    }

    for (const log of auditLogsInRange) {
      const details = (log.details || {}) as any;
      const orderId = String(details?.orderId || '').trim();
      if (orderId && !filteredPaidOrderIds.has(orderId)) continue;
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
      filters: {
        customer: customerFilter ? String(queryParams.customer || '').trim() : null,
        service: serviceFilter ? String(queryParams.service || '').trim() : null,
        day: specificDayRange ? String(queryParams.day || '').trim() : null,
        period_group: periodGroup,
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
        cashflow_by_day: Array.from(timeline.entries()).map(([date, values]) => ({
          date,
          paid: values.paid,
          pending: values.pending,
        })),
        cashflow_by_period: Array.from(timeline.entries()).map(([date, values]) => ({
          date,
          label: values.label,
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

  async getCashOverview(
    user: AuthenticatedUser,
    queryParams: {
      company_id?: string;
      companyId?: string;
      dateFrom?: string;
      dateTo?: string;
      referenceDate?: string;
      page?: number;
      pageSize?: number;
      payment_method?: string;
      item_type?: string;
      search?: string;
    } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['cash', 'caixa']);

    const referenceDate = this.parseReferenceDate(queryParams.referenceDate);
    const { start, end } = this.parseDateRange(queryParams, 30);
    const page = Math.max(1, Number(queryParams.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(queryParams.pageSize || 20)));
    const paymentMethodFilter = String(queryParams.payment_method || '').trim().toLowerCase();
    const itemTypeFilter = String(queryParams.item_type || '').trim().toLowerCase();
    const search = this.normalizeComparableText(String(queryParams.search || ''));

    const [paidOrders, paidTransactions, checkoutLogs, manualTransactions] = await Promise.all([
      prisma.order.findMany({
        where: {
          companyId,
          status: 'paid',
        },
        select: {
          id: true,
          customerName: true,
          total: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.paymentTransaction.findMany({
        where: {
          companyId,
        },
        select: {
          orderId: true,
          paymentMethod: true,
          amount: true,
          status: true,
          paidAt: true,
          updatedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.findMany({
        where: {
          companyId,
          action: 'PDV_CHECKOUT',
          resource: 'orders',
        },
        select: {
          createdAt: true,
          details: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      (prisma as any).cashTransaction.findMany({
        where: { companyId },
        select: {
          id: true,
          type: true,
          category: true,
          description: true,
          amount: true,
          paymentMethod: true,
          transactionDate: true,
          createdAt: true,
        },
        orderBy: { transactionDate: 'desc' },
      }),
    ]);

    const transactionsByOrder = new Map<string, any[]>();
    for (const tx of paidTransactions) {
      const orderId = String(tx.orderId || '').trim();
      if (!orderId) continue;
      const list = transactionsByOrder.get(orderId) || [];
      list.push(tx);
      transactionsByOrder.set(orderId, list);
    }

    const checkoutLogByOrder = new Map<string, any>();
    for (const log of checkoutLogs) {
      const details = (log.details || {}) as any;
      const orderId = String(details?.orderId || '').trim();
      if (!orderId || checkoutLogByOrder.has(orderId)) continue;
      checkoutLogByOrder.set(orderId, {
        createdAt: log.createdAt,
        paymentMethod: String(details?.paymentMethod || '').trim().toLowerCase() || null,
        items: Array.isArray(details?.items) ? details.items : [],
      });
    }

    const entries = paidOrders.map((order) => {
      const orderId = String(order.id || '');
      const txs = transactionsByOrder.get(orderId) || [];
      const checkoutLog = checkoutLogByOrder.get(orderId);
      const paidTx = txs.find((item) => String(item.status || '').toLowerCase() === 'paid') || txs[0] || null;
      const paymentMethod =
        String(paidTx?.paymentMethod || checkoutLog?.paymentMethod || 'desconhecido').trim().toLowerCase();
      const paidAt =
        paidTx?.paidAt ||
        (String(paidTx?.status || '').toLowerCase() === 'paid' ? paidTx?.updatedAt : null) ||
        order.updatedAt ||
        checkoutLog?.createdAt ||
        order.createdAt;
      const items = Array.isArray(checkoutLog?.items) ? checkoutLog.items : [];
      const normalizedItemTypes = Array.from(
        new Set(
          items
            .map((item: any) => String(item?.itemType || '').trim().toLowerCase())
            .filter(Boolean)
        )
      );
      const itemNames = items
        .map((item: any) => String(item?.itemName || '').trim())
        .filter(Boolean);

      return {
        id: orderId,
        customer_name: order.customerName || 'Cliente nao informado',
        payment_method: paymentMethod || 'desconhecido',
        paid_at: paidAt,
        order_created_at: order.createdAt,
        total: this.toNumber(order.total),
        item_types: normalizedItemTypes,
        items: items.map((item: any) => ({
          item_type: String(item?.itemType || '').trim().toLowerCase() || 'produto',
          item_name: String(item?.itemName || '').trim() || 'Item',
          quantity: Number(item?.quantity || 0),
          unit_price: this.toNumber(item?.unitPrice),
          total_price: this.toNumber(item?.totalPrice),
        })),
        item_summary: itemNames.join(', '),
      };
    });

      const filteredEntries = entries.filter((entry) => {
        const paidAt = new Date(entry.paid_at);
        if (paidAt < start || paidAt > end) return false;
      if (paymentMethodFilter && entry.payment_method !== paymentMethodFilter) return false;
      if (itemTypeFilter && !entry.item_types.includes(itemTypeFilter)) return false;
      if (search) {
        const haystack = this.normalizeComparableText(
          `${entry.customer_name} ${entry.item_summary} ${entry.payment_method}`
        );
        if (!haystack.includes(search)) return false;
      }
        return true;
      });

      const salesBeforeStart = entries
        .filter((entry) => new Date(entry.paid_at) < start)
        .reduce((sum, entry) => sum + entry.total, 0);

      const manualBeforeStart = manualTransactions.reduce(
        (acc: { entries: number; exits: number }, item: any) => {
          const transactionDate = new Date(item.transactionDate);
          if (transactionDate >= start) return acc;
          const amount = this.toNumber(item.amount);
          if (String(item.type || '').toLowerCase() === 'entrada') {
            acc.entries += amount;
          } else {
            acc.exits += amount;
          }
          return acc;
        },
        { entries: 0, exits: 0 }
      );

      const manualInPeriod = manualTransactions.reduce(
        (acc: { entries: number; exits: number }, item: any) => {
          const transactionDate = new Date(item.transactionDate);
          if (transactionDate < start || transactionDate > end) return acc;
          const amount = this.toNumber(item.amount);
          if (String(item.type || '').toLowerCase() === 'entrada') {
            acc.entries += amount;
          } else {
            acc.exits += amount;
          }
          return acc;
        },
        { entries: 0, exits: 0 }
      );

      const openingBalance = salesBeforeStart + manualBeforeStart.entries - manualBeforeStart.exits;
      const periodSalesTotal = entries
        .filter((entry) => {
          const paidAt = new Date(entry.paid_at);
          return paidAt >= start && paidAt <= end;
        })
        .reduce((sum, entry) => sum + entry.total, 0);
      const closingBalance = openingBalance + periodSalesTotal + manualInPeriod.entries - manualInPeriod.exits;

      const buildSummary = (period: 'day' | 'week' | 'month' | 'year') => {
        const bounds = this.getNamedPeriodBounds(referenceDate, period);
      const scoped = entries.filter((entry) => {
        const paidAt = new Date(entry.paid_at);
        return paidAt >= bounds.start && paidAt <= bounds.end;
      });
      const totalReceived = scoped.reduce((sum, entry) => sum + entry.total, 0);
      const averageTicket = scoped.length > 0 ? totalReceived / scoped.length : 0;
      return {
        period,
        date_from: bounds.start.toISOString(),
        date_to: bounds.end.toISOString(),
        total_received: totalReceived,
        sales_count: scoped.length,
        average_ticket: averageTicket,
      };
    };

    const paymentMethodsMap = new Map<string, number>();
    const itemTypesMap = new Map<string, number>();
    const rankingMap = new Map<
      string,
      {
        item_type: string;
        item_name: string;
        quantity: number;
        total_amount: number;
        order_ids: Set<string>;
      }
    >();
    for (const entry of filteredEntries) {
      const paymentMethodKey = String(entry.payment_method || 'desconhecido');
      paymentMethodsMap.set(paymentMethodKey, (paymentMethodsMap.get(paymentMethodKey) || 0) + entry.total);
      for (const type of entry.item_types) {
        const itemTypeKey = String(type || '');
        itemTypesMap.set(itemTypeKey, (itemTypesMap.get(itemTypeKey) || 0) + 1);
      }
      for (const item of entry.items) {
        const rankingKey = `${String(item.item_type || '')}:${String(item.item_name || '')}`;
        const current =
          rankingMap.get(rankingKey) || {
            item_type: String(item.item_type || '').trim().toLowerCase() || 'produto',
            item_name: String(item.item_name || '').trim() || 'Item',
            quantity: 0,
            total_amount: 0,
            order_ids: new Set<string>(),
          };
        current.quantity += Number(item.quantity || 0);
        current.total_amount += this.toNumber(item.total_price);
        current.order_ids.add(entry.id);
        rankingMap.set(rankingKey, current);
      }
    }

    const paginatedEntries = filteredEntries.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    const selectedPeriodTotalReceived = filteredEntries.reduce((sum, entry) => sum + entry.total, 0);
    const selectedPeriodAverageTicket =
      filteredEntries.length > 0 ? selectedPeriodTotalReceived / filteredEntries.length : 0;

    const previousPeriodDurationMs = Math.max(1, end.getTime() - start.getTime() + 1);
    const previousStart = new Date(start.getTime() - previousPeriodDurationMs);
    const previousEnd = new Date(end.getTime() - previousPeriodDurationMs);
    const previousEntries = entries.filter((entry) => {
      const paidAt = new Date(entry.paid_at);
      return paidAt >= previousStart && paidAt <= previousEnd;
    });
    const previousPeriodTotalReceived = previousEntries.reduce((sum, entry) => sum + entry.total, 0);
    const previousPeriodAverageTicket =
      previousEntries.length > 0 ? previousPeriodTotalReceived / previousEntries.length : 0;
    const previousManualInPeriod = manualTransactions.reduce(
      (acc: { entries: number; exits: number }, item: any) => {
        const transactionDate = new Date(item.transactionDate);
        if (transactionDate < previousStart || transactionDate > previousEnd) return acc;
        const amount = this.toNumber(item.amount);
        if (String(item.type || '').toLowerCase() === 'entrada') {
          acc.entries += amount;
        } else {
          acc.exits += amount;
        }
        return acc;
      },
      { entries: 0, exits: 0 }
    );
    const ranking = Array.from(rankingMap.values())
      .map((item) => ({
        item_type: item.item_type,
        item_name: item.item_name,
        quantity: item.quantity,
        total_amount: item.total_amount,
        orders_count: item.order_ids.size,
      }))
      .sort((a, b) => {
        if (b.total_amount !== a.total_amount) return b.total_amount - a.total_amount;
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return a.item_name.localeCompare(b.item_name);
      });

    return {
      period: {
        reference_date: referenceDate.toISOString(),
        date_from: start.toISOString(),
        date_to: end.toISOString(),
      },
      summaries: {
        day: buildSummary('day'),
        week: buildSummary('week'),
        month: buildSummary('month'),
        year: buildSummary('year'),
      },
      selected_period: {
        total_received: selectedPeriodTotalReceived,
        sales_count: filteredEntries.length,
        average_ticket:
          filteredEntries.length > 0
            ? selectedPeriodAverageTicket
            : 0,
        payment_methods: Array.from(paymentMethodsMap.entries()).map(([payment_method, total]) => ({
          payment_method,
          total,
        })),
        item_types: Array.from(itemTypesMap.entries()).map(([item_type, count]) => ({
          item_type,
          count,
        })),
      },
      comparison: {
        previous_period: {
          date_from: previousStart.toISOString(),
          date_to: previousEnd.toISOString(),
          total_received: previousPeriodTotalReceived,
          sales_count: previousEntries.length,
          average_ticket: previousPeriodAverageTicket,
          manual_entries_total: previousManualInPeriod.entries,
          manual_exits_total: previousManualInPeriod.exits,
        },
        deltas: {
          total_received: selectedPeriodTotalReceived - previousPeriodTotalReceived,
          sales_count: filteredEntries.length - previousEntries.length,
          average_ticket: selectedPeriodAverageTicket - previousPeriodAverageTicket,
        },
      },
      rankings: {
        top_items: ranking.slice(0, 10),
      },
      manual_period: {
        total_entries: manualInPeriod.entries,
        total_exits: manualInPeriod.exits,
        net: manualInPeriod.entries - manualInPeriod.exits,
      },
      balances: {
        opening_balance: openingBalance,
        closing_balance: closingBalance,
        sales_total: periodSalesTotal,
        manual_entries_total: manualInPeriod.entries,
        manual_exits_total: manualInPeriod.exits,
      },
      entries: paginatedEntries,
      total: filteredEntries.length,
      page,
      pageSize,
    };
  }

  async listSupportTickets(
    user: AuthenticatedUser,
    queryParams: { company_id?: string; companyId?: string; status?: string } = {}
  ) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['support']);

    const status = String(queryParams.status || '').trim();
    const where: any = { companyId };
    if (status) where.status = status;

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

  async createSupportTicket(
    user: AuthenticatedUser,
    payload: { company_id?: string; companyId?: string; title?: string; description?: string; priority?: string; category?: string } = {}
  ) {
    const companyId = this.resolveCompanyId(user, payload);
    await this.ensureAnyModuleAccess(user, companyId, ['support']);
    this.ensureOwnerCompanyRole(user);

    const title = String(payload.title || '').trim();
    const description = String(payload.description || '').trim();
    const priority = String(payload.priority || 'media').trim().toLowerCase();
    const category = String(payload.category || '').trim() || null;
    const allowedPriorities = ['baixa', 'media', 'alta', 'urgente'];

    if (!title) throw new CompanyServiceError('Titulo obrigatorio', 400);
    if (!description) throw new CompanyServiceError('Descricao obrigatoria', 400);
    if (!allowedPriorities.includes(priority)) {
      throw new CompanyServiceError('Prioridade invalida. Use baixa, media, alta ou urgente', 400);
    }

    const created = await (prisma as any).supportTicket.create({
      data: {
        companyId,
        createdByUserId: user.id,
        title,
        description,
        priority,
        status: 'aberto',
        category,
      },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        createdByUser: { select: { id: true, fullName: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId,
        action: 'SUPPORT_TICKET_CREATED',
        resource: 'support_tickets',
        details: {
          ticketId: created.id,
          title,
          priority,
          category,
        },
      },
    });

    return {
      id: created.id,
      company_id: created.companyId,
      title: created.title,
      description: created.description,
      priority: created.priority,
      status: created.status,
      category: created.category,
      response: created.response,
      responded_at: created.respondedAt,
      created_at: created.createdAt,
      updated_at: created.updatedAt,
      company: created.company ? { id: created.company.id, name: created.company.name, slug: created.company.slug } : null,
      created_by: created.createdByUser
        ? { id: created.createdByUser.id, name: created.createdByUser.fullName, email: created.createdByUser.email }
        : null,
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
      const existingRoles = existingUser
        ? await tx.userRole.findMany({
            where: { userId: existingUser.id },
            select: { id: true },
          })
        : [];
      let targetUser = existingUser;

      if (existingRoles.length > 0) {
        throw new CompanyServiceError(
          'Ja existe um usuario com este e-mail. Use outro e-mail ou altere o usuario existente.',
          409
        );
      }

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
        targetUser = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            fullName: existingUser.fullName || fullName,
            passwordHash: existingUser.passwordHash || await bcrypt.hash(temporaryPassword, 10),
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

  async updateTeamMember(
    user: AuthenticatedUser,
    memberId: string,
    data: { fullName?: string; email?: string; password?: string; isActive?: boolean }
  ) {
    this.ensureOwner(user);
    const companyId = user.companyId;
    if (!companyId) throw new CompanyServiceError('Company ID obrigatorio', 400);

    const fullName = String(data.fullName || '').trim();
    const email = String(data.email || '').trim().toLowerCase();
    const password = String(data.password || '').trim();

    if (!fullName || !email) {
      throw new CompanyServiceError('Campos obrigatorios: fullName e email', 400);
    }
    if (password && password.length < 6) {
      throw new CompanyServiceError('Senha deve ter ao menos 6 caracteres', 400);
    }

    const membership = await prisma.userRole.findFirst({
      where: {
        userId: memberId,
        companyId,
        role: 'FUNCIONARIO_EMPRESA',
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, isActive: true, passwordHash: true, createdAt: true },
        },
      },
    });

    if (!membership?.user) {
      throw new CompanyServiceError('Funcionario nao encontrado nesta empresa', 404);
    }

    const emailOwner = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (emailOwner && emailOwner.id !== memberId) {
      throw new CompanyServiceError('Ja existe outro usuario com este e-mail', 409);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const payload: any = {
        fullName,
        email,
      };
      if (data.isActive !== undefined) {
        payload.isActive = Boolean(data.isActive);
      }
      if (password) {
        payload.passwordHash = await bcrypt.hash(password, 10);
      }

      const nextUser = await tx.user.update({
        where: { id: memberId },
        data: payload,
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          companyId,
          action: 'TEAM_MEMBER_UPDATED',
          resource: 'profiles',
          details: {
            memberId,
            email,
            isActive: nextUser.isActive,
            passwordChanged: Boolean(password),
          },
        },
      });

      return nextUser;
    });

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      role: 'FUNCIONARIO_EMPRESA',
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };
  }

  async deleteTeamMember(user: AuthenticatedUser, memberId: string) {
    this.ensureOwner(user);
    const companyId = user.companyId;
    if (!companyId) throw new CompanyServiceError('Company ID obrigatorio', 400);

    const membership = await prisma.userRole.findFirst({
      where: {
        userId: memberId,
        companyId,
        role: 'FUNCIONARIO_EMPRESA',
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    if (!membership?.user) {
      throw new CompanyServiceError('Funcionario nao encontrado nesta empresa', 404);
    }

    await prisma.$transaction(async (tx) => {
      await this.deleteEmployeeModulePermissions(tx as any, companyId, memberId);

      await tx.userRole.deleteMany({
        where: {
          userId: memberId,
          companyId,
          role: 'FUNCIONARIO_EMPRESA',
        },
      });

      const remainingRoles = await tx.userRole.count({
        where: { userId: memberId },
      });

      if (remainingRoles === 0) {
        await tx.user.delete({
          where: { id: memberId },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          companyId,
          action: 'TEAM_MEMBER_DELETED',
          resource: 'profiles',
          details: {
            memberId,
            memberEmail: membership.user.email,
            removedUserRecord: remainingRoles === 0,
          },
        },
      });
    });

    return { success: true };
  }

  async listTeamMemberModulePermissions(user: AuthenticatedUser) {
    this.ensureOwner(user);
    const companyId = this.ensureOwnerCompanyId(user);
    await this.ensureAnyModuleAccess(user, companyId, ['permissions', 'permissoes']);

    const [members, companyModules, permissionRows] = await Promise.all([
      prisma.userRole.findMany({
        where: {
          companyId,
          role: 'FUNCIONARIO_EMPRESA',
        },
        select: {
          userId: true,
          user: {
            select: {
              fullName: true,
              email: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      (prisma as any).companyModule.findMany({
        where: {
          companyId,
          isActive: true,
          modulo: { status: 'active' },
        },
        select: {
          moduloId: true,
          allowedRoles: true,
          modulo: {
            select: {
              id: true,
              codigo: true,
              nome: true,
              allowedRoles: true,
              isPro: true,
            },
          },
        },
        orderBy: { activatedAt: 'asc' },
      }),
      prisma.$queryRaw<Array<{ userId: string; moduloId: string; isAllowed: boolean }>>(Prisma.sql`
        SELECT
          "user_id" AS "userId",
          "modulo_id" AS "moduloId",
          "is_allowed" AS "isAllowed"
        FROM "employee_module_permissions"
        WHERE "empresa_id" = ${companyId}
      `),
    ]);

    const modulesForStaff = companyModules
      .map((item: any) => ({
        id: item.modulo.id,
        codigo: item.modulo.codigo,
        nome: item.modulo.nome,
        allowed_roles: Array.isArray(item.allowedRoles) && item.allowedRoles.length > 0
          ? item.allowedRoles
          : Array.isArray(item.modulo.allowedRoles)
          ? item.modulo.allowedRoles
          : [],
        is_pro: Boolean(item.modulo.isPro),
      }))
      .filter((item: any) => {
        const roles = Array.isArray(item.allowed_roles) && item.allowed_roles.length > 0
          ? item.allowed_roles
          : ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'];
        return roles.includes('FUNCIONARIO_EMPRESA');
      });

    const permissionMap = new Map<string, boolean>();
    for (const row of permissionRows) {
      permissionMap.set(`${row.userId}:${row.moduloId}`, row.isAllowed !== false);
    }

    return {
      modules: modulesForStaff,
      members: members.map((member) => ({
        id: member.userId,
        full_name: member.user.fullName,
        email: member.user.email,
        is_active: member.user.isActive,
        permissions: modulesForStaff.map((modulo: any) => ({
          modulo_id: modulo.id,
          modulo_codigo: modulo.codigo,
          modulo_nome: modulo.nome,
          is_allowed: permissionMap.has(`${member.userId}:${modulo.id}`)
            ? Boolean(permissionMap.get(`${member.userId}:${modulo.id}`))
            : true,
        })),
      })),
    };
  }

  async upsertTeamMemberModulePermissions(
    user: AuthenticatedUser,
    payload: {
      member_id?: string;
      permissions?: Array<{
        modulo_id?: string;
        modulo_codigo?: string;
        is_allowed?: boolean;
      }>;
    }
  ) {
    this.ensureOwner(user);
    const companyId = this.ensureOwnerCompanyId(user);
    await this.ensureAnyModuleAccess(user, companyId, ['permissions', 'permissoes']);

    const memberId = String(payload.member_id || '').trim();
    if (!memberId) throw new CompanyServiceError('member_id obrigatorio', 400);

    const role = await prisma.userRole.findFirst({
      where: {
        companyId,
        userId: memberId,
        role: 'FUNCIONARIO_EMPRESA',
      },
      select: { id: true },
    });
    if (!role) {
      throw new CompanyServiceError('Funcionario nao encontrado para esta empresa', 404);
    }

    const permissions = Array.isArray(payload.permissions) ? payload.permissions : [];
    if (!permissions.length) {
      throw new CompanyServiceError('Envie ao menos uma permissao', 400);
    }

    const companyModules = await (prisma as any).companyModule.findMany({
      where: {
        companyId,
        isActive: true,
        modulo: { status: 'active' },
      },
      select: {
        moduloId: true,
        allowedRoles: true,
        modulo: {
          select: {
            id: true,
            codigo: true,
            allowedRoles: true,
          },
        },
      },
    });

    const moduleByCode = new Map<string, string>();
    const moduleById = new Set<string>();
    for (const item of companyModules) {
      const roles = Array.isArray(item.allowedRoles) && item.allowedRoles.length > 0
        ? item.allowedRoles
        : Array.isArray(item.modulo.allowedRoles) && item.modulo.allowedRoles.length > 0
        ? item.modulo.allowedRoles
        : ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'];
      if (!roles.includes('FUNCIONARIO_EMPRESA')) continue;
      moduleByCode.set(String(item.modulo.codigo || '').toLowerCase(), item.modulo.id);
      moduleById.add(item.modulo.id);
    }

    const normalized = permissions.map((entry) => {
      const moduleIdFromPayload = String(entry.modulo_id || '').trim();
      const moduleCodeFromPayload = String(entry.modulo_codigo || '').trim().toLowerCase();
      const moduloId =
        moduleIdFromPayload ||
        (moduleCodeFromPayload ? moduleByCode.get(moduleCodeFromPayload) || '' : '');

      if (!moduloId || !moduleById.has(moduloId)) {
        throw new CompanyServiceError('Modulo invalido para permissao de funcionario', 400);
      }

      return {
        moduloId,
        isAllowed: entry.is_allowed !== false,
      };
    });

    await prisma.$transaction(async (tx) => {
      for (const entry of normalized) {
        await this.upsertEmployeeModulePermission(tx as any, {
          companyId,
          userId: memberId,
          moduloId: entry.moduloId,
          isAllowed: entry.isAllowed,
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          companyId,
          action: 'TEAM_MEMBER_PERMISSIONS_UPDATED',
          resource: 'employee_module_permissions',
          details: {
            memberId,
            changes: normalized.length,
          },
        },
      });
    });

    this.moduleAccessCache.clear();
    return this.listTeamMemberModulePermissions(user);
  }

  async diagnoseTeamMemberModuleAccess(user: AuthenticatedUser, memberId: string) {
    this.ensureOwner(user);
    const companyId = this.ensureOwnerCompanyId(user);

    const membership = await prisma.userRole.findFirst({
      where: {
        companyId,
        userId: memberId,
        role: 'FUNCIONARIO_EMPRESA',
      },
      select: {
        userId: true,
        user: {
          select: {
            fullName: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    if (!membership?.user) {
      throw new CompanyServiceError('Funcionario nao encontrado nesta empresa', 404);
    }

    const [company, companyModules, permissionRows] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true,
          sistemaBaseId: true,
        },
      }),
      (prisma as any).companyModule.findMany({
        where: {
          companyId,
          isActive: true,
          modulo: { status: 'active' },
        },
        select: {
          moduloId: true,
          allowedRoles: true,
          modulo: {
            select: {
              id: true,
              codigo: true,
              nome: true,
              allowedRoles: true,
            },
          },
        },
        orderBy: { activatedAt: 'asc' },
      }),
      this.listEmployeeModulePermissionRows(prisma, companyId, memberId),
    ]);

    const sistemaBase = company?.sistemaBaseId
      ? await prisma.sistemaBase.findUnique({
          where: { id: company.sistemaBaseId },
          select: { id: true, nome: true },
        })
      : null;

    const deniedMap = new Map(
      permissionRows
        .filter((row) => row.isAllowed === false)
        .map((row) => [row.moduloId, true])
    );

    const modules = companyModules.map((item: any) => {
      const allowedRoles =
        Array.isArray(item.allowedRoles) && item.allowedRoles.length > 0
          ? item.allowedRoles
          : Array.isArray(item.modulo.allowedRoles) && item.modulo.allowedRoles.length > 0
          ? item.modulo.allowedRoles
          : ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'];

      const allowedForEmployee = allowedRoles.includes('FUNCIONARIO_EMPRESA');
      const blockedByOwner = deniedMap.has(item.modulo.id);
      return {
        modulo_id: item.modulo.id,
        modulo_codigo: item.modulo.codigo,
        modulo_nome: item.modulo.nome,
        allowed_roles: allowedRoles,
        allowed_for_employee: allowedForEmployee,
        blocked_by_owner: blockedByOwner,
        effective_access: allowedForEmployee && !blockedByOwner && membership.user.isActive,
      };
    });

    return {
      member: {
        id: membership.userId,
        full_name: membership.user.fullName,
        email: membership.user.email,
        is_active: membership.user.isActive,
      },
      company: {
        id: company?.id || companyId,
        name: company?.name || null,
        sistema_base_id: company?.sistemaBaseId || null,
        sistema_base_name: sistemaBase?.nome || null,
      },
      summary: {
        total_modules: modules.length,
        visible_modules: modules.filter((item: any) => item.effective_access).length,
        blocked_modules: modules.filter((item: any) => item.blocked_by_owner).length,
        role_allowed_modules: modules.filter((item: any) => item.allowed_for_employee).length,
      },
      modules,
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

  async getMyTheme(user: AuthenticatedUser, queryOrBody?: any) {
    const companyId = this.resolveCompanyId(user, queryOrBody || {});
    return prisma.companyTheme.findUnique({
      where: { companyId },
    });
  }

  async upsertMyTheme(
    user: AuthenticatedUser,
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
      company_id?: string;
      companyId?: string;
    }
  ) {
    const companyId = this.resolveCompanyId(user, data || {});
    const payload = {
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
      darkModeEnabled: data.dark_mode_enabled ?? true,
    };

    return prisma.companyTheme.upsert({
      where: { companyId },
      create: {
        companyId,
        ...payload,
      },
      update: payload,
    });
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
        select: { id: true, name: true, durationMinutes: true },
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
      let customerRecord: { id: string } | null = null;
      if (customerPhone) {
        const existingCustomer = await tx.customer.findFirst({
          where: { companyId: company.id, phone: customerPhone },
          select: { id: true, email: true, document: true },
        });

        if (existingCustomer) {
          customerRecord = await tx.customer.update({
            where: { id: existingCustomer.id },
            data: { name: customerName, isActive: true },
            select: { id: true },
          });
        } else {
          customerRecord = await tx.customer.create({
            data: {
              companyId: company.id,
              name: customerName,
              phone: customerPhone,
              isActive: true,
            },
            select: { id: true },
          });
        }
      } else {
        const existingByName = await tx.customer.findFirst({
          where: {
            companyId: company.id,
            name: { equals: customerName, mode: 'insensitive' },
          },
          select: { id: true },
        });
        customerRecord = existingByName;
      }

      const appointment = await (tx as any).appointment.create({
        data: {
          companyId: company.id,
          customerId: customerRecord?.id || null,
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
