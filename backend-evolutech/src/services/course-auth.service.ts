import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { AuthenticatedCourseManager } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_fallback_dev';
const COURSE_MANAGER_JWT_EXPIRES_IN = (process.env.COURSE_MANAGER_JWT_EXPIRES_IN || '24h') as jwt.SignOptions['expiresIn'];

type CourseManagerJwtPayload = {
  managerId: string;
  companyId: string;
  email: string;
  role: 'COURSE_MANAGER';
};

class CourseAuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'CourseAuthError';
  }
}

export class CourseAuthService {
  private async getCoursesModuleId() {
    const moduleItem = await prisma.modulo.findFirst({
      where: {
        codigo: { in: ['courses', 'cursos'] },
        status: 'active',
      },
      select: { id: true },
    });
    if (!moduleItem) {
      throw new CourseAuthError('Modulo courses nao encontrado no catalogo', 500);
    }
    return moduleItem.id;
  }

  private async ensureCoursesEnabled(companyId: string) {
    const coursesModuleId = await this.getCoursesModuleId();
    const enabled = await prisma.companyModule.findFirst({
      where: {
        companyId,
        moduloId: coursesModuleId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!enabled) {
      throw new CourseAuthError('Modulo de cursos nao habilitado para esta empresa', 403);
    }
  }

  private signToken(payload: CourseManagerJwtPayload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: COURSE_MANAGER_JWT_EXPIRES_IN });
  }

  async listCompanies() {
    const coursesModuleId = await this.getCoursesModuleId();
    const rows = await prisma.companyModule.findMany({
      where: {
        moduloId: coursesModuleId,
        isActive: true,
        company: { status: 'active' },
      },
      select: {
        company: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
      },
      orderBy: {
        company: { name: 'asc' },
      },
    });

    const mapped = rows
      .map((row) => row.company)
      .filter(
        (company): company is { id: string; name: string; slug: string; logoUrl: string | null } =>
          Boolean(company)
      );
    const uniqueBySlug = new Map<string, { id: string; name: string; slug: string; logo_url: string | null }>();
    for (const company of mapped) {
      if (!uniqueBySlug.has(company.slug)) {
        uniqueBySlug.set(company.slug, {
          id: company.id,
          name: company.name,
          slug: company.slug,
          logo_url: company.logoUrl || null,
        });
      }
    }
    return Array.from(uniqueBySlug.values());
  }

  async register(data: { company_slug?: string; email?: string; password?: string }) {
    const slug = String(data.company_slug || '').trim().toLowerCase();
    const email = String(data.email || '').trim().toLowerCase();
    const password = String(data.password || '');

    if (!slug || !email || !password) {
      throw new CourseAuthError('Campos obrigatorios: company_slug, email, password', 400);
    }
    if (password.length < 6) {
      throw new CourseAuthError('Senha deve ter pelo menos 6 caracteres', 400);
    }

    const company = await prisma.company.findFirst({
      where: { slug, status: 'active' },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
    if (!company) throw new CourseAuthError('Empresa nao encontrada', 404);

    await this.ensureCoursesEnabled(company.id);

    const ownerRole = await prisma.userRole.findFirst({
      where: {
        companyId: company.id,
        role: 'DONO_EMPRESA',
        user: {
          email: { equals: email, mode: 'insensitive' },
          isActive: true,
        },
      },
      select: { id: true },
    });
    if (!ownerRole) {
      throw new CourseAuthError('Somente email do DONO_EMPRESA pode criar conta de cursos', 403);
    }

    const existing = await (prisma as any).courseManagerAccount.findFirst({
      where: { companyId: company.id, email },
      select: { id: true },
    });
    if (existing) {
      throw new CourseAuthError('Conta de cursos ja cadastrada para este e-mail', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await (prisma as any).courseManagerAccount.create({
      data: {
        companyId: company.id,
        email,
        passwordHash,
        isActive: true,
      },
      select: { id: true, email: true, companyId: true },
    });

    const token = this.signToken({
      managerId: created.id,
      companyId: created.companyId,
      email: created.email,
      role: 'COURSE_MANAGER',
    });

    return {
      token,
      manager: {
        id: created.id,
        email: created.email,
        role: 'COURSE_MANAGER',
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logo_url: company.logoUrl || null,
      },
    };
  }

  async login(data: { company_slug?: string; email?: string; password?: string }) {
    const slug = String(data.company_slug || '').trim().toLowerCase();
    const email = String(data.email || '').trim().toLowerCase();
    const password = String(data.password || '');

    if (!slug || !email || !password) {
      throw new CourseAuthError('Campos obrigatorios: company_slug, email, password', 400);
    }

    const company = await prisma.company.findFirst({
      where: { slug, status: 'active' },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
    if (!company) throw new CourseAuthError('Empresa nao encontrada', 404);
    await this.ensureCoursesEnabled(company.id);

    const account = await (prisma as any).courseManagerAccount.findFirst({
      where: { companyId: company.id, email },
      select: { id: true, companyId: true, email: true, passwordHash: true, isActive: true },
    });
    if (!account) throw new CourseAuthError('Credenciais invalidas', 401);
    if (!account.isActive) throw new CourseAuthError('Conta inativa', 403);

    const valid = await bcrypt.compare(password, String(account.passwordHash || ''));
    if (!valid) throw new CourseAuthError('Credenciais invalidas', 401);

    await (prisma as any).courseManagerAccount.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    });

    const token = this.signToken({
      managerId: account.id,
      companyId: account.companyId,
      email: account.email,
      role: 'COURSE_MANAGER',
    });

    return {
      token,
      manager: {
        id: account.id,
        email: account.email,
        role: 'COURSE_MANAGER',
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logo_url: company.logoUrl || null,
      },
    };
  }

  async me(auth: AuthenticatedCourseManager) {
    const account = await (prisma as any).courseManagerAccount.findFirst({
      where: {
        id: auth.managerId,
        companyId: auth.companyId,
        isActive: true,
      },
      include: {
        company: {
          select: { id: true, name: true, slug: true, logoUrl: true, status: true },
        },
      },
    });
    if (!account || account.company?.status !== 'active') {
      throw new CourseAuthError('Conta de cursos nao encontrada ou inativa', 404);
    }
    await this.ensureCoursesEnabled(account.companyId);

    return {
      manager: {
        id: account.id,
        email: account.email,
        role: 'COURSE_MANAGER' as const,
      },
      company: {
        id: account.company.id,
        name: account.company.name,
        slug: account.company.slug,
        logo_url: account.company.logoUrl || null,
      },
    };
  }
}

export { CourseAuthError };
