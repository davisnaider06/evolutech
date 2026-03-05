import { prisma } from '../db';
import { AuthenticatedCourseManager } from '../types';

class CourseAdminError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'CourseAdminError';
  }
}

export class CourseAdminService {
  private allowedContentTypes = new Set(['video', 'pdf', 'image', 'link', 'audio']);

  private toNumber(value: unknown): number {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private async ensureCoursesEnabled(companyId: string) {
    const moduleItem = await prisma.modulo.findFirst({
      where: {
        codigo: { in: ['courses', 'cursos'] },
        status: 'active',
      },
      select: { id: true },
    });
    if (!moduleItem) throw new CourseAdminError('Modulo courses nao encontrado', 500);

    const active = await prisma.companyModule.findFirst({
      where: {
        companyId,
        moduloId: moduleItem.id,
        isActive: true,
      },
      select: { id: true },
    });
    if (!active) throw new CourseAdminError('Modulo de cursos nao habilitado para esta empresa', 403);
  }

  private async ensureManagerActive(auth: AuthenticatedCourseManager) {
    const account = await (prisma as any).courseManagerAccount.findFirst({
      where: {
        id: auth.managerId,
        companyId: auth.companyId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!account) throw new CourseAdminError('Conta de cursos inativa', 403);
  }

  async listCourses(auth: AuthenticatedCourseManager) {
    await this.ensureManagerActive(auth);
    await this.ensureCoursesEnabled(auth.companyId);

    const rows = await (prisma as any).course.findMany({
      where: { companyId: auth.companyId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((item: any) => ({
      id: item.id,
      company_id: item.companyId,
      title: item.title,
      description: item.description,
      content_type: item.contentType || 'video',
      content_url: item.contentUrl || null,
      cover_image_url: item.coverImageUrl || null,
      price: this.toNumber(item.price),
      is_active: Boolean(item.isActive),
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }));
  }

  async createCourse(
    auth: AuthenticatedCourseManager,
    payload: {
      title?: string;
      description?: string;
      content_type?: string;
      content_url?: string;
      cover_image_url?: string;
      price?: number;
      is_active?: boolean;
    }
  ) {
    await this.ensureManagerActive(auth);
    await this.ensureCoursesEnabled(auth.companyId);

    const title = String(payload.title || '').trim();
    const description = String(payload.description || '').trim() || null;
    const contentType = String(payload.content_type || 'video').trim().toLowerCase();
    const contentUrl = String(payload.content_url || '').trim() || null;
    const coverImageUrl = String(payload.cover_image_url || '').trim() || null;
    const price = this.toNumber(payload.price);
    const isActive = payload.is_active !== false;

    if (!title) throw new CourseAdminError('title obrigatorio', 400);
    if (!this.allowedContentTypes.has(contentType)) {
      throw new CourseAdminError('content_type invalido. Use video, pdf, image, link ou audio', 400);
    }
    if (!contentUrl) throw new CourseAdminError('content_url obrigatorio', 400);
    if (price < 0) throw new CourseAdminError('price invalido', 400);

    const created = await (prisma as any).course.create({
      data: {
        companyId: auth.companyId,
        title,
        description,
        contentType,
        contentUrl,
        coverImageUrl,
        price,
        isActive,
      },
    });

    return {
      id: created.id,
      company_id: created.companyId,
      title: created.title,
      description: created.description,
      content_type: created.contentType,
      content_url: created.contentUrl,
      cover_image_url: created.coverImageUrl,
      price: this.toNumber(created.price),
      is_active: Boolean(created.isActive),
      created_at: created.createdAt,
      updated_at: created.updatedAt,
    };
  }

  async updateCourse(
    auth: AuthenticatedCourseManager,
    courseId: string,
    payload: {
      title?: string;
      description?: string;
      content_type?: string;
      content_url?: string;
      cover_image_url?: string;
      price?: number;
      is_active?: boolean;
    }
  ) {
    await this.ensureManagerActive(auth);
    await this.ensureCoursesEnabled(auth.companyId);

    const id = String(courseId || '').trim();
    if (!id) throw new CourseAdminError('courseId obrigatorio', 400);

    const existing = await (prisma as any).course.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true },
    });
    if (!existing) throw new CourseAdminError('Curso nao encontrado', 404);

    const contentTypeRaw = payload.content_type !== undefined
      ? String(payload.content_type || '').trim().toLowerCase()
      : undefined;
    if (contentTypeRaw && !this.allowedContentTypes.has(contentTypeRaw)) {
      throw new CourseAdminError('content_type invalido. Use video, pdf, image, link ou audio', 400);
    }

    const updated = await (prisma as any).course.update({
      where: { id },
      data: {
        title: payload.title !== undefined ? String(payload.title || '').trim() : undefined,
        description: payload.description !== undefined ? String(payload.description || '').trim() || null : undefined,
        contentType: contentTypeRaw,
        contentUrl: payload.content_url !== undefined ? String(payload.content_url || '').trim() || null : undefined,
        coverImageUrl: payload.cover_image_url !== undefined ? String(payload.cover_image_url || '').trim() || null : undefined,
        price: payload.price !== undefined ? this.toNumber(payload.price) : undefined,
        isActive: payload.is_active,
      },
    });

    return {
      id: updated.id,
      company_id: updated.companyId,
      title: updated.title,
      description: updated.description,
      content_type: updated.contentType,
      content_url: updated.contentUrl,
      cover_image_url: updated.coverImageUrl,
      price: this.toNumber(updated.price),
      is_active: Boolean(updated.isActive),
      created_at: updated.createdAt,
      updated_at: updated.updatedAt,
    };
  }

  async deleteCourse(auth: AuthenticatedCourseManager, courseId: string) {
    await this.ensureManagerActive(auth);
    await this.ensureCoursesEnabled(auth.companyId);

    const id = String(courseId || '').trim();
    if (!id) throw new CourseAdminError('courseId obrigatorio', 400);

    const existing = await (prisma as any).course.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true },
    });
    if (!existing) throw new CourseAdminError('Curso nao encontrado', 404);

    await (prisma as any).course.delete({ where: { id } });
    return { ok: true };
  }
}

export { CourseAdminError };
