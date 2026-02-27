import { Status } from '@prisma/client';
import { prisma } from '../db';

export interface CreateTenantInput {
  companyName: string;
  companyDocument?: string;
  companyPlan?: string;
  companyStatus?: 'active' | 'inactive' | 'pending';
  sistemaBaseId: string;
}

interface TenantOnboardingResult {
  company: {
    id: string;
    name: string;
    slug: string;
    sistemaBaseId: string;
  };
  modulosLiberados: {
    total: number;
    moduloIds: string[];
  };
}

const ALLOWED_COMPANY_STATUS: ReadonlySet<Status> = new Set(['active', 'inactive', 'pending']);

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
    const companyStatus = resolveCompanyStatus(input.companyStatus);

    if (!companyName || !sistemaBaseId) {
      throw new Error('Campos obrigatorios ausentes para onboarding');
    }

    const created = await prisma.$transaction(async (tx) => {
      const sistemaBase = await tx.sistemaBase.findUnique({
        where: { id: sistemaBaseId },
        include: { modulos: { select: { moduloId: true } } },
      });

      if (!sistemaBase) {
        throw new Error('Sistema Base nao encontrado');
      }

      if (!sistemaBase.isActive) {
        throw new Error('Sistema Base inativo');
      }

      const slugBase = toSlug(companyName);
      if (!slugBase) {
        throw new Error('Nao foi possivel gerar slug valido para a empresa');
      }

      const existingSlugs = await tx.company.findMany({
        where: {
          slug: {
            startsWith: slugBase,
          },
        },
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

      return {
        company,
        moduloIds,
      };
    });

    return {
      company: {
        id: created.company.id,
        name: created.company.name,
        slug: created.company.slug,
        sistemaBaseId: created.company.sistemaBaseId as string,
      },
      modulosLiberados: {
        total: created.moduloIds.length,
        moduloIds: created.moduloIds,
      },
    };
  }
}
