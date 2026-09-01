import { PrismaClient, Status } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Cria (ou atualiza) o super admin a partir das variaveis de ambiente.
 *
 * Antes o e-mail e a senha ficavam escritos aqui e repetidos no README. Como o
 * seed roda contra o banco de producao, essa era a credencial viva do sistema
 * num arquivo versionado — e o e-mail publico ainda servia de alvo, ja que os
 * logins nao tinham limite de tentativas.
 *
 * Defina SEED_SUPER_ADMIN_EMAIL e SEED_SUPER_ADMIN_PASSWORD antes de rodar.
 */
async function ensureSuperAdmin() {
  const email = String(process.env.SEED_SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.SEED_SUPER_ADMIN_PASSWORD || '');

  if (!email || !password) {
    throw new Error(
      'Defina SEED_SUPER_ADMIN_EMAIL e SEED_SUPER_ADMIN_PASSWORD antes de rodar o seed. ' +
        'Exemplo: SEED_SUPER_ADMIN_EMAIL=voce@dominio.com SEED_SUPER_ADMIN_PASSWORD=... npm run seed'
    );
  }

  if (password.length < 12) {
    throw new Error('SEED_SUPER_ADMIN_PASSWORD precisa ter ao menos 12 caracteres.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

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
  // A definicao da barbearia mora em prisma/barbearia-modulos.js, junto com o
  // script que aplica ela numa empresa. Aqui ela so e materializada no catalogo.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { MODULOS_BARBEARIA } = require('./barbearia-modulos');

  // 'vendas' e 'courses' nao fazem parte da barbearia, mas seguem no catalogo:
  // outros nichos usam, e apagar modulo do catalogo derrubaria as empresas
  // que ja receberam. Catalogo cresce, sistema base e que escolhe.
  const extras = [
    { nome: 'Vendas', codigo: 'vendas', descricao: 'Gestao de vendas e comissoes', isCore: false, preco: 49.9, roles: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
    { nome: 'Cursos', codigo: 'courses', descricao: 'Gestao e venda de cursos', isCore: false, preco: 79.9, roles: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
  ];

  const modules = [
    ...MODULOS_BARBEARIA.map((m: any) => ({
      nome: m.nome,
      codigo: m.codigo,
      descricao: m.descricao,
      isCore: m.core,
      preco: m.preco,
      roles: m.roles,
    })),
    ...extras,
  ];

  for (const item of modules) {
    const isCollectionsModule = item.codigo === 'collections';
    await prisma.modulo.upsert({
      where: { codigo: item.codigo },
      update: {
        nome: item.nome,
        descricao: item.descricao,
        isCore: item.isCore,
        precoMensal: item.preco,
        isPro: isCollectionsModule,
        allowedRoles: item.roles as any,
        status: 'active' as Status
      },
      create: {
        nome: item.nome,
        codigo: item.codigo,
        descricao: item.descricao,
        isCore: item.isCore,
        precoMensal: item.preco,
        isPro: isCollectionsModule,
        allowedRoles: item.roles as any,
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

  const moduleCodes = MODULOS_BARBEARIA.map((m: any) => m.codigo);

  const moduloRecords = await prisma.modulo.findMany({ where: { codigo: { in: moduleCodes } } });

  await prisma.sistemaBaseModulo.deleteMany({ where: { sistemaBaseId: barbearia.id } });

  await prisma.sistemaBaseModulo.createMany({
    data: moduloRecords.map((modulo) => {
      const def = MODULOS_BARBEARIA.find((m: any) => m.codigo === modulo.codigo);
      return {
        sistemaBaseId: barbearia.id,
        moduloId: modulo.id,
        isMandatory: Boolean(def?.obrigatorio),
        allowedRoles: (def?.roles || ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA']) as any,
      };
    }),
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
