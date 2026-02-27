import { prisma } from '../db';
import { AuthenticatedCustomer } from '../types';

class CustomerPortalError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'CustomerPortalError';
    this.statusCode = statusCode;
  }
}

export class CustomerPortalService {
  private normalizeAppointmentStatus(input?: string, fallback = 'pendente') {
    const raw = String(input || '')
      .trim()
      .toLowerCase();
    const aliasMap: Record<string, string> = {
      scheduled: 'pendente',
      pending: 'pendente',
      confirmed: 'confirmado',
      canceled: 'cancelado',
      cancelled: 'cancelado',
      completed: 'concluido',
      done: 'concluido',
      'no-show': 'no_show',
      noshow: 'no_show',
    };
    const normalized = aliasMap[raw] || raw || fallback;
    const allowed = new Set(['pendente', 'confirmado', 'cancelado', 'concluido', 'no_show']);
    if (!allowed.has(normalized)) {
      throw new CustomerPortalError('Status invalido de agendamento', 400);
    }
    return normalized;
  }

  private toNumber(value: unknown) {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  private async getCustomerContext(auth: AuthenticatedCustomer) {
    const account = await (prisma as any).customerAccount.findFirst({
      where: {
        id: auth.accountId,
        companyId: auth.companyId,
        customerId: auth.customerId,
        isActive: true,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    if (!account || !account.customer?.isActive || account.company?.status !== 'active') {
      throw new CustomerPortalError('Conta de cliente inativa ou indisponivel', 403);
    }

    return account;
  }

  async getDashboard(auth: AuthenticatedCustomer) {
    const context = await this.getCustomerContext(auth);

    const [appointmentsTotal, upcomingAppointments, activeSubscriptions, loyaltyProfile, courseAccesses] =
      await Promise.all([
        (prisma as any).appointment.count({
          where: {
            companyId: context.companyId,
            OR: [
              { customerId: context.customerId },
              { customerName: { equals: context.customer.name, mode: 'insensitive' } },
            ],
          },
        }),
        (prisma as any).appointment.count({
          where: {
            companyId: context.companyId,
            OR: [
              { customerId: context.customerId },
              { customerName: { equals: context.customer.name, mode: 'insensitive' } },
            ],
            scheduledAt: { gte: new Date() },
            status: { in: ['pendente', 'confirmado'] },
          },
        }),
        (prisma as any).customerSubscription.count({
          where: {
            companyId: context.companyId,
            customerId: context.customerId,
            status: { in: ['active', 'pending'] },
          },
        }),
        (prisma as any).customerLoyaltyProfile.findFirst({
          where: { companyId: context.companyId, customerId: context.customerId },
          select: { pointsBalance: true, cashbackBalance: true, totalServicesCount: true },
        }),
        (prisma as any).courseAccess.count({
          where: {
            companyId: context.companyId,
            customerId: context.customerId,
            status: { in: ['active', 'pending'] },
          },
        }),
      ]);

    return {
      customer: {
        id: context.customer.id,
        name: context.customer.name,
        email: context.customer.email,
        phone: context.customer.phone,
      },
      company: context.company,
      summary: {
        appointments_total: appointmentsTotal,
        upcoming_appointments: upcomingAppointments,
        active_subscriptions: activeSubscriptions,
        active_courses: courseAccesses,
        loyalty_points: this.toNumber(loyaltyProfile?.pointsBalance),
        loyalty_cashback: this.toNumber(loyaltyProfile?.cashbackBalance),
        total_services: Number(loyaltyProfile?.totalServicesCount || 0),
      },
    };
  }

  async listMyAppointments(auth: AuthenticatedCustomer, query: { status?: string; from?: string; to?: string }) {
    const context = await this.getCustomerContext(auth);
    const where: any = {
      companyId: context.companyId,
      OR: [
        { customerId: context.customerId },
        { customerName: { equals: context.customer.name, mode: 'insensitive' } },
      ],
    };

    if (query.status) {
      where.status = this.normalizeAppointmentStatus(query.status);
    }
    if (query.from || query.to) {
      where.scheduledAt = {};
      if (query.from) where.scheduledAt.gte = new Date(query.from);
      if (query.to) where.scheduledAt.lte = new Date(query.to);
    }

    const appointments = await (prisma as any).appointment.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
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
    });

    return appointments.map((item: any) => ({
      id: item.id,
      customer_id: item.customerId || context.customerId,
      customer_name: item.customerName,
      service_id: item.serviceId,
      service_name: item.serviceName,
      professional_id: item.professionalId,
      professional_name: item.professionalName,
      scheduled_at: item.scheduledAt,
      status: this.normalizeAppointmentStatus(item.status),
      created_at: item.createdAt,
    }));
  }

  async cancelMyAppointment(auth: AuthenticatedCustomer, appointmentId: string) {
    const context = await this.getCustomerContext(auth);
    const id = String(appointmentId || '').trim();
    if (!id) throw new CustomerPortalError('appointmentId obrigatorio', 400);

    const appointment = await (prisma as any).appointment.findFirst({
      where: {
        id,
        companyId: context.companyId,
        OR: [
          { customerId: context.customerId },
          { customerName: { equals: context.customer.name, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
      },
    });

    if (!appointment) throw new CustomerPortalError('Agendamento nao encontrado', 404);
    const normalizedStatus = this.normalizeAppointmentStatus(appointment.status);
    if (normalizedStatus === 'cancelado' || normalizedStatus === 'concluido') {
      throw new CustomerPortalError('Agendamento nao pode mais ser cancelado', 400);
    }

    const updated = await (prisma as any).appointment.update({
      where: { id },
      data: { status: 'cancelado' },
      select: { id: true, status: true, scheduledAt: true },
    });

    await prisma.auditLog.create({
      data: {
        companyId: context.companyId,
        action: 'CUSTOMER_APPOINTMENT_CANCELED',
        resource: 'appointments',
        details: {
          appointmentId: updated.id,
          customerId: context.customerId,
          accountId: context.id,
          canceledAt: new Date().toISOString(),
        },
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      scheduled_at: updated.scheduledAt,
    };
  }

  async listMySubscriptions(auth: AuthenticatedCustomer) {
    const context = await this.getCustomerContext(auth);

    const rows = await (prisma as any).customerSubscription.findMany({
      where: {
        companyId: context.companyId,
        customerId: context.customerId,
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            description: true,
            interval: true,
            price: true,
            includedServices: true,
            isUnlimited: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((item: any) => ({
      id: item.id,
      status: item.status,
      start_at: item.startAt,
      end_at: item.endAt,
      remaining_services: item.remainingServices,
      auto_renew: item.autoRenew,
      amount: this.toNumber(item.amount),
      plan: item.plan
        ? {
            id: item.plan.id,
            name: item.plan.name,
            description: item.plan.description,
            interval: item.plan.interval,
            price: this.toNumber(item.plan.price),
            included_services: item.plan.includedServices,
            is_unlimited: item.plan.isUnlimited,
          }
        : null,
    }));
  }

  async getMyLoyalty(auth: AuthenticatedCustomer) {
    const context = await this.getCustomerContext(auth);

    const [settings, profile, history] = await Promise.all([
      (prisma as any).companyLoyaltySettings.findUnique({
        where: { companyId: context.companyId },
      }),
      (prisma as any).customerLoyaltyProfile.findFirst({
        where: { companyId: context.companyId, customerId: context.customerId },
      }),
      (prisma as any).customerLoyaltyTransaction.findMany({
        where: { companyId: context.companyId, customerId: context.customerId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    return {
      settings: settings
        ? {
            points_per_service: Number(settings.pointsPerService || 1),
            cashback_percent: this.toNumber(settings.cashbackPercent),
            tenth_service_free: Boolean(settings.tenthServiceFree),
            point_value: this.toNumber(settings.pointValue),
            is_active: Boolean(settings.isActive),
          }
        : null,
      profile: profile
        ? {
            points_balance: this.toNumber(profile.pointsBalance),
            cashback_balance: this.toNumber(profile.cashbackBalance),
            total_points_earned: this.toNumber(profile.totalPointsEarned),
            total_points_redeemed: this.toNumber(profile.totalPointsRedeemed),
            total_cashback_earned: this.toNumber(profile.totalCashbackEarned),
            total_cashback_used: this.toNumber(profile.totalCashbackUsed),
            total_services_count: Number(profile.totalServicesCount || 0),
          }
        : null,
      transactions: history.map((item: any) => ({
        id: item.id,
        type: item.transactionType,
        points_delta: this.toNumber(item.pointsDelta),
        cashback_delta: this.toNumber(item.cashbackDelta),
        amount_reference: this.toNumber(item.amountReference),
        notes: item.notes || null,
        created_at: item.createdAt,
      })),
    };
  }

  async listMyCourses(auth: AuthenticatedCustomer) {
    const context = await this.getCustomerContext(auth);

    const accesses = await (prisma as any).courseAccess.findMany({
      where: {
        companyId: context.companyId,
        customerId: context.customerId,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return accesses.map((item: any) => ({
      access_id: item.id,
      status: item.status,
      start_at: item.startAt,
      end_at: item.endAt,
      amount_paid: this.toNumber(item.amountPaid),
      course: item.course
        ? {
            id: item.course.id,
            title: item.course.title,
            description: item.course.description,
            price: this.toNumber(item.course.price),
            is_active: item.course.isActive,
          }
        : null,
    }));
  }

  async getBookingOptions(auth: AuthenticatedCustomer) {
    const context = await this.getCustomerContext(auth);
    const [services, professionals] = await Promise.all([
      (prisma as any).appointmentService.findMany({
        where: { companyId: context.companyId, isActive: true },
        select: { id: true, name: true, durationMinutes: true, price: true },
        orderBy: { name: 'asc' },
      }),
      prisma.userRole.findMany({
        where: {
          companyId: context.companyId,
          role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
          user: { isActive: true },
        },
        select: {
          userId: true,
          user: { select: { fullName: true } },
        },
        orderBy: { user: { fullName: 'asc' } },
      }),
    ]);

    return {
      services: services.map((item: any) => ({
        id: item.id,
        name: item.name,
        duration_minutes: Number(item.durationMinutes || 30),
        price: this.toNumber(item.price),
      })),
      professionals: professionals.map((item: any) => ({
        id: item.userId,
        name: item.user.fullName,
      })),
    };
  }

  async createMyAppointment(
    auth: AuthenticatedCustomer,
    payload: { service_id?: string; professional_id?: string; scheduled_at?: string }
  ) {
    const context = await this.getCustomerContext(auth);
    const serviceId = String(payload.service_id || '').trim();
    const professionalId = String(payload.professional_id || '').trim();
    const scheduledAtRaw = String(payload.scheduled_at || '').trim();
    if (!serviceId || !professionalId || !scheduledAtRaw) {
      throw new CustomerPortalError('Campos obrigatorios: service_id, professional_id, scheduled_at', 400);
    }

    const scheduledAt = new Date(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
      throw new CustomerPortalError('Data/hora invalida para agendamento', 400);
    }

    const [service, professional] = await Promise.all([
      (prisma as any).appointmentService.findFirst({
        where: { id: serviceId, companyId: context.companyId, isActive: true },
        select: { id: true, name: true, durationMinutes: true },
      }),
      prisma.userRole.findFirst({
        where: {
          companyId: context.companyId,
          userId: professionalId,
          role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
          user: { isActive: true },
        },
        select: { userId: true, user: { select: { fullName: true } } },
      }),
    ]);

    if (!service || !professional) {
      throw new CustomerPortalError('Servico ou profissional invalido', 400);
    }

    const conflict = await (prisma as any).appointment.findFirst({
      where: {
        companyId: context.companyId,
        professionalId: professional.userId,
        scheduledAt,
        status: { in: ['pendente', 'confirmado'] },
      },
      select: { id: true },
    });
    if (conflict) {
      throw new CustomerPortalError('Horario ja reservado. Escolha outro horario', 409);
    }

    const created = await (prisma as any).appointment.create({
      data: {
        companyId: context.companyId,
        customerId: context.customerId,
        serviceId: service.id,
        professionalId: professional.userId,
        customerName: context.customer.name,
        serviceName: service.name,
        professionalName: professional.user.fullName,
        scheduledAt,
        status: 'pendente',
      },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        serviceName: true,
        professionalName: true,
      },
    });

    return {
      id: created.id,
      scheduled_at: created.scheduledAt,
      status: created.status,
      service_name: created.serviceName,
      professional_name: created.professionalName,
    };
  }

  async listAvailablePlans(auth: AuthenticatedCustomer) {
    const context = await this.getCustomerContext(auth);
    const plans = await (prisma as any).subscriptionPlan.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return plans.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      interval: item.interval,
      price: this.toNumber(item.price),
      included_services: item.includedServices,
      is_unlimited: item.isUnlimited,
    }));
  }

  async subscribePlan(auth: AuthenticatedCustomer, planIdRaw: string) {
    const context = await this.getCustomerContext(auth);
    const planId = String(planIdRaw || '').trim();
    if (!planId) throw new CustomerPortalError('planId obrigatorio', 400);

    const plan = await (prisma as any).subscriptionPlan.findFirst({
      where: { id: planId, companyId: context.companyId, isActive: true },
      select: {
        id: true,
        interval: true,
        price: true,
        includedServices: true,
        isUnlimited: true,
      },
    });
    if (!plan) throw new CustomerPortalError('Plano nao encontrado', 404);

    const startAt = new Date();
    const endAt = new Date(startAt);
    if (plan.interval === 'yearly') endAt.setFullYear(endAt.getFullYear() + 1);
    else if (plan.interval === 'quarterly') endAt.setMonth(endAt.getMonth() + 3);
    else endAt.setMonth(endAt.getMonth() + 1);

    const created = await (prisma as any).customerSubscription.create({
      data: {
        companyId: context.companyId,
        customerId: context.customerId,
        planId: plan.id,
        status: 'active',
        startAt,
        endAt,
        remainingServices: plan.isUnlimited ? null : Number(plan.includedServices || 0),
        autoRenew: true,
        amount: this.toNumber(plan.price),
      },
      select: { id: true, status: true, startAt: true, endAt: true },
    });

    return {
      id: created.id,
      status: created.status,
      start_at: created.startAt,
      end_at: created.endAt,
    };
  }

  async listAvailableCourses(auth: AuthenticatedCustomer) {
    const context = await this.getCustomerContext(auth);
    const courses = await (prisma as any).course.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return courses.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      price: this.toNumber(item.price),
    }));
  }

  async purchaseCourse(auth: AuthenticatedCustomer, courseIdRaw: string) {
    const context = await this.getCustomerContext(auth);
    const courseId = String(courseIdRaw || '').trim();
    if (!courseId) throw new CustomerPortalError('courseId obrigatorio', 400);

    const course = await (prisma as any).course.findFirst({
      where: { id: courseId, companyId: context.companyId, isActive: true },
      select: { id: true, price: true },
    });
    if (!course) throw new CustomerPortalError('Curso nao encontrado', 404);

    const existing = await (prisma as any).courseAccess.findFirst({
      where: { companyId: context.companyId, customerId: context.customerId, courseId: course.id, status: 'active' },
      select: { id: true },
    });
    if (existing) {
      throw new CustomerPortalError('Curso ja adquirido', 409);
    }

    const created = await (prisma as any).courseAccess.create({
      data: {
        companyId: context.companyId,
        customerId: context.customerId,
        courseId: course.id,
        status: 'active',
        amountPaid: this.toNumber(course.price),
      },
      select: { id: true, status: true, startAt: true },
    });

    return {
      access_id: created.id,
      status: created.status,
      start_at: created.startAt,
    };
  }
}

export { CustomerPortalError };
