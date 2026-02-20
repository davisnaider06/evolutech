import { prisma } from '../db';
import { AuthenticatedUser } from '../types';
import { TABLE_CONFIG } from '../config/tableConfig';
import bcrypt from 'bcryptjs';
import { TaskStatus } from '@prisma/client';

class CompanyServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'CompanyServiceError';
    this.statusCode = statusCode;
  }
}

export class CompanyService {
  private getModel(tableName: string) {
    const map: Record<string, any> = {
      customers: prisma.customer,
      products: prisma.product,
      appointments: prisma.appointment,
      orders: prisma.order,
    };
    return map[tableName];
  }

  private isAdminRole(role: AuthenticatedUser['role']) {
    return role === 'SUPER_ADMIN_EVOLUTECH' || role === 'ADMIN_EVOLUTECH';
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
      throw new CompanyServiceError(
        `Módulo "${moduleCodes[0]}" não está ativo para esta empresa`,
        403
      );
    }
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

    if (search && config.searchFields.length > 0) {
      where.OR = config.searchFields.map((field) => ({
        [field]: { contains: search, mode: 'insensitive' },
      }));
    }

    if (queryParams.is_active !== undefined) {
      where.isActive = String(queryParams.is_active) === 'true';
    }

    if (queryParams.status) {
      where.status = queryParams.status;
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

    return model.create({ data: payload });
  }

  async updateRecord(table: string, id: string, user: AuthenticatedUser, data: any) {
    const model = this.getModel(table);
    if (!model) throw new CompanyServiceError('Tabela não suportada', 400);

    const existing = await model.findUnique({ where: { id }, select: { companyId: true } });
    if (!existing) throw new CompanyServiceError('Registro não encontrado', 404);
    if (!this.checkAccess(user, existing.companyId)) throw new CompanyServiceError('Acesso negado', 403);

    await this.validateModuleAccess(table, user, existing.companyId);

    const payload = { ...data };
    delete payload.id;
    delete payload.companyId;
    delete payload.company_id;

    return model.update({
      where: { id },
      data: payload,
    });
  }

  async deleteRecord(table: string, id: string, user: AuthenticatedUser) {
    const model = this.getModel(table);
    if (!model) throw new CompanyServiceError('Tabela não suportada', 400);

    const existing = await model.findUnique({ where: { id }, select: { companyId: true } });
    if (!existing) throw new CompanyServiceError('Registro não encontrado', 404);
    if (!this.checkAccess(user, existing.companyId)) throw new CompanyServiceError('Acesso negado', 403);

    await this.validateModuleAccess(table, user, existing.companyId);

    await model.delete({ where: { id } });
    return { success: true };
  }

  private async ensureAnyModuleAccess(user: AuthenticatedUser, companyId: string, moduleCodes: string[]) {
    if (this.isAdminRole(user.role)) return;

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
      throw new CompanyServiceError(`Modulo "${moduleCodes[0]}" nao esta ativo para esta empresa`, 403);
    }
  }

  async listPdvProducts(user: AuthenticatedUser, queryParams: any) {
    const companyId = this.resolveCompanyId(user, queryParams);
    await this.ensureAnyModuleAccess(user, companyId, ['pdv', 'orders', 'pedidos']);
    await this.ensureAnyModuleAccess(user, companyId, ['products', 'produtos']);

    const search = String(queryParams.search || '').trim();

    return prisma.product.findMany({
      where: {
        companyId,
        isActive: true,
        stockQuantity: { gt: 0 },
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
    });
  }

  async checkoutPdv(
    user: AuthenticatedUser,
    data: {
      customerName?: string;
      paymentMethod: string;
      discount?: number;
      items: Array<{ productId: string; quantity: number }>;
    }
  ) {
    const companyId = this.resolveCompanyId(user, data);
    await this.ensureAnyModuleAccess(user, companyId, ['pdv', 'orders', 'pedidos']);
    await this.ensureAnyModuleAccess(user, companyId, ['products', 'produtos']);

    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) throw new CompanyServiceError('Carrinho vazio', 400);
    if (!data.paymentMethod) throw new CompanyServiceError('Forma de pagamento obrigatoria', 400);

    const normalizedItems = items.map((item) => ({
      productId: String(item.productId || '').trim(),
      quantity: Number(item.quantity || 0),
    }));

    if (normalizedItems.some((item) => !item.productId || item.quantity <= 0)) {
      throw new CompanyServiceError('Itens invalidos no carrinho', 400);
    }

    return prisma.$transaction(async (tx) => {
      const ids = Array.from(new Set(normalizedItems.map((item) => item.productId)));
      const products = await tx.product.findMany({
        where: { id: { in: ids }, companyId, isActive: true },
      });
      const map = new Map(products.map((product) => [product.id, product]));

      let subtotal = 0;
      const soldItems = normalizedItems.map((item) => {
        const product = map.get(item.productId);
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
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
          remainingStock: product.stockQuantity - item.quantity,
        };
      });

      for (const item of soldItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: item.remainingStock,
          },
        });
      }

      const discount = Math.max(0, Number(data.discount || 0));
      const total = Math.max(0, subtotal - discount);

      const order = await tx.order.create({
        data: {
          companyId,
          customerName: data.customerName?.trim() || null,
          status: data.paymentMethod === 'pix' ? 'pending_pix' : 'paid',
          total,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          companyId,
          action: 'PDV_CHECKOUT',
          resource: 'orders',
          details: {
            orderId: order.id,
            paymentMethod: data.paymentMethod,
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
      };
    });
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

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'paid' },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId,
        action: 'PIX_CONFIRMED',
        resource: 'orders',
        details: {
          orderId: updated.id,
          previousStatus: order.status,
          newStatus: updated.status,
        },
      },
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

  private ensureOwner(user: AuthenticatedUser) {
    if (user.role !== 'DONO_EMPRESA') {
      throw new CompanyServiceError('Somente dono da empresa pode executar esta acao', 403);
    }
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

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new CompanyServiceError('Ja existe usuario com este e-mail', 409);
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const created = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          fullName,
          passwordHash,
          isActive: true,
        },
      });

      await tx.userRole.create({
        data: {
          userId: newUser.id,
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
            memberId: newUser.id,
            memberEmail: newUser.email,
            memberRole: 'FUNCIONARIO_EMPRESA',
          },
        },
      });

      return newUser;
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
}

export { CompanyServiceError };
