import { prisma } from '../db';
import { AuthenticatedUser } from '../types';

class DashboardServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'DashboardServiceError';
    this.statusCode = statusCode;
  }
}

export class DashboardService {
  private isEvolutechRole(role: AuthenticatedUser['role']) {
    return role === 'SUPER_ADMIN_EVOLUTECH' || role === 'ADMIN_EVOLUTECH';
  }

  private resolveCompanyId(user: AuthenticatedUser, queryParams: any): string {
    const isEvolutech = this.isEvolutechRole(user.role);
    const companyId = isEvolutech ? (queryParams.company_id || user.companyId) : user.companyId;

    if (!companyId) {
      throw new DashboardServiceError('Company ID obrigatório', 400);
    }

    if (!isEvolutech && user.companyId !== companyId) {
      throw new DashboardServiceError('Acesso negado', 403);
    }

    return companyId;
  }

  private async ensureDashboardModule(companyId: string, user: AuthenticatedUser) {
    if (this.isEvolutechRole(user.role) || user.role === 'DONO_EMPRESA') return;

    const hasAccess = await prisma.companyModule.findFirst({
      where: {
        companyId,
        isActive: true,
        modulo: {
          codigo: 'dashboard',
          status: 'active',
        },
      },
      select: { id: true },
    });

    if (!hasAccess) {
      throw new DashboardServiceError('Módulo dashboard não está ativo para esta empresa', 403);
    }
  }

  async getMetrics(user: AuthenticatedUser, queryParams: any) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureDashboardModule(companyId, user);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      company,
      employeesTotal,
      customersTotal,
      customersActive,
      productsTotal,
      stockAgg,
      appointmentsToday,
      upcomingAppointments,
      monthOrdersAgg,
      totalOrdersAgg,
      recentAppointments,
      recentOrders,
    ] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          status: true,
        },
      }),
      prisma.userRole.count({
        where: {
          companyId,
          role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
        },
      }),
      prisma.customer.count({ where: { companyId } }),
      prisma.customer.count({ where: { companyId, isActive: true } }),
      prisma.product.count({ where: { companyId } }),
      prisma.product.aggregate({ where: { companyId }, _sum: { stockQuantity: true } }),
      prisma.appointment.count({
        where: { companyId, scheduledAt: { gte: startOfToday, lt: endOfToday } },
      }),
      prisma.appointment.count({
        where: { companyId, scheduledAt: { gte: now } },
      }),
      prisma.order.aggregate({
        where: { companyId, status: 'paid', createdAt: { gte: startOfMonth } },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.order.aggregate({
        where: { companyId, status: 'paid' },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.appointment.findMany({
        where: { companyId },
        orderBy: { scheduledAt: 'desc' },
        take: 5,
        select: {
          id: true,
          customerName: true,
          serviceName: true,
          status: true,
          scheduledAt: true,
        },
      }),
      prisma.order.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          customerName: true,
          total: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    if (!company) {
      throw new DashboardServiceError('Empresa não encontrada', 404);
    }

    return {
      company,
      summary: {
        employeesTotal,
        customersTotal,
        customersActive,
        productsTotal,
        stockTotal: stockAgg._sum.stockQuantity || 0,
        appointmentsToday,
        upcomingAppointments,
        ordersMonthCount: monthOrdersAgg._count.id || 0,
        ordersTotalCount: totalOrdersAgg._count.id || 0,
        revenueMonth: Number(monthOrdersAgg._sum.total || 0),
        revenueTotal: Number(totalOrdersAgg._sum.total || 0),
      },
      recentAppointments,
      recentOrders: recentOrders.map((order) => ({
        ...order,
        total: Number(order.total || 0),
      })),
    };
  }
}

export { DashboardServiceError };
