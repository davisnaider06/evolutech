import { prisma } from '../db';

export interface BlockedInterval {
  startMs: number;
  endMs: number;
  reason: string | null;
}

const timeToMinutes = (value?: string | null) => {
  const [h, m] = String(value || '').split(':').map((v) => Number(v));
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

/**
 * Retorna os intervalos bloqueados de um barbeiro em um dia especifico.
 *
 * Cobre os dois tipos de bloqueio:
 *  - pontual (isRecurring = false): usa startAt/endAt diretamente;
 *  - recorrente (isRecurring = true): vale para todo dia da semana em `weekday`,
 *    dentro da vigencia startAt..endAt, no horario startTime..endTime.
 *
 * Usado tanto pelo portal do cliente quanto pelo agendamento publico e pelo
 * painel da empresa, para que a regra de "horario indisponivel" seja uma so.
 */
export async function getBlockedIntervals(
  companyId: string,
  professionalId: string,
  dayStart: Date
): Promise<BlockedInterval[]> {
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  const weekday = dayStart.getDay();

  const blocks = await (prisma as any).appointmentBlock.findMany({
    where: {
      companyId,
      professionalId,
      isActive: true,
      OR: [
        // Bloqueio pontual que cruza o dia consultado.
        {
          isRecurring: false,
          startAt: { lte: dayEnd },
          endAt: { gte: dayStart },
        },
        // Bloqueio recorrente daquele dia da semana, dentro da vigencia.
        {
          isRecurring: true,
          weekday,
          startAt: { lte: dayEnd },
          endAt: { gte: dayStart },
        },
      ],
    },
    select: {
      startAt: true,
      endAt: true,
      isRecurring: true,
      startTime: true,
      endTime: true,
      reason: true,
    },
  });

  const intervals: BlockedInterval[] = [];

  for (const block of blocks as any[]) {
    if (block.isRecurring) {
      const startMin = timeToMinutes(block.startTime);
      const endMin = timeToMinutes(block.endTime);
      if (startMin === null || endMin === null || endMin <= startMin) continue;

      const start = new Date(dayStart);
      start.setHours(0, startMin, 0, 0);
      const end = new Date(dayStart);
      end.setHours(0, endMin, 0, 0);

      intervals.push({
        startMs: start.getTime(),
        endMs: end.getTime(),
        reason: block.reason || null,
      });
      continue;
    }

    // Bloqueio pontual: recorta para os limites do dia consultado.
    const startMs = Math.max(new Date(block.startAt).getTime(), dayStart.getTime());
    const endMs = Math.min(new Date(block.endAt).getTime(), dayEnd.getTime());
    if (endMs > startMs) {
      intervals.push({ startMs, endMs, reason: block.reason || null });
    }
  }

  return intervals;
}

/** true quando o intervalo [startMs, endMs) encosta em algum bloqueio. */
export function isIntervalBlocked(
  intervals: BlockedInterval[],
  startMs: number,
  endMs: number
): boolean {
  return intervals.some((item) => startMs < item.endMs && item.startMs < endMs);
}
