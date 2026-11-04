import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { limitesDoDia } from '../config/fuso';

/**
 * Reserva de horario sem corrida.
 *
 * Antes, as tres portas de entrada da agenda (link publico, portal do cliente
 * e painel da equipe) faziam "consulta se esta livre -> grava" fora de
 * transacao. Dois clientes confirmando o mesmo horario no mesmo segundo
 * passavam os dois pela consulta e os dois eram gravados.
 *
 * Aqui a checagem e a gravacao acontecem dentro da mesma transacao, depois de
 * uma trava (pg_advisory_xact_lock) por barbeiro e por dia. Quem chega segundo
 * espera o primeiro terminar e, ao conferir de novo, ja enxerga o agendamento
 * dele. A trava e liberada sozinha no fim da transacao, inclusive em erro.
 *
 * Nao foi usada uma constraint EXCLUDE no banco porque o fim do atendimento
 * nao era gravado (a duracao vinha do servico na hora da consulta). Com
 * `duration_minutes` gravado ela passa a ser possivel, se um dia valer a pena.
 */

/** Status que liberam o horario. */
export const STATUS_QUE_LIBERAM = ['cancelado', 'cancelled', 'no_show', 'no-show'];

const DURACAO_PADRAO = 30;

/**
 * Duracao de um agendamento ja gravado. Vale a gravada nele; os antigos, de
 * antes da coluna existir, caem na do servico e por ultimo em 30 minutos.
 */
export function duracaoDoAgendamento(
  item: { durationMinutes?: number | null; serviceId?: string | null },
  duracaoPorServico?: Map<string, number>,
  padrao = DURACAO_PADRAO
): number {
  const gravada = Number(item.durationMinutes || 0);
  if (gravada > 0) return gravada;
  const doServico = item.serviceId ? Number(duracaoPorServico?.get(item.serviceId) || 0) : 0;
  return doServico > 0 ? doServico : padrao;
}

/** Duracao dos servicos dos agendamentos antigos que ainda nao tem duracao gravada. */
export async function duracoesDosServicosSemDuracao(
  db: any,
  itens: Array<{ durationMinutes?: number | null; serviceId?: string | null }>
): Promise<Map<string, number>> {
  const ids = Array.from(
    new Set(
      itens
        .filter((item) => !Number(item.durationMinutes || 0) && typeof item.serviceId === 'string')
        .map((item) => item.serviceId as string)
    )
  );
  if (ids.length === 0) return new Map();
  const servicos = await db.appointmentService.findMany({
    where: { id: { in: ids } },
    select: { id: true, durationMinutes: true },
  });
  return new Map(servicos.map((item: any) => [item.id, Number(item.durationMinutes || DURACAO_PADRAO)]));
}

export class HorarioOcupadoError extends Error {
  statusCode = 409;
  conflito: { id: string; scheduledAt: Date; customerName: string | null; customerId: string | null };
  constructor(conflito: HorarioOcupadoError['conflito']) {
    super('Horario ja reservado. Escolha outro horario');
    this.conflito = conflito;
  }
}

/** Trava a agenda de um barbeiro num dia ate o fim da transacao. */
export async function travarAgendaDoDia(
  tx: Prisma.TransactionClient,
  companyId: string,
  professionalId: string,
  inicio: Date
) {
  const dia = limitesDoDia(inicio).inicio.toISOString().slice(0, 10);
  const chave = `agenda:${companyId}:${professionalId}:${dia}`;
  // O SELECT externo existe porque pg_advisory_xact_lock devolve void, tipo que
  // o Prisma nao sabe desserializar.
  await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtextextended(${chave}, 0))) AS trava`;
}

/** Confere sobreposicao com o que ja esta gravado. Lanca HorarioOcupadoError. */
export async function garantirSemSobreposicao(
  db: any,
  params: {
    companyId: string;
    professionalId: string;
    inicio: Date;
    duracaoMinutos: number;
    ignorarId?: string;
  }
) {
  const { companyId, professionalId, inicio, duracaoMinutos, ignorarId } = params;
  const dia = limitesDoDia(inicio);
  const novoInicio = inicio.getTime();
  const novoFim = novoInicio + Math.max(1, duracaoMinutos) * 60 * 1000;

  // Pega tambem o fim do dia anterior: um atendimento longo que comeca as
  // 23h ainda ocupa a meia-noite. Na pratica nao acontece, mas custa pouco.
  const doDia = await db.appointment.findMany({
    where: {
      companyId,
      professionalId,
      scheduledAt: { gte: new Date(dia.inicio.getTime() - 12 * 3600 * 1000), lte: dia.fim },
      status: { notIn: STATUS_QUE_LIBERAM },
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
    },
    select: {
      id: true,
      scheduledAt: true,
      serviceId: true,
      durationMinutes: true,
      customerName: true,
      customerId: true,
    },
  });
  if (doDia.length === 0) return;

  const duracoes = await duracoesDosServicosSemDuracao(db, doDia);
  const conflito = doDia.find((item: any) => {
    const inicioExistente = new Date(item.scheduledAt).getTime();
    const fimExistente = inicioExistente + duracaoDoAgendamento(item, duracoes) * 60 * 1000;
    return novoInicio < fimExistente && inicioExistente < novoFim;
  });

  if (conflito) {
    throw new HorarioOcupadoError({
      id: conflito.id,
      scheduledAt: conflito.scheduledAt,
      customerName: conflito.customerName ?? null,
      customerId: conflito.customerId ?? null,
    });
  }
}

/**
 * Trava, confere e grava, tudo na mesma transacao.
 *
 * `gravar` recebe o client da transacao e deve fazer o create/update. Se o
 * horario estiver ocupado, lanca HorarioOcupadoError antes de gravar.
 */
export async function reservarHorario<T>(
  params: {
    companyId: string;
    professionalId: string;
    inicio: Date;
    duracaoMinutos: number;
    ignorarId?: string;
  },
  gravar: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await travarAgendaDoDia(tx, params.companyId, params.professionalId, params.inicio);
      await garantirSemSobreposicao(tx, params);
      return gravar(tx);
    },
    // Com o banco acordando a primeira query demora; o padrao de 5s cortava.
    { maxWait: 10_000, timeout: 20_000 }
  );
}

/**
 * Pedido repetido (o cliente nao recebeu a resposta e mandou de novo)?
 *
 * O "conflito" e o proprio agendamento que ele acabou de criar: mesmo cliente,
 * mesmo horario, criado ha pouco. Nesse caso a resposta certa e devolver o que
 * ja foi gravado, e nao "horario ocupado".
 */
export async function agendamentoRepetido(
  companyId: string,
  customerId: string | null | undefined,
  scheduledAt: Date,
  serviceId: string
) {
  if (!customerId) return null;
  return (prisma as any).appointment.findFirst({
    where: {
      companyId,
      customerId,
      serviceId,
      scheduledAt,
      status: { notIn: STATUS_QUE_LIBERAM },
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
    },
  });
}
