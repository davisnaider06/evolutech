/**
 * Monta o sistema base "Barbearia" e liga uma empresa a ele.
 *
 * POR QUE ESTE SCRIPT EXISTE
 * O sistema base ja existia no seed, mas com um conjunto de modulos que nao
 * cobre a operacao de uma barbearia: faltavam caixa, comandas e estoque, que
 * sao justamente o que o barbeiro usa o dia inteiro. Faltavam no catalogo
 * inteiro, nao so no sistema base — por isso aqui tambem cria modulo.
 *
 * O QUE ELE NAO FAZ
 * Nao apaga nada. Cliente, agendamento, servico, equipe e comanda vivem em
 * tabelas proprias, presas a empresa_id, e nenhuma e tocada. Modulo e
 * permissao de tela, nao dado: ligar um modulo mostra um menu a mais, nunca
 * mexe no que ja foi cadastrado.
 *
 * Modulo que a empresa ja tinha continua ligado. O script so soma.
 *
 * USO
 *   node prisma/sistema-base-barbearia.js                 simula e mostra o plano
 *   node prisma/sistema-base-barbearia.js --aplicar       grava
 *   node prisma/sistema-base-barbearia.js --empresa slug  escolhe a empresa
 *
 * Rodar de novo nao duplica: tudo e upsert por chave natural.
 */
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const APLICAR = process.argv.includes('--aplicar');
const idxEmpresa = process.argv.indexOf('--empresa');
const SLUG_EMPRESA = idxEmpresa > -1 ? process.argv[idxEmpresa + 1] : 'felipe-barber';

const NOME_BASE = 'Barbearia';

const AMBOS = ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'];
const SO_DONO = ['DONO_EMPRESA'];

/**
 * Os modulos da barbearia, na ordem em que aparecem no menu.
 *
 * `codigo` casa com o moduleCode do EmpresaLayout atraves do MODULE_ALIASES
 * do front (useCompanyModules.ts): 'clientes' atende 'customers', e assim por
 * diante. Mexer num codigo daqui sem olhar la esconde o menu.
 *
 * `roles` restringe quem enxerga. Dinheiro da casa (financeiro, comissao do
 * dono, cobranca, mensalidade) fica so com o dono; o resto o barbeiro usa.
 */
const MODULOS = [
  { codigo: 'dashboard',         nome: 'Dashboard',            descricao: 'Visao geral do dia e indicadores',            icone: 'LayoutDashboard', preco: 0,    core: true,  roles: AMBOS,   obrigatorio: true },
  { codigo: 'clientes',          nome: 'Clientes',             descricao: 'Cadastro, historico e retorno de clientes',    icone: 'Users',           preco: 0,    core: true,  roles: AMBOS,   obrigatorio: true },
  { codigo: 'agendamentos',      nome: 'Agendamentos',         descricao: 'Agenda por barbeiro, servicos e horarios',     icone: 'Calendar',        preco: 0,    core: true,  roles: AMBOS,   obrigatorio: true },
  { codigo: 'pdv',               nome: 'PDV',                  descricao: 'Fechamento de atendimento no balcao',          icone: 'ReceiptText',     preco: 79.9, core: false, roles: AMBOS,   obrigatorio: false },
  { codigo: 'caixa',             nome: 'Caixa',                descricao: 'Abertura, fechamento e movimento do caixa',    icone: 'Wallet',          preco: 39.9, core: false, roles: AMBOS,   obrigatorio: false },
  { codigo: 'pedidos',           nome: 'Comandas',             descricao: 'Comandas abertas e historico de vendas',       icone: 'ShoppingCart',    preco: 39.9, core: false, roles: AMBOS,   obrigatorio: false },
  { codigo: 'produtos',          nome: 'Produtos',             descricao: 'Pomada, shampoo e o que mais se vende',        icone: 'Package',         preco: 39.9, core: false, roles: AMBOS,   obrigatorio: false },
  { codigo: 'estoque',           nome: 'Estoque',              descricao: 'Entrada, saida e saldo dos produtos',          icone: 'Warehouse',       preco: 39.9, core: false, roles: AMBOS,   obrigatorio: false },
  { codigo: 'assinaturas',       nome: 'Assinaturas',          descricao: 'Mensalistas, pacotes e cobranca do plano',     icone: 'Repeat',          preco: 49.9, core: false, roles: SO_DONO, obrigatorio: false },
  { codigo: 'fidelidade',        nome: 'Fidelidade',           descricao: 'Pontos e recompensa para cliente frequente',   icone: 'Gift',            preco: 29.9, core: false, roles: AMBOS,   obrigatorio: false },
  { codigo: 'comissoes_dono',    nome: 'Comissoes',            descricao: 'Comissao da equipe, fechamento pelo dono',     icone: 'Wallet',          preco: 29.9, core: false, roles: SO_DONO, obrigatorio: false },
  { codigo: 'commissions_staff', nome: 'Minhas Comissoes',     descricao: 'O barbeiro consulta o que ele mesmo ganhou',   icone: 'Wallet',          preco: 0,    core: false, roles: AMBOS,   obrigatorio: false },
  { codigo: 'financeiro',        nome: 'Financeiro',           descricao: 'Entradas, saidas e resultado do mes',          icone: 'CreditCard',      preco: 59.9, core: false, roles: SO_DONO, obrigatorio: false },
  { codigo: 'collections',       nome: 'Cobrancas',            descricao: 'Vencimentos e recuperacao de inadimplente',    icone: 'ReceiptText',     preco: 59.9, core: false, roles: SO_DONO, obrigatorio: false },
  { codigo: 'relatorios',        nome: 'Relatorios',           descricao: 'Faturamento, ocupacao e desempenho',           icone: 'BarChart3',       preco: 29.9, core: false, roles: SO_DONO, obrigatorio: false },
  { codigo: 'customer_portal',   nome: 'Portal do Cliente',    descricao: 'Cliente agenda e acompanha pelo proprio app',  icone: 'Smartphone',      preco: 39.9, core: false, roles: AMBOS,   obrigatorio: true },
  { codigo: 'permissions',       nome: 'Permissoes de Equipe', descricao: 'O que cada barbeiro pode ver e fazer',         icone: 'Settings',        preco: 0,    core: true,  roles: SO_DONO, obrigatorio: true },
  { codigo: 'support',           nome: 'Suporte',              descricao: 'Abertura de chamado com a Evolutech',          icone: 'HeadphonesIcon',  preco: 0,    core: true,  roles: AMBOS,   obrigatorio: true },
];

const log = (...args) => console.log(...args);
const marca = () => (APLICAR ? '' : '   (simulacao)');

async function main() {
  log(`\n${APLICAR ? '>> APLICANDO' : '>> SIMULACAO — nada sera gravado. Use --aplicar para valer.'}\n`);

  // --- Empresa alvo, antes de qualquer escrita ------------------
  const empresa = await prisma.company.findUnique({
    where: { slug: SLUG_EMPRESA },
    select: { id: true, name: true, slug: true, sistemaBaseId: true },
  });
  if (!empresa) throw new Error(`Empresa com slug "${SLUG_EMPRESA}" nao encontrada.`);
  log(`Empresa: ${empresa.name} (${empresa.slug})`);
  log(`Sistema base atual: ${empresa.sistemaBaseId || 'NENHUM'}\n`);

  // Retrato dos dados antes, para comparar no fim. E a prova de que
  // mexer em modulo nao encosta no que o Felipe cadastrou.
  const antes = await contarDados(empresa.id);
  log('Dados hoje:', antes, '\n');

  // --- 1. Catalogo de modulos ----------------------------------
  const idPorCodigo = new Map();
  let criados = 0;
  for (const m of MODULOS) {
    const existente = await prisma.modulo.findUnique({ where: { codigo: m.codigo }, select: { id: true } });
    if (existente) {
      idPorCodigo.set(m.codigo, existente.id);
      continue;
    }
    criados += 1;
    log(`  + modulo novo no catalogo: ${m.codigo} (${m.nome})${marca()}`);
    if (APLICAR) {
      const novo = await prisma.modulo.create({
        data: {
          nome: m.nome,
          codigo: m.codigo,
          descricao: m.descricao,
          icone: m.icone,
          precoMensal: m.preco,
          isCore: m.core,
          status: 'active',
          nicho: 'barbearia',
          isPro: false,
          allowedRoles: m.roles,
        },
        select: { id: true },
      });
      idPorCodigo.set(m.codigo, novo.id);
    } else {
      idPorCodigo.set(m.codigo, `(novo:${m.codigo})`);
    }
  }
  log(`Catalogo: ${MODULOS.length - criados} ja existiam, ${criados} a criar.\n`);

  // --- 2. Sistema base -----------------------------------------
  let base = await prisma.sistemaBase.findUnique({ where: { nome: NOME_BASE }, select: { id: true } });
  if (!base) {
    log(`  + sistema base "${NOME_BASE}"${marca()}`);
    if (APLICAR) {
      base = await prisma.sistemaBase.create({
        data: {
          nome: NOME_BASE,
          descricao: 'Operacao completa de barbearia: agenda, comanda, caixa, mensalista e comissao',
          categoria: 'Beleza',
          icone: 'Scissors',
          isActive: true,
        },
        select: { id: true },
      });
    }
  } else {
    log(`  = sistema base "${NOME_BASE}" ja existe (${base.id})`);
  }

  // --- 3. Modulos do sistema base ------------------------------
  // Upsert em vez de apagar e recriar: apagar deixaria a base sem modulo
  // nenhum por um instante, e quem consultasse nesse meio tempo veria uma
  // barbearia sem menu.
  if (APLICAR && base) {
    for (const m of MODULOS) {
      const moduloId = idPorCodigo.get(m.codigo);
      await prisma.sistemaBaseModulo.upsert({
        where: { sistemaBaseId_moduloId: { sistemaBaseId: base.id, moduloId } },
        update: { isMandatory: m.obrigatorio, allowedRoles: m.roles },
        create: { sistemaBaseId: base.id, moduloId, isMandatory: m.obrigatorio, allowedRoles: m.roles },
      });
    }
  }
  log(`Sistema base passa a ter ${MODULOS.length} modulos.${marca()}\n`);

  // --- 4. Empresa recebe o sistema base ------------------------
  log(`  ~ ${empresa.name}: sistema base ${empresa.sistemaBaseId || 'NENHUM'} -> ${NOME_BASE}${marca()}`);
  if (APLICAR && base) {
    await prisma.company.update({ where: { id: empresa.id }, data: { sistemaBaseId: base.id } });
  }

  // --- 5. Modulos liberados para a empresa ---------------------
  // O /auth/me soma empresa_modulos com os modulos do sistema base, entao em
  // tese o passo 4 ja bastaria. Gravar aqui tambem deixa a empresa de pe se
  // um dia ela trocar de sistema base, e e o que o onboarding oficial faz.
  const jaTinha = await prisma.companyModule.findMany({
    where: { companyId: empresa.id },
    include: { modulo: { select: { codigo: true } } },
  });
  const codigosAntigos = new Set(jaTinha.map((r) => r.modulo.codigo));
  const novos = MODULOS.filter((m) => !codigosAntigos.has(m.codigo)).map((m) => m.codigo);

  log(`\n  empresa_modulos antes (${jaTinha.length}): ${[...codigosAntigos].join(', ') || '(nenhum)'}`);
  log(`  a acrescentar (${novos.length}): ${novos.join(', ') || '(nenhum)'}`);
  log('  a remover (0): nenhum — o script nunca tira modulo.');

  if (APLICAR) {
    for (const m of MODULOS) {
      const moduloId = idPorCodigo.get(m.codigo);
      await prisma.companyModule.upsert({
        where: { companyId_moduloId: { companyId: empresa.id, moduloId } },
        update: { isActive: true, allowedRoles: m.roles },
        create: { companyId: empresa.id, moduloId, isActive: true, allowedRoles: m.roles },
      });
    }
  }

  // --- 6. Conferencia ------------------------------------------
  const depois = await contarDados(empresa.id);
  log('\nDados depois:', depois);
  const intacto = JSON.stringify(antes) === JSON.stringify(depois);
  log(intacto ? 'OK: nenhum dado do Felipe mudou.' : '!! ATENCAO: contagem mudou, investigar.');

  if (APLICAR) {
    const conferir = await prisma.company.findUnique({
      where: { id: empresa.id },
      select: { sistemaBaseId: true, _count: { select: { modules: true } } },
    });
    log(`\nResultado: sistema base = ${conferir.sistemaBaseId}, empresa_modulos = ${conferir._count.modules}`);
  } else {
    log('\nNada foi gravado. Rode com --aplicar para valer.');
  }
}

async function contarDados(companyId) {
  const [clientes, agendamentos, servicos, equipe, planos, assinaturas] = await Promise.all([
    prisma.customer.count({ where: { companyId } }),
    prisma.appointment.count({ where: { companyId } }),
    prisma.appointmentService.count({ where: { companyId } }),
    prisma.userRole.count({ where: { companyId } }),
    prisma.subscriptionPlan.count({ where: { companyId } }),
    prisma.customerSubscription.count({ where: { companyId } }),
  ]);
  return { clientes, agendamentos, servicos, equipe, planos, assinaturas };
}

main()
  .catch((e) => {
    console.error('\nERRO:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
