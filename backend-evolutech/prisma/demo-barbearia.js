/**
 * Monta (ou desmonta) a barbearia de demonstracao do iBarber.
 *
 * Tudo generico de proposito: "Barbearia Demo", dono "Admin" e barbeiros
 * "Barber 1", "Barber 2" e "Barber 3". E a conta que se mostra para quem
 * esta conhecendo o sistema — nada de nome de cliente real.
 *
 * A ideia e ter um cenario de lego: tudo o que este script cria pode ser
 * editado, adicionado ou apagado normalmente pela interface do sistema.
 * Nada aqui e magico — sao os mesmos registros que a tela criaria.
 *
 * Uso:
 *   node prisma/demo-barbearia.js              monta (ou atualiza) a empresa
 *   node prisma/demo-barbearia.js --zerar      apaga os dados de demonstracao,
 *                                                  mantendo empresa, equipe e modulos
 *   node prisma/demo-barbearia.js --remover    apaga a empresa e seus usuarios
 *
 * Rodar de novo NAO duplica: o script e idempotente. Se voce bagunçar tudo
 * testando, rode --remover e monte de novo.
 *
 * Variaveis (para montar outra demo):
 *   DEMO_EMPRESA, DEMO_SLUG, DEMO_DOMINIO   nome, slug e dominio dos e-mails
 *   DEMO_SENHA_EQUIPE, DEMO_SENHA_CLIENTE   obrigatorias: senha nenhuma fica
 *                                           escrita no repositorio (ele e publico)
 *   DEMO_DOMINIO_CLIENTE                    dominio dos e-mails dos clientes
 *   DEMO_PERFIL=essencial                   deixa ligados so agenda, clientes,
 *                                           caixa e o obrigatorio
 *
 * TRAVA: a empresa e achada pelo SLUG e so e tocada se todos os donos dela
 * tiverem e-mail do DEMO_DOMINIO. Antes ela era achada pelo nome — rodado em
 * producao, apagaria agenda e servicos de um cliente real de mesmo nome.
 *
 * O cenario foi desenhado para exercitar os requisitos do
 * Levantamento_de_Requisitos.pdf: carteira por barbeiro, mensalista com
 * barbeiro, cliente sumido, bloqueio de agenda, ajuste de comissao por dia
 * e agenda em grade com o dia cheio.
 */
require('dotenv/config');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const EMPRESA = process.env.DEMO_EMPRESA || 'Barbearia Demo';
const SLUG = process.env.DEMO_SLUG || 'barbearia-demo';
const DOMINIO = (process.env.DEMO_DOMINIO || 'ibarber.demo').toLowerCase();
const SENHA_PADRAO = process.env.DEMO_SENHA_EQUIPE;   // equipe: dono e barbeiros
const SENHA_CLIENTE = process.env.DEMO_SENHA_CLIENTE; // clientes finais, no portal
const PERFIL_ESSENCIAL = process.env.DEMO_PERFIL === 'essencial';
const ESSENCIAIS = new Set(['agendamentos', 'clientes', 'pdv', 'caixa']);
const emailEquipe = (nome) => `${nome}@${DOMINIO}`;
// Dominio dos e-mails dos clientes. Em producao use um que nao entregue a
// ninguem (ex.: cliente.ibarber.demo): a regua de mensalidades manda e-mail
// de verdade para o cliente, e @email.com e um dominio real.
// Mesma regra de src/utils/telefone.util.ts (chaveTelefone): DDD + 8 digitos,
// sem 55 e sem o nono digito. E assim que o login acha a conta pelo WhatsApp.
const chaveTelefone = (bruto) => {
  let d = String(bruto || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3);
  return d.length === 10 ? d : null;
};
const DOMINIO_CLIENTE = (process.env.DEMO_DOMINIO_CLIENTE || 'cliente.ibarber.demo').toLowerCase();

/**
 * Acha a empresa da demo pelo slug e confere que e mesmo da demo: todos os
 * donos com e-mail do dominio da demo. Qualquer outra coisa aborta.
 */
async function buscarEmpresaDemo() {
  const company = await prisma.company.findUnique({
    where: { slug: SLUG },
    include: { userRoles: { where: { role: 'DONO_EMPRESA' }, include: { user: { select: { email: true } } } } },
  });
  if (!company) return null;
  const donos = company.userRoles.map((r) => String(r.user.email || '').toLowerCase());
  const daDemo = donos.length > 0 && donos.every((email) => email.endsWith(`@${DOMINIO}`));
  if (!daDemo) {
    throw new Error(
      `A empresa com slug "${SLUG}" tem dono fora de @${DOMINIO} (${donos.join(', ') || 'sem dono'}). ` +
        'Nao parece ser a demo: nada foi alterado.'
    );
  }
  return company;
}

// ---------------------------------------------------------------
// Helpers de data. Tudo relativo a hoje, para a demo nunca "vencer".
// ---------------------------------------------------------------
const hoje = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const diasAtras = (n) => {
  const d = hoje();
  d.setDate(d.getDate() - n);
  return d;
};
const emHoras = (base, hora, minuto = 0) => {
  const d = new Date(base);
  d.setHours(hora, minuto, 0, 0);
  return d;
};
const proximoDiaUtil = (offset) => {
  const d = hoje();
  d.setDate(d.getDate() + offset);
  // Domingo (0) nao tem expediente no cenario: empurra para segunda.
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
};

async function acordarBanco() {
  for (let i = 1; i <= 8; i += 1) {
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('nao consegui conectar no banco');
}

// ---------------------------------------------------------------
// DESMONTAR
// ---------------------------------------------------------------
async function remover() {
  const company = await buscarEmpresaDemo();
  if (!company) {
    console.log(`"${EMPRESA}" nao existe. Nada a remover.`);
    return;
  }

  // Guarda os usuarios antes: o cascade apaga os vinculos (UserRole),
  // mas o usuario em si (profiles) fica orfao se nao for removido junto.
  const vinculos = await prisma.userRole.findMany({
    where: { companyId: company.id },
    select: { userId: true },
  });
  const userIds = [...new Set(vinculos.map((v) => v.userId))];

  // employee_module_permissions nao esta no schema Prisma: limpa na mao.
  await prisma.$executeRawUnsafe(
    `DELETE FROM "employee_module_permissions" WHERE "empresa_id" = $1`,
    company.id
  );

  await prisma.company.delete({ where: { id: company.id } });

  if (userIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: userIds }, roles: { none: {} } },
    });
  }

  console.log(`"${EMPRESA}" removida, junto com ${userIds.length} usuarios.`);
}

// ---------------------------------------------------------------
// ZERAR OS DADOS, MANTENDO A CONTA UTILIZAVEL
//
// Apaga tudo o que foi semeado para demonstracao, mas preserva o que
// o cliente precisa para entrar e comecar a usar: a empresa, os acessos
// da equipe e os modulos liberados.
// ---------------------------------------------------------------
async function zerar() {
  const company = await buscarEmpresaDemo();
  if (!company) {
    console.log(`"${EMPRESA}" nao existe. Nada a zerar.`);
    return;
  }
  const companyId = company.id;

  // A ordem importa: filhos antes dos pais, para nao esbarrar em chave estrangeira.
  const etapas = [
    ['uso de assinatura', () => prisma.subscriptionUsage.deleteMany({ where: { companyId } })],
    ['mensalidades', () => prisma.customerSubscription.deleteMany({ where: { companyId } })],
    ['planos', () => prisma.subscriptionPlan.deleteMany({ where: { companyId } })],
    ['historico de atendimento', () => prisma.customerServiceHistoryEntry.deleteMany({ where: { companyId } })],
    ['agendamentos', () => prisma.appointment.deleteMany({ where: { companyId } })],
    ['bloqueios de agenda', () => prisma.appointmentBlock.deleteMany({ where: { companyId } })],
    ['disponibilidade', () => prisma.appointmentAvailability.deleteMany({ where: { companyId } })],
    ['servicos', () => prisma.appointmentService.deleteMany({ where: { companyId } })],
    ['extrato de fidelidade', () => prisma.customerLoyaltyTransaction.deleteMany({ where: { companyId } })],
    ['saldos de fidelidade', () => prisma.customerLoyaltyProfile.deleteMany({ where: { companyId } })],
    ['regras de fidelidade', () => prisma.companyLoyaltySettings.deleteMany({ where: { companyId } })],
    ['contas do portal', () => prisma.customerAccount.deleteMany({ where: { companyId } })],
    ['clientes', () => prisma.customer.deleteMany({ where: { companyId } })],
    ['pedidos', () => prisma.order.deleteMany({ where: { companyId } })],
    ['produtos', () => prisma.product.deleteMany({ where: { companyId } })],
    ['caixa', () => prisma.cashTransaction.deleteMany({ where: { companyId } })],
    ['ajustes de comissao', () => prisma.commissionAdjustment.deleteMany({ where: { companyId } })],
    ['pagamentos de comissao', () => prisma.commissionPayout.deleteMany({ where: { companyId } })],
    ['perfis de comissao', () => prisma.commissionProfile.deleteMany({ where: { companyId } })],
    ['tarefas', () => prisma.task.deleteMany({ where: { companyId } })],
  ];

  for (const [nome, fn] of etapas) {
    try {
      const r = await fn();
      if (r.count > 0) console.log(`  ${nome}: ${r.count} removidos`);
    } catch (error) {
      console.log(`  ${nome}: ignorado (${String(error.message).split('\n')[0].slice(0, 60)})`);
    }
  }

  console.log('\nMantidos para o cliente usar:');
  const equipe = await prisma.userRole.count({ where: { companyId } });
  const modulos = await prisma.companyModule.count({ where: { companyId, isActive: true } });
  console.log(`  empresa "${company.name}" (${company.slug}) — status ${company.status}`);
  console.log(`  ${equipe} acessos de equipe`);
  console.log(`  ${modulos} modulos liberados`);
}

// ---------------------------------------------------------------
// MONTAR
// ---------------------------------------------------------------
async function montar() {
  const sistemaBase = await prisma.sistemaBase.findFirst({
    where: { nome: 'Barbearia' },
    include: { modulos: { select: { moduloId: true, allowedRoles: true } } },
  });
  if (!sistemaBase) {
    throw new Error('Sistema base "Barbearia" nao encontrado. Rode o seed primeiro.');
  }

  // --- Empresa -------------------------------------------------
  if (!SENHA_PADRAO || !SENHA_CLIENTE) {
    throw new Error('Defina DEMO_SENHA_EQUIPE e DEMO_SENHA_CLIENTE (o repositorio e publico).');
  }
  let company = await buscarEmpresaDemo();
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: EMPRESA,
        slug: SLUG,
        document: '12.345.678/0001-90',
        plan: 'pro',
        status: 'active',
        sistemaBaseId: sistemaBase.id,
      },
    });
    console.log('empresa criada:', company.name, `(slug: ${company.slug})`);
  } else {
    company = await prisma.company.update({
      where: { id: company.id },
      data: { status: 'active', sistemaBaseId: sistemaBase.id, plan: 'pro' },
    });
    console.log('empresa ja existia, reaproveitando:', company.name);
  }
  const companyId = company.id;

  // --- Modulos liberados ---------------------------------------
  // Mesma logica do onboarding oficial: libera tudo o que o sistema base traz.
  // Com DEMO_PERFIL=essencial, so o obrigatorio e agenda, clientes e caixa
  // (igual ao perfil "Essencial" da tela Empresas > Modulos).
  const binds = await prisma.sistemaBaseModulo.findMany({
    where: { sistemaBaseId: sistemaBase.id },
    include: { modulo: { select: { codigo: true } } },
  });
  let ligados = 0;
  for (const bind of binds) {
    const allowedRoles =
      Array.isArray(bind.allowedRoles) && bind.allowedRoles.length > 0
        ? bind.allowedRoles
        : ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'];
    const isActive =
      !PERFIL_ESSENCIAL || bind.isMandatory || ESSENCIAIS.has(String(bind.modulo.codigo).toLowerCase());
    if (isActive) ligados += 1;
    await prisma.companyModule.upsert({
      where: { companyId_moduloId: { companyId, moduloId: bind.moduloId } },
      update: { isActive, allowedRoles },
      create: { companyId, moduloId: bind.moduloId, isActive, allowedRoles },
    });
  }
  console.log(`modulos ligados: ${ligados} de ${binds.length}${PERFIL_ESSENCIAL ? ' (perfil essencial)' : ''}`);

  // --- Equipe --------------------------------------------------
  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);

  async function garantirUsuario(email, fullName, role) {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, fullName, passwordHash: senhaHash, isActive: true },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { fullName, isActive: true, passwordHash: senhaHash },
      });
    }
    const vinculo = await prisma.userRole.findFirst({
      where: { userId: user.id, companyId, role },
    });
    if (!vinculo) {
      await prisma.userRole.create({ data: { userId: user.id, companyId, role } });
    }
    return user;
  }

  const admin = await garantirUsuario(emailEquipe('admin'), 'Admin', 'DONO_EMPRESA');
  const barber1 = await garantirUsuario(emailEquipe('barber1'), 'Barber 1', 'FUNCIONARIO_EMPRESA');
  const barber2 = await garantirUsuario(emailEquipe('barber2'), 'Barber 2', 'FUNCIONARIO_EMPRESA');
  const barber3 = await garantirUsuario(emailEquipe('barber3'), 'Barber 3', 'FUNCIONARIO_EMPRESA');
  const barbeiros = [barber1, barber2, barber3];
  console.log('equipe: Admin (dono), Barber 1, Barber 2 e Barber 3');

  // --- Servicos ------------------------------------------------
  // Duracoes multiplas de 30 para a grade fechar certinho.
  const servicosDef = [
    { name: 'Corte Masculino', durationMinutes: 30, price: 45, recommendedReturnDays: 21 },
    { name: 'Barba', durationMinutes: 30, price: 35, recommendedReturnDays: 15 },
    { name: 'Corte + Barba', durationMinutes: 60, price: 70, recommendedReturnDays: 21 },
    { name: 'Sobrancelha', durationMinutes: 30, price: 20, recommendedReturnDays: 30 },
    { name: 'Platinado', durationMinutes: 120, price: 180, recommendedReturnDays: 45 },
  ];
  const servicos = {};
  for (const def of servicosDef) {
    let s = await prisma.appointmentService.findFirst({
      where: { companyId, name: def.name },
    });
    s = s
      ? await prisma.appointmentService.update({ where: { id: s.id }, data: { ...def, isActive: true } })
      : await prisma.appointmentService.create({ data: { companyId, ...def, isActive: true } });
    servicos[def.name] = s;
  }
  // O onboarding cria um "Corte Tradicional" automatico; some com ele para
  // nao ficar servico duplicado na vitrine.
  await prisma.appointmentService.deleteMany({
    where: { companyId, name: 'Corte Tradicional' },
  });
  console.log(`servicos: ${servicosDef.length}`);

  // --- Disponibilidade -----------------------------------------
  // Seg a sex 09:00-19:00, sabado 09:00-17:00, domingo fechado.
  await prisma.appointmentAvailability.deleteMany({ where: { companyId } });
  const grade = [];
  for (const barbeiro of barbeiros) {
    for (let weekday = 1; weekday <= 6; weekday += 1) {
      grade.push({
        companyId,
        professionalId: barbeiro.id,
        weekday,
        startTime: '09:00',
        endTime: weekday === 6 ? '17:00' : '19:00',
        isActive: true,
      });
    }
  }
  await prisma.appointmentAvailability.createMany({ data: grade });
  console.log(`disponibilidade: ${grade.length} janelas (seg-sab)`);

  // --- Bloqueios de agenda -------------------------------------
  await prisma.appointmentBlock.deleteMany({ where: { companyId } });
  const blocos = [];
  // Almoco recorrente, 12:00-13:00, de segunda a sabado, para cada barbeiro.
  for (const barbeiro of barbeiros) {
    for (let weekday = 1; weekday <= 6; weekday += 1) {
      const inicioVigencia = emHoras(hoje(), 12, 0);
      const fimVigencia = new Date(inicioVigencia);
      fimVigencia.setFullYear(fimVigencia.getFullYear() + 1);
      blocos.push({
        companyId,
        professionalId: barbeiro.id,
        startAt: inicioVigencia,
        endAt: fimVigencia,
        reason: 'Almoco',
        isRecurring: true,
        weekday,
        startTime: '12:00',
        endTime: '13:00',
        isActive: true,
        createdByUserId: admin.id,
      });
    }
  }
  // Bloqueio pontual: Barber 2 no medico depois de amanha, a tarde.
  const diaMedico = proximoDiaUtil(2);
  blocos.push({
    companyId,
    professionalId: barber2.id,
    startAt: emHoras(diaMedico, 14, 0),
    endAt: emHoras(diaMedico, 16, 0),
    reason: 'Medico',
    isRecurring: false,
    isActive: true,
    createdByUserId: admin.id,
  });
  await prisma.appointmentBlock.createMany({ data: blocos });
  console.log(`bloqueios: ${blocos.length} (almoco recorrente + 1 folga pontual)`);

  // --- Produtos ------------------------------------------------
  const produtosDef = [
    { name: 'Pomada Modeladora', sku: 'POM-001', price: 45, stockQuantity: 24 },
    { name: 'Oleo para Barba', sku: 'OLE-002', price: 39.9, stockQuantity: 15 },
    { name: 'Shampoo Anticaspa', sku: 'SHA-003', price: 32.5, stockQuantity: 18 },
    { name: 'Minoxidil 60ml', sku: 'MIN-004', price: 89.9, stockQuantity: 7 },
    { name: 'Cera Fixadora', sku: 'CER-005', price: 38, stockQuantity: 3 },
  ];
  for (const def of produtosDef) {
    const existente = await prisma.product.findFirst({ where: { companyId, sku: def.sku } });
    if (existente) {
      await prisma.product.update({ where: { id: existente.id }, data: { ...def, isActive: true } });
    } else {
      await prisma.product.create({ data: { companyId, ...def, isActive: true } });
    }
  }
  console.log(`produtos: ${produtosDef.length}`);

  // --- Fidelidade ----------------------------------------------
  await prisma.companyLoyaltySettings.upsert({
    where: { companyId },
    update: { pointsPerService: 1, cashbackPercent: 5, tenthServiceFree: true, pointValue: 1, isActive: true },
    create: {
      companyId,
      pointsPerService: 1,
      cashbackPercent: 5,
      tenthServiceFree: true,
      pointValue: 1,
      isActive: true,
    },
  });
  console.log('fidelidade: 1 ponto por servico, 5% cashback, 10o corte gratis');

  // --- Comissoes -----------------------------------------------
  const comissoes = [
    { professional: barber3, servico: 50, produto: 15, fixo: 0 },
    { professional: barber1, servico: 45, produto: 12, fixo: 0 },
    { professional: barber2, servico: 40, produto: 10, fixo: 300 },
  ];
  for (const c of comissoes) {
    await prisma.commissionProfile.upsert({
      where: { companyId_professionalId: { companyId, professionalId: c.professional.id } },
      update: {
        serviceCommissionPct: c.servico,
        productCommissionPct: c.produto,
        monthlyFixedAmount: c.fixo,
        isActive: true,
      },
      create: {
        companyId,
        professionalId: c.professional.id,
        serviceCommissionPct: c.servico,
        productCommissionPct: c.produto,
        monthlyFixedAmount: c.fixo,
        isActive: true,
      },
    });
  }
  console.log('perfis de comissao: 3');

  // --- Clientes ------------------------------------------------
  // diasSemVir null = nunca foi atendido (aparece como "Nunca veio").
  const clientesDef = [
    { name: 'Joao Pedro Alves', phone: '(51) 99101-2233', barbeiro: barber1, diasSemVir: 0 },
    { name: 'Marcos Vinicius Rocha', phone: '(51) 99102-3344', barbeiro: barber1, diasSemVir: 7 },
    { name: 'Lucas Ferreira', phone: '(51) 99103-4455', barbeiro: barber1, diasSemVir: 21 },
    { name: 'Bruno Cardoso', phone: '(51) 99104-5566', barbeiro: barber1, diasSemVir: 68 },
    { name: 'Anderson Melo', phone: '(51) 99105-6677', barbeiro: barber1, diasSemVir: 115 },
    { name: 'Thiago Nunes', phone: '(51) 99106-7788', barbeiro: barber2, diasSemVir: 3 },
    { name: 'Rodrigo Batista', phone: '(51) 99107-8899', barbeiro: barber2, diasSemVir: 14 },
    { name: 'Eduardo Ramos', phone: '(51) 99108-9900', barbeiro: barber2, diasSemVir: 42 },
    { name: 'Gustavo Pereira', phone: '(51) 99109-0011', barbeiro: barber2, diasSemVir: 95 },
    { name: 'Carlos Eduardo Dias', phone: '(51) 99110-1122', barbeiro: barber3, diasSemVir: 2 },
    { name: 'Ricardo Antunes', phone: '(51) 99111-2233', barbeiro: barber3, diasSemVir: 30 },
    { name: 'Vitor Hugo Campos', phone: '(51) 99112-3344', barbeiro: barber3, diasSemVir: 180 },
    // Sem barbeiro definido: aparecem como "Sem barbeiro" e servem para
    // testar a atribuicao manual na ficha do cliente.
    { name: 'Leonardo Prado', phone: '(51) 99113-4455', barbeiro: null, diasSemVir: 9 },
    { name: 'Matheus Ribeiro', phone: '(51) 99114-5566', barbeiro: null, diasSemVir: null },
    { name: 'Daniel Fonseca', phone: '(51) 99115-6677', barbeiro: null, diasSemVir: null },
    // Cliente desativado ha 40 dias: testa o "desativado ha X dias".
    {
      name: 'Paulo Henrique Souza',
      phone: '(51) 99116-7788',
      barbeiro: barber1,
      diasSemVir: 150,
      inativoHa: 40,
    },
  ];

  const clientes = {};
  for (const def of clientesDef) {
    const dados = {
      name: def.name,
      phone: def.phone,
      email: `${def.name.split(' ')[0].toLowerCase()}@${DOMINIO_CLIENTE}`,
      isActive: !def.inativoHa,
      preferredProfessionalId: def.barbeiro ? def.barbeiro.id : null,
      lastVisitAt: def.diasSemVir === null ? null : diasAtras(def.diasSemVir),
      deactivatedAt: def.inativoHa ? diasAtras(def.inativoHa) : null,
    };
    let c = await prisma.customer.findFirst({ where: { companyId, name: def.name } });
    c = c
      ? await prisma.customer.update({ where: { id: c.id }, data: dados })
      : await prisma.customer.create({ data: { companyId, ...dados } });
    clientes[def.name] = c;
  }
  console.log(`clientes: ${clientesDef.length} (com carteira, sumidos e 1 desativado)`);

  // --- Contas do portal do cliente -----------------------------
  // Sem isso o cliente final nao consegue entrar em /cliente/<slug>/login.
  // Criadas so para clientes ativos: cliente desativado nao deve logar.
  const senhaClienteHash = await bcrypt.hash(SENHA_CLIENTE, 10);
  let contasCriadas = 0;
  for (const def of clientesDef) {
    if (def.inativoHa) continue;
    const cliente = clientes[def.name];
    const email = cliente.email;
    const existente = await prisma.customerAccount.findFirst({
      where: { companyId, customerId: cliente.id },
    });
    if (existente) {
      await prisma.customerAccount.update({
        where: { id: existente.id },
        data: { email, phone: chaveTelefone(cliente.phone), passwordHash: senhaClienteHash, isActive: true },
      });
    } else {
      await prisma.customerAccount.create({
        data: {
          companyId,
          customerId: cliente.id,
          email,
          // Cliente de verdade entra pelo WhatsApp; a demo tambem.
          phone: chaveTelefone(cliente.phone),
          passwordHash: senhaClienteHash,
          isActive: true,
        },
      });
    }
    contasCriadas += 1;
  }
  console.log(`contas do portal do cliente: ${contasCriadas}`);

  // --- Planos de mensalidade -----------------------------------
  const planosDef = [
    { name: 'Mensal 2 Cortes', interval: 'monthly', price: 90, includedServices: 2, isUnlimited: false },
    { name: 'Mensal 4 Cortes', interval: 'monthly', price: 160, includedServices: 4, isUnlimited: false },
    { name: 'Barba Ilimitada', interval: 'monthly', price: 130, includedServices: null, isUnlimited: true },
    { name: 'Trimestral Completo', interval: 'quarterly', price: 420, includedServices: 12, isUnlimited: false },
  ];
  const planos = {};
  for (const def of planosDef) {
    let p = await prisma.subscriptionPlan.findFirst({ where: { companyId, name: def.name } });
    p = p
      ? await prisma.subscriptionPlan.update({ where: { id: p.id }, data: { ...def, isActive: true } })
      : await prisma.subscriptionPlan.create({ data: { companyId, ...def, isActive: true } });
    planos[def.name] = p;
  }
  console.log(`planos: ${planosDef.length}`);

  // --- Mensalistas ---------------------------------------------
  // Cada mensalidade nasce vinculada ao barbeiro do cliente.
  const mensalistasDef = [
    { cliente: 'Joao Pedro Alves', plano: 'Mensal 4 Cortes', barbeiro: barber1, restantes: 2 },
    { cliente: 'Marcos Vinicius Rocha', plano: 'Mensal 2 Cortes', barbeiro: barber1, restantes: 1 },
    { cliente: 'Thiago Nunes', plano: 'Barba Ilimitada', barbeiro: barber2, restantes: null },
    { cliente: 'Carlos Eduardo Dias', plano: 'Trimestral Completo', barbeiro: barber3, restantes: 9 },
    { cliente: 'Rodrigo Batista', plano: 'Mensal 2 Cortes', barbeiro: barber2, restantes: 2 },
  ];
  await prisma.customerSubscription.deleteMany({ where: { companyId } });
  for (const def of mensalistasDef) {
    const inicio = diasAtras(10);
    const fim = new Date(inicio);
    fim.setMonth(fim.getMonth() + (def.plano === 'Trimestral Completo' ? 3 : 1));
    await prisma.customerSubscription.create({
      data: {
        companyId,
        customerId: clientes[def.cliente].id,
        planId: planos[def.plano].id,
        professionalId: def.barbeiro.id,
        status: 'active',
        startAt: inicio,
        endAt: fim,
        remainingServices: def.restantes,
        autoRenew: true,
        amount: Number(planos[def.plano].price),
      },
    });
  }
  console.log(`mensalistas: ${mensalistasDef.length} (todos com barbeiro)`);

  // --- Agendamentos --------------------------------------------
  await prisma.appointment.deleteMany({ where: { companyId } });
  const agendamentos = [];
  const addAgendamento = (base, hora, minuto, barbeiro, clienteNome, servicoNome, status) => {
    const cliente = clientes[clienteNome];
    const servico = servicos[servicoNome];
    agendamentos.push({
      companyId,
      customerId: cliente.id,
      customerName: cliente.name,
      serviceId: servico.id,
      serviceName: servico.name,
      professionalId: barbeiro.id,
      professionalName: barbeiro.fullName,
      scheduledAt: emHoras(base, hora, minuto),
      status,
    });
  };

  // Hoje: dia cheio, para a agenda em grade ficar bonita na demonstracao.
  const dHoje = hoje();
  addAgendamento(dHoje, 9, 0, barber1, 'Joao Pedro Alves', 'Corte Masculino', 'concluido');
  addAgendamento(dHoje, 9, 30, barber1, 'Marcos Vinicius Rocha', 'Corte + Barba', 'concluido');
  addAgendamento(dHoje, 10, 30, barber1, 'Lucas Ferreira', 'Corte Masculino', 'confirmado');
  addAgendamento(dHoje, 11, 0, barber1, 'Leonardo Prado', 'Barba', 'confirmado');
  addAgendamento(dHoje, 14, 0, barber1, 'Bruno Cardoso', 'Corte Masculino', 'pendente');
  addAgendamento(dHoje, 15, 30, barber1, 'Anderson Melo', 'Corte + Barba', 'pendente');

  addAgendamento(dHoje, 9, 0, barber2, 'Thiago Nunes', 'Barba', 'concluido');
  addAgendamento(dHoje, 10, 0, barber2, 'Rodrigo Batista', 'Corte Masculino', 'confirmado');
  addAgendamento(dHoje, 13, 0, barber2, 'Eduardo Ramos', 'Platinado', 'confirmado');
  addAgendamento(dHoje, 16, 0, barber2, 'Gustavo Pereira', 'Corte Masculino', 'pendente');

  addAgendamento(dHoje, 9, 30, barber3, 'Carlos Eduardo Dias', 'Corte + Barba', 'concluido');
  addAgendamento(dHoje, 14, 0, barber3, 'Ricardo Antunes', 'Sobrancelha', 'confirmado');
  addAgendamento(dHoje, 15, 0, barber3, 'Matheus Ribeiro', 'Corte Masculino', 'pendente');

  // Amanha: agenda mais leve, mostra que da para navegar entre os dias.
  const dAmanha = proximoDiaUtil(1);
  addAgendamento(dAmanha, 10, 0, barber1, 'Joao Pedro Alves', 'Barba', 'confirmado');
  addAgendamento(dAmanha, 11, 0, barber2, 'Thiago Nunes', 'Corte Masculino', 'pendente');
  addAgendamento(dAmanha, 16, 0, barber3, 'Vitor Hugo Campos', 'Corte + Barba', 'pendente');

  // Depois de amanha: Barber 2 tem o bloqueio do medico das 14h as 16h.
  addAgendamento(diaMedico, 9, 30, barber2, 'Rodrigo Batista', 'Barba', 'confirmado');
  addAgendamento(diaMedico, 17, 0, barber1, 'Lucas Ferreira', 'Corte Masculino', 'pendente');

  // Historico do mes: alimenta a comissao e o relatorio.
  for (let i = 1; i <= 12; i += 1) {
    const dia = diasAtras(i * 2);
    if (dia.getDay() === 0) continue;
    const barbeiro = [barber1, barber2, barber3][i % 3];
    const nomes = Object.keys(clientes);
    const clienteNome = nomes[i % nomes.length];
    const servicoNome = ['Corte Masculino', 'Barba', 'Corte + Barba'][i % 3];
    addAgendamento(dia, 10 + (i % 6), 0, barbeiro, clienteNome, servicoNome, 'concluido');
  }

  await prisma.appointment.createMany({ data: agendamentos });
  console.log(`agendamentos: ${agendamentos.length} (hoje cheio + futuros + historico)`);

  // --- Avaliacoes ----------------------------------------------
  // Uma por atendimento concluido, para o ranking e as estrelas do link
  // publico aparecerem na demonstracao. Notas diferentes por barbeiro para o
  // ranking ter ordem. (Apagar os agendamentos acima ja levou as antigas.)
  const concluidos = await prisma.appointment.findMany({
    where: { companyId, status: 'concluido' },
    select: { id: true, professionalId: true, customerId: true, scheduledAt: true },
    orderBy: { scheduledAt: 'asc' },
  });
  const notasPorBarbeiro = {
    [barber1.id]: [5, 5, 4, 5, 5],
    [barber2.id]: [5, 4, 4, 5, 4],
    [barber3.id]: [4, 5, 3, 4, 5],
  };
  const comentarios = [
    'Corte ficou perfeito, voltei pela terceira vez.',
    null,
    'Atendimento pontual e caprichado.',
    null,
    'Barba impecável, recomendo.',
  ];
  const avaliacoes = concluidos.map((a, i) => {
    const notas = notasPorBarbeiro[a.professionalId] || [5];
    return {
      companyId,
      appointmentId: a.id,
      professionalId: a.professionalId,
      customerId: a.customerId,
      rating: notas[i % notas.length],
      comment: comentarios[i % comentarios.length],
      createdAt: new Date(a.scheduledAt.getTime() + 2 * 60 * 60 * 1000),
    };
  });
  await prisma.appointmentReview.createMany({ data: avaliacoes });
  console.log(`avaliacoes: ${avaliacoes.length}`);

  // --- Historico de atendimento (ficha do cliente) --------------
  await prisma.customerServiceHistoryEntry.deleteMany({ where: { companyId } });
  const historico = [];
  for (const def of clientesDef) {
    if (def.diasSemVir === null) continue;
    const cliente = clientes[def.name];
    const barbeiro = def.barbeiro || barber1;
    const servico = servicos['Corte Masculino'];
    const dataServico = diasAtras(def.diasSemVir);
    const retornoEm = 21;
    const vencimento = new Date(dataServico);
    vencimento.setDate(vencimento.getDate() + retornoEm);
    historico.push({
      companyId,
      customerId: cliente.id,
      source: 'manual',
      serviceId: servico.id,
      serviceName: servico.name,
      professionalId: barbeiro.id,
      professionalName: barbeiro.fullName,
      serviceDate: dataServico,
      amount: 45,
      returnInDays: retornoEm,
      returnDueAt: vencimento,
      createdByUserId: admin.id,
    });
  }
  await prisma.customerServiceHistoryEntry.createMany({ data: historico });
  console.log(`historico de atendimento: ${historico.length} (gera os follow-ups de retorno)`);

  // --- Ajustes de comissao por dia -----------------------------
  const mesRef = new Date(hoje().getFullYear(), hoje().getMonth(), 1);
  await prisma.commissionAdjustment.deleteMany({ where: { companyId } });
  const ajustes = [
    { barbeiro: barber1, dia: 3, valor: 80, motivo: 'Bonus por meta de produtos' },
    { barbeiro: barber1, dia: 11, valor: -35, motivo: 'Quebra de material' },
    { barbeiro: barber2, dia: 5, valor: 50, motivo: 'Atendimento em domingo de evento' },
    { barbeiro: barber2, dia: 18, valor: -20, motivo: 'Atraso recorrente' },
  ];
  for (const a of ajustes) {
    const refDate = new Date(Date.UTC(mesRef.getFullYear(), mesRef.getMonth(), a.dia));
    // So lanca ajuste em dia que ja passou, senao o extrato fica no futuro.
    if (refDate > new Date()) continue;
    await prisma.commissionAdjustment.create({
      data: {
        companyId,
        professionalId: a.barbeiro.id,
        monthRef: mesRef,
        refDate,
        amount: a.valor,
        reason: a.motivo,
        createdByUserId: admin.id,
      },
    });
  }
  console.log('ajustes de comissao: lancados por dia, com motivo');

  // --- Vendas fechadas (pedidos) -------------------------------
  // Sem isso o faturamento do mes fica zerado no painel e nos relatorios.
  await prisma.order.deleteMany({ where: { companyId } });
  const nomesClientes = Object.keys(clientes);
  const pedidos = [];
  for (let i = 0; i < 26; i += 1) {
    const dia = diasAtras(i);
    // Domingo a barbearia esta fechada.
    if (dia.getDay() === 0) continue;
    // Dois a tres fechamentos por dia, com ticket variando.
    const qtd = 2 + (i % 2);
    for (let j = 0; j < qtd; j += 1) {
      const cliente = clientes[nomesClientes[(i + j) % nomesClientes.length]];
      const base = [45, 70, 35, 90, 115, 180][(i + j) % 6];
      pedidos.push({
        id: require('crypto').randomUUID(),
        companyId,
        customerName: cliente.name,
        total: base,
        status: 'paid',
        createdAt: emHoras(dia, 10 + ((i + j) % 8), 0),
        updatedAt: emHoras(dia, 10 + ((i + j) % 8), 0),
      });
    }
  }
  await prisma.order.createMany({ data: pedidos });
  // A forma de pagamento de venda sem gateway vive no log do checkout do PDV.
  // Sem ele o Caixa mostra tudo como "desconhecido" e o fechamento zera.
  const formas = ['dinheiro', 'pix', 'debito', 'credito'];
  await prisma.auditLog.deleteMany({ where: { companyId, action: 'PDV_CHECKOUT' } });
  await prisma.auditLog.createMany({
    data: pedidos.map((p, i) => ({
      userId: admin.id,
      companyId,
      action: 'PDV_CHECKOUT',
      resource: 'orders',
      details: { orderId: p.id, paymentMethod: formas[i % formas.length], subtotal: p.total, discount: 0 },
      createdAt: p.createdAt,
    })),
  });
  const faturamento = pedidos.reduce((soma, p) => soma + p.total, 0);
  console.log(`pedidos pagos: ${pedidos.length} (faturamento de R$ ${faturamento.toFixed(2)})`);

  // --- Caixa ---------------------------------------------------
  await prisma.cashTransaction.deleteMany({ where: { companyId } });
  const caixa = [
    { type: 'entrada', category: 'Servicos', description: 'Fechamento do dia', amount: 780, paymentMethod: 'dinheiro', dias: 1 },
    { type: 'entrada', category: 'Produtos', description: 'Venda de pomadas', amount: 135, paymentMethod: 'pix', dias: 1 },
    { type: 'saida', category: 'Fornecedor', description: 'Compra de insumos', amount: 320, paymentMethod: 'pix', dias: 3 },
    { type: 'saida', category: 'Estrutura', description: 'Conta de luz', amount: 410, paymentMethod: 'debito', dias: 5 },
    { type: 'entrada', category: 'Servicos', description: 'Fechamento do dia', amount: 920, paymentMethod: 'credito', dias: 6 },
  ];
  await prisma.cashTransaction.createMany({
    data: caixa.map((c) => ({
      companyId,
      type: c.type,
      category: c.category,
      description: c.description,
      amount: c.amount,
      paymentMethod: c.paymentMethod,
      transactionDate: diasAtras(c.dias),
      createdBy: admin.id,
    })),
  });
  console.log(`caixa: ${caixa.length} lancamentos`);

  // --- Resumo --------------------------------------------------
  console.log('\n===============================================');
  console.log(`  ${EMPRESA} montada`);
  console.log('===============================================');
  console.log(`  Painel:  /login`);
  console.log(`  Dono:     ${emailEquipe('admin')}`);
  console.log(`  Barbeiros: ${emailEquipe('barber1')}, ${emailEquipe('barber2')}, ${emailEquipe('barber3')}`);
  console.log('  Senha (todos): a de DEMO_SENHA_EQUIPE');
  console.log('');
  console.log(`  Portal do cliente: /cliente/${company.slug}/login`);
  console.log(`  Ex.: joao@${DOMINIO_CLIENTE}  |  thiago@${DOMINIO_CLIENTE} (mensalista)`);
  console.log('  Senha (todos os clientes): a de DEMO_SENHA_CLIENTE');
  console.log('');
  console.log(`  Link publico (sem login): /agendar/${company.slug}`);
  console.log('===============================================');
}

async function main() {
  await acordarBanco();
  if (process.argv.includes('--remover')) {
    await remover();
  } else if (process.argv.includes('--zerar')) {
    await zerar();
  } else {
    await montar();
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('FALHOU:', error.message);
  await prisma.$disconnect();
  process.exit(1);
});
