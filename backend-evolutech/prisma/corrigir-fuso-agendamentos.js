/**
 * Puxa para a hora certa os agendamentos gravados antes da correcao de fuso.
 *
 * O QUE ACONTECEU
 * O servidor rodava em UTC. O horario chegava do formulario como texto sem
 * fuso ("2026-09-02T15:00") e era gravado como se fosse UTC. Na pratica, todo
 * agendamento ficou tres horas atras do horario que a pessoa marcou: quem
 * combinou 15:00 tem 15:00 UTC no banco, que e 12:00 em Sao Paulo.
 *
 * Enquanto tudo lia a hora em UTC, ninguem via o erro no painel — mas o
 * cliente, no celular dele, lia 12:00. Com o servidor agora no fuso da
 * barbearia, a agenda passa a mostrar 12:00 tambem: certo em relacao ao que
 * esta gravado, errado em relacao ao que foi combinado.
 *
 * Este script acerta o que esta gravado, somando o deslocamento do fuso.
 *
 * COMO USAR
 *   node prisma/corrigir-fuso-agendamentos.js                  (simulacao)
 *   node prisma/corrigir-fuso-agendamentos.js --aplicar        (grava)
 *   node prisma/corrigir-fuso-agendamentos.js --desde=2026-09-01 --aplicar
 *   node prisma/corrigir-fuso-agendamentos.js --empresa=<id> --aplicar
 *
 * Sem --aplicar ele so mostra o que faria. Por padrao mexe de hoje para a
 * frente: agendamento passado e historico, e reescrever historico so
 * atrapalha quem for conferir o faturamento depois.
 *
 * RODE UMA VEZ SO. Rodar duas vezes empurra os horarios seis horas — e o
 * estrago e silencioso, porque nada no resultado denuncia hora deslocada.
 * Por isso a gravacao deixa marca em audit_logs (AGENDA_FUSO_CORRIGIDO) e a
 * segunda execucao se recusa a rodar. --forcar passa por cima.
 *
 * Precisa de DATABASE_URL. Vem do .env do backend; se a maquina nao tiver
 * .env, da para passar na hora:
 *   PowerShell: $env:DATABASE_URL="postgres://..."; node prisma/corrigir-fuso-agendamentos.js
 *   bash:       DATABASE_URL="postgres://..." node prisma/corrigir-fuso-agendamentos.js
 */

require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

// Erro de conexao aqui vira uma parede de stack do Prisma que nao diz o
// que fazer. Checa antes e explica.
if (!process.env.DATABASE_URL) {
  console.error(
    [
      'DATABASE_URL nao encontrada.',
      '',
      'Esta maquina nao tem backend-evolutech/.env (so o .env.example).',
      'Escolha um caminho:',
      '',
      '  1) criar o .env a partir do .env.example, com a URL do banco; ou',
      '  2) passar a URL so para esta execucao:',
      '',
      '     PowerShell: $env:DATABASE_URL="postgres://..."; node prisma/corrigir-fuso-agendamentos.js',
      '     bash:       DATABASE_URL="postgres://..." node prisma/corrigir-fuso-agendamentos.js',
      '',
      'A URL e a mesma que o backend usa em producao (Neon).',
    ].join('\n')
  );
  process.exit(1);
}

const prisma = new PrismaClient();

const FUSO = process.env.TZ_BARBEARIA || 'America/Sao_Paulo';

const argumentos = process.argv.slice(2);
const aplicar = argumentos.includes('--aplicar');
const forcar = argumentos.includes('--forcar');

/** A marca que diz "este banco ja foi corrigido". */
const ACAO_AUDITORIA = 'AGENDA_FUSO_CORRIGIDO';
const valorDe = (nome) => {
  const item = argumentos.find((arg) => arg.startsWith(`--${nome}=`));
  return item ? item.split('=').slice(1).join('=').trim() : '';
};

/** Quantos minutos o fuso da barbearia esta atras do UTC naquele instante. */
function deslocamentoMinutos(instante) {
  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const partes = {};
  for (const parte of formatador.formatToParts(instante)) {
    if (parte.type !== 'literal') partes[parte.type] = parte.value;
  }
  const comoSeFosseUTC = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour) % 24,
    Number(partes.minute),
    Number(partes.second)
  );
  return (comoSeFosseUTC - instante.getTime()) / 60000;
}

const emBrasilia = (data) =>
  data.toLocaleString('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' });

async function main() {
  const desdeTexto = valorDe('desde');
  const empresaId = valorDe('empresa');

  const jaRodou = await prisma.auditLog.findFirst({
    where: { action: ACAO_AUDITORIA },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, details: true },
  });

  if (jaRodou && !forcar) {
    console.log(`Este banco ja foi corrigido em ${emBrasilia(jaRodou.createdAt)}.`);
    console.log(`Detalhes: ${JSON.stringify(jaRodou.details)}`);
    console.log('');
    console.log('Rodar de novo empurraria tudo mais tres horas. Nada foi feito.');
    console.log('Se for mesmo necessario, use --forcar.');
    return;
  }

  // Meia-noite na barbearia. Com o corte em UTC, rodando de madrugada no
  // Brasil o "hoje" ja era o dia seguinte e o dia corrente ficava de fora.
  const desde = desdeTexto ? new Date(`${desdeTexto}T00:00:00Z`) : new Date();
  if (Number.isNaN(desde.getTime())) {
    throw new Error('--desde invalido. Use AAAA-MM-DD');
  }
  if (!desdeTexto) {
    desde.setUTCMinutes(desde.getUTCMinutes() + deslocamentoMinutos(desde));
    desde.setUTCHours(0, 0, 0, 0);
    desde.setUTCMinutes(desde.getUTCMinutes() - deslocamentoMinutos(desde));
  }

  const agendamentos = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: desde },
      ...(empresaId ? { companyId: empresaId } : {}),
    },
    select: {
      id: true,
      companyId: true,
      customerName: true,
      serviceName: true,
      professionalName: true,
      scheduledAt: true,
      status: true,
    },
    orderBy: { scheduledAt: 'asc' },
  });

  console.log(`Fuso da barbearia: ${FUSO}`);
  console.log(`Agendamentos a partir de ${desde.toISOString().slice(0, 10)}: ${agendamentos.length}`);
  console.log(aplicar ? 'MODO GRAVACAO' : 'SIMULACAO (use --aplicar para gravar)');
  console.log('');

  let alterados = 0;

  for (const item of agendamentos) {
    const atual = new Date(item.scheduledAt);
    // O instante gravado era a hora de parede lida como UTC. A hora certa e a
    // mesma parede, agora no fuso da casa: por isso desconta o deslocamento.
    const corrigido = new Date(atual.getTime() - deslocamentoMinutos(atual) * 60000);
    if (corrigido.getTime() === atual.getTime()) continue;

    alterados += 1;
    console.log(
      `${item.id}  ${emBrasilia(atual)} -> ${emBrasilia(corrigido)}  ` +
        `${item.customerName || 'sem cadastro'} / ${item.serviceName} / ${item.professionalName || '-'}`
    );

    if (aplicar) {
      await prisma.appointment.update({
        where: { id: item.id },
        data: { scheduledAt: corrigido },
      });
    }
  }

  // A marca fica no banco, nao num arquivo: quem roda da proxima vez pode
  // ser outra maquina, e a pergunta "isto ja foi corrigido?" e do banco.
  if (aplicar && alterados > 0) {
    await prisma.auditLog.create({
      data: {
        action: ACAO_AUDITORIA,
        resource: 'appointments',
        details: {
          fuso: FUSO,
          agendamentos: alterados,
          desde: desde.toISOString(),
          empresa: empresaId || null,
          forcado: forcar,
        },
      },
    });
  }

  console.log('');
  console.log(`${alterados} agendamento(s) ${aplicar ? 'corrigidos' : 'seriam corrigidos'}.`);
  if (!aplicar && alterados > 0) {
    console.log('Confira a lista acima e rode de novo com --aplicar.');
  }
}

main()
  .catch((erro) => {
    console.error('Falhou:', erro.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
