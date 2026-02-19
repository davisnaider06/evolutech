import { prisma } from '../db';
import { Status } from '@prisma/client';

type SistemaStatusInput = 'active' | 'inactive' | 'pending';

const mapStatusToIsActive = (status?: SistemaStatusInput): boolean => status === 'active';
const mapIsActiveToStatus = (isActive: boolean): SistemaStatusInput => (isActive ? 'active' : 'inactive');

export class AdminService {
  async listModulos(onlyActive: boolean) {
    return prisma.modulo.findMany({
      where: onlyActive ? { status: 'active' } : undefined,
      orderBy: [{ isCore: 'desc' }, { nome: 'asc' }],
    });
  }

  async createModulo(data: {
    nome: string;
    descricao?: string;
    codigo: string;
    icone?: string;
    preco_mensal?: number;
    is_core?: boolean;
    status?: Status;
  }) {
    return prisma.modulo.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        codigo: data.codigo,
        icone: data.icone,
        precoMensal: data.preco_mensal || 0,
        isCore: data.is_core || false,
        status: data.status || 'active'
      }
    });
  }

  async updateModulo(moduloId: string, data: {
    nome?: string;
    descricao?: string;
    icone?: string;
    preco_mensal?: number;
    is_core?: boolean;
    status?: Status;
  }) {
    return prisma.modulo.update({
      where: { id: moduloId },
      data: {
        nome: data.nome,
        descricao: data.descricao,
        icone: data.icone,
        precoMensal: data.preco_mensal,
        isCore: data.is_core,
        status: data.status
      }
    });
  }

  async deleteModulo(moduloId: string) {
    return prisma.modulo.delete({ where: { id: moduloId } });
  }

  async listSistemasBase(onlyActive: boolean) {
    const sistemas = await prisma.sistemaBase.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        modulos: {
          include: { modulo: true }
        }
      }
    });

    return sistemas.map((sistema) => ({
      ...sistema,
      status: mapIsActiveToStatus(sistema.isActive),
      nicho: sistema.categoria || 'Generico',
      versao: '1.0.0'
    }));
  }

  async createSistemaBase(data: {
    nome: string;
    descricao?: string;
    categoria?: string;
    status?: SistemaStatusInput;
    icone?: string;
    modulosIds?: string[];
  }) {
    return prisma.sistemaBase.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        categoria: data.categoria,
        icone: data.icone,
        isActive: mapStatusToIsActive(data.status),
        modulos: {
          create: data.modulosIds?.map((modId) => ({
            modulo: { connect: { id: modId } },
            isMandatory: false
          })) || []
        }
      },
      include: { modulos: true }
    });
  }

  async updateSistemaBase(sistemaId: string, data: {
    nome?: string;
    descricao?: string;
    categoria?: string;
    status?: SistemaStatusInput;
    icone?: string;
  }) {
    return prisma.sistemaBase.update({
      where: { id: sistemaId },
      data: {
        nome: data.nome,
        descricao: data.descricao,
        categoria: data.categoria,
        icone: data.icone,
        isActive: data.status ? mapStatusToIsActive(data.status) : undefined
      }
    });
  }

  async deleteSistemaBase(sistemaId: string) {
    return prisma.sistemaBase.delete({ where: { id: sistemaId } });
  }

  async listSistemaBaseModulos(sistemaId: string) {
    return prisma.sistemaBaseModulo.findMany({
      where: { sistemaBaseId: sistemaId },
      include: { modulo: true },
      orderBy: [{ isMandatory: 'desc' }, { modulo: { nome: 'asc' } }]
    });
  }

  async replaceSistemaBaseModulos(
    sistemaId: string,
    modulos: Array<{ modulo_id: string; is_default?: boolean }>
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.sistemaBaseModulo.deleteMany({ where: { sistemaBaseId: sistemaId } });

      if (modulos.length > 0) {
        await tx.sistemaBaseModulo.createMany({
          data: modulos.map((item) => ({
            sistemaBaseId: sistemaId,
            moduloId: item.modulo_id,
            isMandatory: !!item.is_default
          })),
          skipDuplicates: true
        });
      }
    });

    return this.listSistemaBaseModulos(sistemaId);
  }

  async listTenants() {
    return prisma.company.findMany({
      include: {
        sistemaBase: true,
        userRoles: {
          where: { role: 'DONO_EMPRESA' },
          include: { user: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateTenant(companyId: string, data: {
    name?: string;
    plan?: string;
    status?: Status;
    document?: string | null;
    sistema_base_id?: string | null;
  }) {
    return prisma.company.update({
      where: { id: companyId },
      data: {
        name: data.name,
        plan: data.plan,
        status: data.status,
        document: data.document,
        sistemaBaseId: data.sistema_base_id
      }
    });
  }

  async deleteTenant(companyId: string) {
    return prisma.company.delete({ where: { id: companyId } });
  }
}
