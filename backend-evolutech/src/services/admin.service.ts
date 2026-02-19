import { prisma } from '../db';
import { Modulo, SistemaBase, Status } from '@prisma/client';

export class AdminService {
  // --- MÓDULOS ---
  async listModulos(onlyActive: boolean) {
    return prisma.modulo.findMany({
      where: onlyActive ? { status: 'active' } : undefined,
      orderBy: [{ isCore: 'desc' }, { nome: 'asc' }],
    });
  }

  async createModulo(data: any) {
    return prisma.modulo.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        codigo: data.codigo,
        icone: data.icone,
        precoMensal: data.preco_mensal || 0,
        isCore: data.is_core || false,
        status: data.status as Status || 'active'
      }
    });
  }

  // --- SISTEMAS BASE ---
  async listSistemasBase(onlyActive: boolean) {
    return prisma.sistemaBase.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        modulos: true, // Já traz os módulos vinculados!
      }
    });
  }

  async createSistemaBase(data: any) {
    // O Prisma faz a transação e inserção nas tabelas pivô (N:N) sozinho!
    return prisma.sistemaBase.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        categoria: data.categoria,
        icone: data.icone,
        // Cria os relacionamentos na tabela pivô 'sistema_base_modulos'
        modulos: {
          create: data.modulosIds?.map((modId: string) => ({
             modulo: { connect: { id: modId } },
             isMandatory: false // Default
          }))
        }
      },
      include: {
        modulos: true // Retorna o objeto completo
      }
    });
  }
}