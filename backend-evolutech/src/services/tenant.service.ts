import bcrypt from 'bcryptjs';
import { Role, Status } from '@prisma/client';
import { prisma } from '../db';

export interface CreateTenantInput {
  companyName: string;
  companyDocument?: string;
  companyPlan?: string;
  companyStatus?: 'active' | 'inactive' | 'pending';
  sistemaBaseId: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword?: string;
  ownerRole?: string;
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

const OWNER_ROLE_FALLBACK: Role = 'DONO_EMPRESA';
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

const generateTemporaryPassword = (): string => {
  const randomBlock = Math.random().toString(36).slice(2, 10);
  return `Ev0!${randomBlock}`;
};

const resolveOwnerRole = (roleInput?: string): Role => {
  const role = (roleInput || '').toUpperCase().trim();

  if (role === 'ADMIN_EMPRESA') {
    return OWNER_ROLE_FALLBACK;
  }

  if (role === 'DONO_EMPRESA') {
    return 'DONO_EMPRESA';
  }

  return OWNER_ROLE_FALLBACK;
};

const resolveCompanyStatus = (statusInput?: string): Status => {
  const value = (statusInput || 'active').trim().toLowerCase() as Status;
  return ALLOWED_COMPANY_STATUS.has(value) ? value : 'active';
};

export class TenantService {
  async onboardTenant(input: CreateTenantInput): Promise<TenantOnboardingResult> {
    const companyName = input.companyName?.trim();
    const ownerFullName = input.ownerFullName?.trim();
    const ownerEmail = input.ownerEmail?.trim().toLowerCase();
    const sistemaBaseId = input.sistemaBaseId?.trim();
    const companyDocument = input.companyDocument?.trim();
    const ownerRole = resolveOwnerRole(input.ownerRole);
    const companyStatus = resolveCompanyStatus(input.companyStatus);

    if (!companyName || !ownerFullName || !ownerEmail || !sistemaBaseId) {
      throw new Error('Campos obrigatórios ausentes para onboarding');
    }

    const temporaryPassword = input.ownerPassword?.trim() || generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const created = await prisma.$transaction(async (tx) => {
      const sistemaBase = await tx.sistemaBase.findUnique({
        where: { id: sistemaBaseId },
        include: { modulos: { select: { moduloId: true } } }
      });

      if (!sistemaBase) {
        throw new Error('Sistema Base não encontrado');
      }

      if (!sistemaBase.isActive) {
        throw new Error('Sistema Base inativo');
      }

      const existingOwner = await tx.user.findUnique({
        where: { email: ownerEmail }
      });

      if (existingOwner) {
        throw new Error('Já existe usuário com este e-mail');
      }

      const slugBase = toSlug(companyName);
      if (!slugBase) {
        throw new Error('Não foi possível gerar slug válido para a empresa');
      }

      const existingSlugs = await tx.company.findMany({
        where: {
          slug: {
            startsWith: slugBase
          }
        },
        select: { slug: true }
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
          plan: input.companyPlan?.trim() || 'free',
          status: companyStatus,
          sistemaBaseId
        }
      });

      const ownerUser = await tx.user.create({
        data: {
          email: ownerEmail,
          fullName: ownerFullName,
          passwordHash,
          isActive: true
        }
      });

      await tx.userRole.create({
        data: {
          userId: ownerUser.id,
          companyId: company.id,
          role: ownerRole
        }
      });

      const moduloIds = Array.from(new Set(sistemaBase.modulos.map((m) => m.moduloId)));

      if (moduloIds.length > 0) {
        await tx.companyModule.createMany({
          data: moduloIds.map((moduloId) => ({
            companyId: company.id,
            moduloId,
            isActive: true
          })),
          skipDuplicates: true
        });
      }

      return {
        company,
        ownerUser,
        moduloIds
      };
    });

    return {
      company: {
        id: created.company.id,
        name: created.company.name,
        slug: created.company.slug,
        sistemaBaseId: created.company.sistemaBaseId as string
      },
      owner: {
        id: created.ownerUser.id,
        email: created.ownerUser.email,
        fullName: created.ownerUser.fullName,
        role: ownerRole
      },
      modulosLiberados: {
        total: created.moduloIds.length,
        moduloIds: created.moduloIds
      },
      credentials: {
        email: created.ownerUser.email,
        temporaryPassword,
        requiresPasswordChange: true
      }
    };
  }
}
