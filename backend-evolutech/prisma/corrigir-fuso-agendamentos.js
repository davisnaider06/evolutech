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
 * RODE UMA VEZ SO. Rodar duas vezes empurra os horarios seis horas.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const FUSO = process.env.TZ_BARBEARIA || 'America/Sao_Paulo';

const argumentos = process.argv.slice(2);
const aplicar = argumentos.includes('--aplicar');
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

  const desde = desdeTexto ? new Date(`${desdeTexto}T00:00:00Z`) : new Date();
  if (Number.isNaN(desde.getTime())) {
    throw new Error('--desde invalido. Use AAAA-MM-DD');
  }
  if (!desdeTexto) desde.setUTCHours(0, 0, 0, 0);

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
