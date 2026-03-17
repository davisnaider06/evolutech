import { Role, Status } from '@prisma/client';
import { prisma } from '../db';

export interface CreateTenantInput {
  companyName: string;
  companyDocument?: string;
  companyPlan?: string;
  companyStatus?: 'active' | 'inactive' | 'pending';
  companyLogoUrl?: string | null;
  sistemaBaseId: string;
}

interface TenantOnboardingResult {
  company: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    sistemaBaseId: string;
  };
  owner: null;
  modulosLiberados: {
    total: number;
    moduloIds: string[];
  };
  credentials: null;
}

const ALLOWED_COMPANY_STATUS: ReadonlySet<Status> = new Set(['active', 'inactive', 'pending']);
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

export class TenantService {
  async onboardTenant(input: CreateTenantInput): Promise<TenantOnboardingResult> {
    const companyName = input.companyName?.trim();
    const sistemaBaseId = input.sistemaBaseId?.trim();
    const companyDocument = input.companyDocument?.trim();
    const companyLogoUrl = String(input.companyLogoUrl || '').trim() || null;
    const companyStatus = resolveCompanyStatus(input.companyStatus);

    if (!companyName || !sistemaBaseId) {
      throw new Error('Campos obrigatorios ausentes para onboarding');
    }

    const created = await prisma.$transaction(async (tx) => {
      const sistemaBase = await tx.sistemaBase.findUnique({
        where: { id: sistemaBaseId },
        include: {
          modulos: {
            select: {
              moduloId: true,
              allowedRoles: true,
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
          logoUrl: companyLogoUrl,
          plan: input.companyPlan?.trim() || 'starter',
          status: companyStatus,
          sistemaBaseId,
        },
      });

      const moduloBindings = Array.from(
        new Map(
          sistemaBase.modulos.map((item) => [
            item.moduloId,
            {
              moduloId: item.moduloId,
              allowedRoles:
                Array.isArray(item.allowedRoles) && item.allowedRoles.length > 0
                  ? (item.allowedRoles as Role[])
                  : (['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] as Role[]),
            },
          ])
        ).values()
      );
      if (moduloBindings.length > 0) {
        for (const binding of moduloBindings) {
          await tx.companyModule.upsert({
            where: {
              companyId_moduloId: {
                companyId: company.id,
                moduloId: binding.moduloId,
              },
            },
            update: {
              isActive: true,
              allowedRoles: binding.allowedRoles,
            },
            create: {
              companyId: company.id,
              moduloId: binding.moduloId,
              isActive: true,
              allowedRoles: binding.allowedRoles,
            },
          });
        }
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
      }

      return { company, moduloIds: moduloBindings.map((item) => item.moduloId) };
    }, { maxWait: 10000, timeout: 30000 });

    return {
      company: {
        id: created.company.id,
        name: created.company.name,
        slug: created.company.slug,
        logoUrl: created.company.logoUrl,
        sistemaBaseId: created.company.sistemaBaseId as string,
      },
      owner: null,
      modulosLiberados: {
        total: created.moduloIds.length,
        moduloIds: created.moduloIds,
      },
      credentials: null,
    };
  }
}
