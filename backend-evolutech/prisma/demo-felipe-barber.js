/**
 * Monta (ou desmonta) a barbearia de demonstracao "Felipe Barber".
 *
 * A ideia e ter um cenario de lego: tudo o que este script cria pode ser
 * editado, adicionado ou apagado normalmente pela interface do sistema.
 * Nada aqui e magico — sao os mesmos registros que a tela criaria.
 *
 * Uso:
 *   node prisma/demo-felipe-barber.js              monta (ou atualiza) a empresa
 *   node prisma/demo-felipe-barber.js --remover    apaga a empresa e seus usuarios
 *
 * Rodar de novo NAO duplica: o script e idempotente. Se voce bagunçar tudo
 * testando, rode --remover e monte de novo.
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

const EMPRESA = 'Felipe Barber';
const SENHA_PADRAO = 'Barber@2026';

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
  const company = await prisma.company.findFirst({ where: { name: EMPRESA } });
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
  let company = await prisma.company.findFirst({ where: { name: EMPRESA } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: EMPRESA,
        slug: 'felipe-barber',
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
  for (const bind of sistemaBase.modulos) {
    const allowedRoles =
      Array.isArray(bind.allowedRoles) && bind.allowedRoles.length > 0
        ? bind.allowedRoles
        : ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'];
    await prisma.companyModule.upsert({
      where: { companyId_moduloId: { companyId, moduloId: bind.moduloId } },
      update: { isActive: true, allowedRoles },
      create: { companyId, moduloId: bind.moduloId, isActive: true, allowedRoles },
    });
  }
  console.log(`modulos liberados: ${sistemaBase.modulos.length}`);

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

  const felipe = await garantirUsuario('felipe@felipebarber.com', 'Felipe Moreira', 'DONO_EMPRESA');
  const rafael = await garantirUsuario('rafael@felipebarber.com', 'Rafael Souza', 'FUNCIONARIO_EMPRESA');
  const diego = await garantirUsuario('diego@felipebarber.com', 'Diego Lima', 'FUNCIONARIO_EMPRESA');
  const barbeiros = [felipe, rafael, diego];
  console.log('equipe: Felipe (dono), Rafael e Diego (barbeiros)');

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
        createdByUserId: felipe.id,
      });
    }
  }
  // Bloqueio pontual: Diego no medico depois de amanha, a tarde.
  const diaMedico = proximoDiaUtil(2);
  blocos.push({
    companyId,
    professionalId: diego.id,
    startAt: emHoras(diaMedico, 14, 0),
    endAt: emHoras(diaMedico, 16, 0),
    reason: 'Medico',
    isRecurring: false,
    isActive: true,
    createdByUserId: felipe.id,
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
    { professional: felipe, servico: 100, produto: 20, fixo: 0 },
    { professional: rafael, servico: 45, produto: 12, fixo: 0 },
    { professional: diego, servico: 40, produto: 10, fixo: 300 },
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
    { name: 'Joao Pedro Alves', phone: '(51) 99101-2233', barbeiro: rafael, diasSemVir: 0 },
    { name: 'Marcos Vinicius Rocha', phone: '(51) 99102-3344', barbeiro: rafael, diasSemVir: 7 },
    { name: 'Lucas Ferreira', phone: '(51) 99103-4455', barbeiro: rafael, diasSemVir: 21 },
    { name: 'Bruno Cardoso', phone: '(51) 99104-5566', barbeiro: rafael, diasSemVir: 68 },
    { name: 'Anderson Melo', phone: '(51) 99105-6677', barbeiro: rafael, diasSemVir: 115 },
    { name: 'Thiago Nunes', phone: '(51) 99106-7788', barbeiro: diego, diasSemVir: 3 },
    { name: 'Rodrigo Batista', phone: '(51) 99107-8899', barbeiro: diego, diasSemVir: 14 },
    { name: 'Felipe Ramos', phone: '(51) 99108-9900', barbeiro: diego, diasSemVir: 42 },
    { name: 'Gustavo Pereira', phone: '(51) 99109-0011', barbeiro: diego, diasSemVir: 95 },
    { name: 'Carlos Eduardo Dias', phone: '(51) 99110-1122', barbeiro: felipe, diasSemVir: 2 },
    { name: 'Rafael Antunes', phone: '(51) 99111-2233', barbeiro: felipe, diasSemVir: 30 },
    { name: 'Vitor Hugo Campos', phone: '(51) 99112-3344', barbeiro: felipe, diasSemVir: 180 },
    // Sem barbeiro definido: aparecem como "Sem barbeiro" e servem para
    // testar a atribuicao manual na ficha do cliente.
    { name: 'Leonardo Prado', phone: '(51) 99113-4455', barbeiro: null, diasSemVir: 9 },
    { name: 'Matheus Ribeiro', phone: '(51) 99114-5566', barbeiro: null, diasSemVir: null },
    { name: 'Diego Fonseca', phone: '(51) 99115-6677', barbeiro: null, diasSemVir: null },
    // Cliente desativado ha 40 dias: testa o "desativado ha X dias".
    {
      name: 'Paulo Henrique Souza',
      phone: '(51) 99116-7788',
      barbeiro: rafael,
      diasSemVir: 150,
      inativoHa: 40,
    },
  ];

  const clientes = {};
  for (const def of clientesDef) {
    const dados = {
      name: def.name,
      phone: def.phone,
      email: `${def.name.split(' ')[0].toLowerCase()}@email.com`,
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
    { cliente: 'Joao Pedro Alves', plano: 'Mensal 4 Cortes', barbeiro: rafael, restantes: 2 },
    { cliente: 'Marcos Vinicius Rocha', plano: 'Mensal 2 Cortes', barbeiro: rafael, restantes: 1 },
    { cliente: 'Thiago Nunes', plano: 'Barba Ilimitada', barbeiro: diego, restantes: null },
    { cliente: 'Carlos Eduardo Dias', plano: 'Trimestral Completo', barbeiro: felipe, restantes: 9 },
    { cliente: 'Rodrigo Batista', plano: 'Mensal 2 Cortes', barbeiro: diego, restantes: 2 },
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
  addAgendamento(dHoje, 9, 0, rafael, 'Joao Pedro Alves', 'Corte Masculino', 'concluido');
  addAgendamento(dHoje, 9, 30, rafael, 'Marcos Vinicius Rocha', 'Corte + Barba', 'concluido');
  addAgendamento(dHoje, 10, 30, rafael, 'Lucas Ferreira', 'Corte Masculino', 'confirmado');
  addAgendamento(dHoje, 11, 0, rafael, 'Leonardo Prado', 'Barba', 'confirmado');
  addAgendamento(dHoje, 14, 0, rafael, 'Bruno Cardoso', 'Corte Masculino', 'pendente');
  addAgendamento(dHoje, 15, 30, rafael, 'Anderson Melo', 'Corte + Barba', 'pendente');

  addAgendamento(dHoje, 9, 0, diego, 'Thiago Nunes', 'Barba', 'concluido');
  addAgendamento(dHoje, 10, 0, diego, 'Rodrigo Batista', 'Corte Masculino', 'confirmado');
  addAgendamento(dHoje, 13, 0, diego, 'Felipe Ramos', 'Platinado', 'confirmado');
  addAgendamento(dHoje, 16, 0, diego, 'Gustavo Pereira', 'Corte Masculino', 'pendente');

  addAgendamento(dHoje, 9, 30, felipe, 'Carlos Eduardo Dias', 'Corte + Barba', 'concluido');
  addAgendamento(dHoje, 14, 0, felipe, 'Rafael Antunes', 'Sobrancelha', 'confirmado');
  addAgendamento(dHoje, 15, 0, felipe, 'Matheus Ribeiro', 'Corte Masculino', 'pendente');

  // Amanha: agenda mais leve, mostra que da para navegar entre os dias.
  const dAmanha = proximoDiaUtil(1);
  addAgendamento(dAmanha, 10, 0, rafael, 'Joao Pedro Alves', 'Barba', 'confirmado');
  addAgendamento(dAmanha, 11, 0, diego, 'Thiago Nunes', 'Corte Masculino', 'pendente');
  addAgendamento(dAmanha, 16, 0, felipe, 'Vitor Hugo Campos', 'Corte + Barba', 'pendente');

  // Depois de amanha: Diego tem o bloqueio do medico das 14h as 16h.
  addAgendamento(diaMedico, 9, 30, diego, 'Rodrigo Batista', 'Barba', 'confirmado');
  addAgendamento(diaMedico, 17, 0, rafael, 'Lucas Ferreira', 'Corte Masculino', 'pendente');

  // Historico do mes: alimenta a comissao e o relatorio.
  for (let i = 1; i <= 12; i += 1) {
    const dia = diasAtras(i * 2);
    if (dia.getDay() === 0) continue;
    const barbeiro = [rafael, diego, felipe][i % 3];
    const nomes = Object.keys(clientes);
    const clienteNome = nomes[i % nomes.length];
    const servicoNome = ['Corte Masculino', 'Barba', 'Corte + Barba'][i % 3];
    addAgendamento(dia, 10 + (i % 6), 0, barbeiro, clienteNome, servicoNome, 'concluido');
  }

  await prisma.appointment.createMany({ data: agendamentos });
  console.log(`agendamentos: ${agendamentos.length} (hoje cheio + futuros + historico)`);

  // --- Historico de atendimento (ficha do cliente) --------------
  await prisma.customerServiceHistoryEntry.deleteMany({ where: { companyId } });
  const historico = [];
  for (const def of clientesDef) {
    if (def.diasSemVir === null) continue;
    const cliente = clientes[def.name];
    const barbeiro = def.barbeiro || rafael;
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
      createdByUserId: felipe.id,
    });
  }
  await prisma.customerServiceHistoryEntry.createMany({ data: historico });
  console.log(`historico de atendimento: ${historico.length} (gera os follow-ups de retorno)`);

  // --- Ajustes de comissao por dia -----------------------------
  const mesRef = new Date(hoje().getFullYear(), hoje().getMonth(), 1);
  await prisma.commissionAdjustment.deleteMany({ where: { companyId } });
  const ajustes = [
    { barbeiro: rafael, dia: 3, valor: 80, motivo: 'Bonus por meta de produtos' },
    { barbeiro: rafael, dia: 11, valor: -35, motivo: 'Quebra de material' },
    { barbeiro: diego, dia: 5, valor: 50, motivo: 'Atendimento em domingo de evento' },
    { barbeiro: diego, dia: 18, valor: -20, motivo: 'Atraso recorrente' },
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
        createdByUserId: felipe.id,
      },
    });
  }
  console.log('ajustes de comissao: lancados por dia, com motivo');

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
      createdBy: felipe.id,
    })),
  });
  console.log(`caixa: ${caixa.length} lancamentos`);

  // --- Resumo --------------------------------------------------
  console.log('\n===============================================');
  console.log(`  ${EMPRESA} montada`);
  console.log('===============================================');
  console.log(`  Painel:  /login`);
  console.log(`  Dono:    felipe@felipebarber.com`);
  console.log(`  Barbeiro: rafael@felipebarber.com`);
  console.log(`  Barbeiro: diego@felipebarber.com`);
  console.log(`  Senha (todos): ${SENHA_PADRAO}`);
  console.log('');
  console.log(`  Link publico de agendamento: /agendar/${company.slug}`);
  console.log(`  Portal do cliente:           /cliente/${company.slug}/login`);
  console.log('===============================================');
}

async function main() {
  await acordarBanco();
  const desmontar = process.argv.includes('--remover');
  if (desmontar) {
    await remover();
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
