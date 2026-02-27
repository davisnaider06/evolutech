import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { AuthenticatedCustomer } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_fallback_dev';
const CUSTOMER_JWT_EXPIRES_IN = (process.env.CUSTOMER_JWT_EXPIRES_IN || '24h') as jwt.SignOptions['expiresIn'];

type CustomerJwtPayload = {
  accountId: string;
  customerId: string;
  companyId: string;
  email: string;
  fullName: string;
  role: 'CLIENTE';
};

class CustomerAuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'CustomerAuthError';
  }
}

export class CustomerAuthService {
  private async ensureCustomerPortalEnabled(companyId: string) {
    const portalModule = await prisma.modulo.findFirst({
      where: {
        codigo: { in: ['customer_portal', 'portal_cliente'] },
        status: 'active',
      },
      select: { id: true },
    });

    if (!portalModule) {
      throw new CustomerAuthError('Modulo customer_portal nao encontrado no catalogo', 500);
    }

    const enabled = await prisma.companyModule.findFirst({
      where: {
        companyId,
        moduloId: portalModule.id,
        isActive: true,
      },
      select: { id: true },
    });

    if (!enabled) {
      throw new CustomerAuthError('Portal do cliente nao habilitado para esta empresa', 403);
    }
  }

  private signCustomerToken(payload: CustomerJwtPayload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: CUSTOMER_JWT_EXPIRES_IN });
  }

  async register(data: {
    company_slug?: string;
    full_name?: string;
    email?: string;
    phone?: string;
    password?: string;
  }) {
    const slug = String(data.company_slug || '').trim().toLowerCase();
    const fullName = String(data.full_name || '').trim();
    const email = String(data.email || '').trim().toLowerCase();
    const phone = String(data.phone || '').trim();
    const password = String(data.password || '');

    if (!slug || !fullName || !email || !password) {
      throw new CustomerAuthError(
        'Campos obrigatorios: company_slug, full_name, email, password',
        400
      );
    }

    if (password.length < 6) {
      throw new CustomerAuthError('Senha deve ter pelo menos 6 caracteres', 400);
    }

    const company = await prisma.company.findFirst({
      where: { slug, status: 'active' },
      select: { id: true, name: true, slug: true },
    });
    if (!company) throw new CustomerAuthError('Empresa nao encontrada', 404);

    await this.ensureCustomerPortalEnabled(company.id);

    const existingByEmail = await (prisma as any).customerAccount.findFirst({
      where: { companyId: company.id, email },
      select: { id: true },
    });
    if (existingByEmail) {
      throw new CustomerAuthError('Ja existe conta de cliente com este e-mail', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await prisma.$transaction(async (tx) => {
      const existingCustomer = await tx.customer.findFirst({
        where: {
          companyId: company.id,
          OR: [
            { email: { equals: email, mode: 'insensitive' } },
            ...(phone ? [{ phone }] : []),
          ],
        },
        select: { id: true, name: true },
      });

      const customer = existingCustomer
        ? await tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              name: fullName,
              email,
              phone: phone || null,
              isActive: true,
            },
          })
        : await tx.customer.create({
            data: {
              companyId: company.id,
              name: fullName,
              email,
              phone: phone || null,
              isActive: true,
            },
          });

      const account = await (tx as any).customerAccount.create({
        data: {
          companyId: company.id,
          customerId: customer.id,
          email,
          passwordHash,
          isActive: true,
        },
      });

      return { customer, account };
    });

    const token = this.signCustomerToken({
      accountId: created.account.id,
      customerId: created.customer.id,
      companyId: company.id,
      email: created.account.email,
      fullName: created.customer.name,
      role: 'CLIENTE',
    });

    return {
      token,
      customer: {
        id: created.customer.id,
        name: created.customer.name,
        email: created.account.email,
        role: 'CLIENTE',
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
      },
    };
  }

  async login(data: { company_slug?: string; email?: string; password?: string }) {
    const slug = String(data.company_slug || '').trim().toLowerCase();
    const email = String(data.email || '').trim().toLowerCase();
    const password = String(data.password || '');

    if (!slug || !email || !password) {
      throw new CustomerAuthError('Campos obrigatorios: company_slug, email, password', 400);
    }

    const company = await prisma.company.findFirst({
      where: { slug, status: 'active' },
      select: { id: true, name: true, slug: true },
    });
    if (!company) throw new CustomerAuthError('Empresa nao encontrada', 404);

    await this.ensureCustomerPortalEnabled(company.id);

    const account = await (prisma as any).customerAccount.findFirst({
      where: {
        companyId: company.id,
        email,
      },
      include: {
        customer: {
          select: { id: true, name: true, isActive: true },
        },
      },
    });

    if (!account) throw new CustomerAuthError('Credenciais invalidas', 401);
    if (!account.isActive || !account.customer?.isActive) {
      throw new CustomerAuthError('Conta de cliente inativa', 403);
    }

    const valid = await bcrypt.compare(password, String(account.passwordHash || ''));
    if (!valid) throw new CustomerAuthError('Credenciais invalidas', 401);

    await (prisma as any).customerAccount.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    });

    const token = this.signCustomerToken({
      accountId: account.id,
      customerId: account.customerId,
      companyId: account.companyId,
      email: account.email,
      fullName: account.customer?.name || '',
      role: 'CLIENTE',
    });

    return {
      token,
      customer: {
        id: account.customer?.id,
        name: account.customer?.name,
        email: account.email,
        role: 'CLIENTE',
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
      },
    };
  }

  async me(auth: AuthenticatedCustomer) {
    const account = await (prisma as any).customerAccount.findFirst({
      where: {
        id: auth.accountId,
        companyId: auth.companyId,
        customerId: auth.customerId,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
          },
        },
        company: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!account) throw new CustomerAuthError('Conta de cliente nao encontrada', 404);

    return {
      customer: {
        id: account.customer?.id,
        name: account.customer?.name,
        email: account.email,
        phone: account.customer?.phone || null,
        document: account.customer?.document || null,
        role: 'CLIENTE',
      },
      company: account.company,
    };
  }
}

export { CustomerAuthError };
