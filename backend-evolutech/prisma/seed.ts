import { PrismaClient, Status } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function ensureSuperAdmin() {
  const email = 'admin@evolutech.com';
  const passwordHash = await bcrypt.hash('adm2026', 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      fullName: 'Super Admin',
      isActive: true,
    },
    create: {
      email,
      fullName: 'Super Admin',
      passwordHash,
      isActive: true,
      roles: {
        create: {
          role: 'SUPER_ADMIN_EVOLUTECH'
        }
      }
    },
  });

  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, role: 'SUPER_ADMIN_EVOLUTECH' }
  });

  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        role: 'SUPER_ADMIN_EVOLUTECH'
      }
    });
  }

  return user;
}

async function ensureBaseCatalog() {
  const modules = [
    { nome: 'Dashboard', codigo: 'dashboard', descricao: 'Visao geral de indicadores do negocio', isCore: true, preco: 0 },
    { nome: 'Clientes', codigo: 'clientes', descricao: 'Cadastro e historico de clientes', isCore: true, preco: 0 },
    { nome: 'Agendamentos', codigo: 'agendamentos', descricao: 'Agenda de servicos e confirmacoes', isCore: true, preco: 0 },
    { nome: 'Vendas', codigo: 'vendas', descricao: 'Gestao de vendas e comissoes', isCore: false, preco: 49.9 },
    { nome: 'PDV', codigo: 'pdv', descricao: 'Operacao de caixa e fechamento', isCore: false, preco: 79.9 },
    { nome: 'Produtos', codigo: 'produtos', descricao: 'Cadastro de produtos e estoque', isCore: false, preco: 39.9 },
    { nome: 'Financeiro', codigo: 'financeiro', descricao: 'Contas a pagar e receber', isCore: false, preco: 59.9 },
    { nome: 'Relatorios', codigo: 'relatorios', descricao: 'Relatorios gerenciais e operacionais', isCore: false, preco: 29.9 }
  ];

  for (const item of modules) {
    await prisma.modulo.upsert({
      where: { codigo: item.codigo },
      update: {
        nome: item.nome,
        descricao: item.descricao,
        isCore: item.isCore,
        precoMensal: item.preco,
        status: 'active' as Status
      },
      create: {
        nome: item.nome,
        codigo: item.codigo,
        descricao: item.descricao,
        isCore: item.isCore,
        precoMensal: item.preco,
        status: 'active' as Status
      }
    });
  }

  const barbearia = await prisma.sistemaBase.upsert({
    where: { nome: 'Barbearia' },
    update: {
      descricao: 'Sistema base completo para barbearias',
      categoria: 'Beleza',
      isActive: true,
      icone: 'Scissors'
    },
    create: {
      nome: 'Barbearia',
      descricao: 'Sistema base completo para barbearias',
      categoria: 'Beleza',
      isActive: true,
      icone: 'Scissors'
    }
  });

  const moduleCodes = ['dashboard', 'clientes', 'agendamentos', 'vendas', 'pdv', 'produtos', 'financeiro', 'relatorios'];
  const moduloRecords = await prisma.modulo.findMany({ where: { codigo: { in: moduleCodes } } });

  await prisma.sistemaBaseModulo.deleteMany({ where: { sistemaBaseId: barbearia.id } });

  await prisma.sistemaBaseModulo.createMany({
    data: moduloRecords.map((modulo) => ({
      sistemaBaseId: barbearia.id,
      moduloId: modulo.id,
      isMandatory: ['dashboard', 'clientes', 'agendamentos'].includes(modulo.codigo)
    })),
    skipDuplicates: true
  });

  return { barbeariaId: barbearia.id };
}

async function main() {
  console.log('Iniciando seed...');

  const admin = await ensureSuperAdmin();
  const catalog = await ensureBaseCatalog();

  console.log(`Super admin OK: ${admin.email}`);
  console.log(`Sistema Barbearia OK: ${catalog.barbeariaId}`);
  console.log('Seed concluido com sucesso.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
