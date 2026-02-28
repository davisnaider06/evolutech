import bcrypt from 'bcryptjs';
import { Role, Status } from '@prisma/client';
import { prisma } from '../db';

export interface CreateTenantInput {
  companyName: string;
  companyDocument?: string;
  companyPlan?: string;
  companyStatus?: 'active' | 'inactive' | 'pending';
  sistemaBaseId: string;
  ownerFullName?: string;
  ownerEmail?: string;
  ownerPassword?: string;
}

interface TenantOnboardingResult {
  company: {
    id: string;
    name: string;
    slug: string;
    sistemaBaseId: string;
  };
  owner: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
  };
  modulosLiberados: {
    total: number;
    moduloIds: string[];
  };
  credentials: {
    email: string;
    temporaryPassword: string;
    requiresPasswordChange: boolean;
  };
}

const ALLOWED_COMPANY_STATUS: ReadonlySet<Status> = new Set(['active', 'inactive', 'pending']);
const OWNER_ROLE: Role = 'DONO_EMPRESA';
const APPOINTMENTS_CODES = new Set(['agendamentos', 'appointments']);

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const toSlug = (value: string): string =>
  normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const resolveCompanyStatus = (statusInput?: string): Status => {
  const value = (statusInput || 'active').trim().toLowerCase() as Status;
  return ALLOWED_COMPANY_STATUS.has(value) ? value : 'active';
};

const generateTemporaryPassword = (): string => {
  const randomBlock = Math.random().toString(36).slice(2, 10);
  return `Ev0!${randomBlock}`;
};

export class TenantService {
  async onboardTenant(input: CreateTenantInput): Promise<TenantOnboardingResult> {
    const companyName = input.companyName?.trim();
    const sistemaBaseId = input.sistemaBaseId?.trim();
    const companyDocument = input.companyDocument?.trim();
    const companyStatus = resolveCompanyStatus(input.companyStatus);

    if (!companyName || !sistemaBaseId) {
      throw new Error('Campos obrigatorios ausentes para onboarding');
    }

    const ownerFullName =
      String(input.ownerFullName || '').trim() || `Dono ${companyName}`;
    const ownerEmailInput = String(input.ownerEmail || '').trim().toLowerCase();
    const ownerEmail =
      ownerEmailInput ||
      `${toSlug(companyName)}.owner@evolutech.local`;
    const temporaryPassword = String(input.ownerPassword || '').trim() || generateTemporaryPassword();
    const ownerPasswordHash = await bcrypt.hash(temporaryPassword, 10);

    const created = await prisma.$transaction(async (tx) => {
      const sistemaBase = await tx.sistemaBase.findUnique({
        where: { id: sistemaBaseId },
        include: {
          modulos: {
            select: {
              moduloId: true,
              modulo: { select: { codigo: true } },
            },
          },
        },
      });

      if (!sistemaBase) throw new Error('Sistema Base nao encontrado');
      if (!sistemaBase.isActive) throw new Error('Sistema Base inativo');

      const slugBase = toSlug(companyName);
      if (!slugBase) throw new Error('Nao foi possivel gerar slug valido para a empresa');

      const existingSlugs = await tx.company.findMany({
        where: { slug: { startsWith: slugBase } },
        select: { slug: true },
      });
      const slugSet = new Set(existingSlugs.map((item) => item.slug));
      let slugCandidate = slugBase;
      let suffix = 2;
      while (slugSet.has(slugCandidate)) {
        slugCandidate = `${slugBase}-${suffix}`;
        suffix += 1;
      }

      const company = await tx.company.create({
        data: {
          name: companyName,
          slug: slugCandidate,
          document: companyDocument || null,
          plan: input.companyPlan?.trim() || 'starter',
          status: companyStatus,
          sistemaBaseId,
        },
      });

      const existingUser = await tx.user.findUnique({
        where: { email: ownerEmail },
        select: { id: true },
      });
      const ownerUser = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              fullName: ownerFullName,
              passwordHash: ownerPasswordHash,
              isActive: true,
            },
          })
        : await tx.user.create({
            data: {
              email: ownerEmail,
              fullName: ownerFullName,
              passwordHash: ownerPasswordHash,
              isActive: true,
            },
          });

      const existingRole = await tx.userRole.findFirst({
        where: { userId: ownerUser.id, companyId: company.id },
        select: { id: true },
      });
      if (!existingRole) {
        await tx.userRole.create({
          data: { userId: ownerUser.id, companyId: company.id, role: OWNER_ROLE },
        });
      }

      const moduloIds = Array.from(new Set(sistemaBase.modulos.map((m) => m.moduloId)));
      if (moduloIds.length > 0) {
        await tx.companyModule.createMany({
          data: moduloIds.map((moduloId) => ({
            companyId: company.id,
            moduloId,
            isActive: true,
          })),
          skipDuplicates: true,
        });
      }

      const hasAppointmentsModule = sistemaBase.modulos.some((item) =>
        APPOINTMENTS_CODES.has(String(item.modulo?.codigo || '').toLowerCase())
      );
      if (hasAppointmentsModule) {
        const hasService = await (tx as any).appointmentService.findFirst({
          where: { companyId: company.id },
          select: { id: true },
        });
        if (!hasService) {
          await (tx as any).appointmentService.create({
            data: {
              companyId: company.id,
              name: 'Corte Tradicional',
              description: 'Servico inicial criado automaticamente',
              durationMinutes: 30,
              price: 40,
              isActive: true,
            },
          });
        }

        const hasAvailability = await (tx as any).appointmentAvailability.findFirst({
          where: { companyId: company.id, professionalId: ownerUser.id, isActive: true },
          select: { id: true },
        });
        if (!hasAvailability) {
          await (tx as any).appointmentAvailability.createMany({
            data: [
              { companyId: company.id, professionalId: ownerUser.id, weekday: 1, startTime: '09:00', endTime: '18:00', isActive: true },
              { companyId: company.id, professionalId: ownerUser.id, weekday: 2, startTime: '09:00', endTime: '18:00', isActive: true },
              { companyId: company.id, professionalId: ownerUser.id, weekday: 3, startTime: '09:00', endTime: '18:00', isActive: true },
              { companyId: company.id, professionalId: ownerUser.id, weekday: 4, startTime: '09:00', endTime: '18:00', isActive: true },
              { companyId: company.id, professionalId: ownerUser.id, weekday: 5, startTime: '09:00', endTime: '18:00', isActive: true },
            ],
            skipDuplicates: true,
          });
        }
      }

      return { company, ownerUser, moduloIds };
    }, { maxWait: 10000, timeout: 30000 });

    return {
      company: {
        id: created.company.id,
        name: created.company.name,
        slug: created.company.slug,
        sistemaBaseId: created.company.sistemaBaseId as string,
      },
      owner: {
        id: created.ownerUser.id,
        email: created.ownerUser.email,
        fullName: created.ownerUser.fullName,
        role: OWNER_ROLE,
      },
      modulosLiberados: {
        total: created.moduloIds.length,
        moduloIds: created.moduloIds,
      },
      credentials: {
        email: created.ownerUser.email,
        temporaryPassword,
        requiresPasswordChange: true,
      },
    };
  }
}
