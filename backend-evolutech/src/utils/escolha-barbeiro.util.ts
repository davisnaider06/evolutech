/**
 * "Qualquer barbeiro": o cliente escolhe so o horario e o sistema decide quem
 * atende.
 *
 * Horarios: aparece todo horario em que PELO MENOS UM barbeiro esta livre
 * (uniao das agendas). Cada servico continua calculando os horarios livres de
 * um barbeiro do jeito dele (bloqueio, plano, horario da casa); aqui so se
 * junta o resultado.
 *
 * Decisao: entre os barbeiros livres naquele horario, fica o que tem menos
 * atendimentos marcados no dia. Empate e sorteado, para nao mandar sempre o
 * primeiro da lista.
 */
import { prisma } from '../db';
import { dataISODaCasa, limitesDoDia } from '../config/fuso';

/** Valor que o front manda no lugar do id do barbeiro. */
export const QUALQUER_BARBEIRO = 'qualquer';

export const ehQualquerBarbeiro = (professionalId: unknown) =>
  String(professionalId || '').trim().toLowerCase() === QUALQUER_BARBEIRO;

type Slot = { time: string; scheduled_at: string };
/** Horarios livres de um barbeiro num dia (AAAA-MM-DD), como cada servico ja calcula. */
type SlotsDoBarbeiro = (professionalId: string, dataISO: string) => Promise<Slot[]>;

const STATUS_FORA_DA_CONTA = ['cancelado', 'cancelled', 'no_show', 'no-show'];

/** Quem pode atender: dono e funcionarios ativos, como na escolha do barbeiro. */
async function barbeirosDaEmpresa(companyId: string): Promise<string[]> {
  const vinculos = await prisma.userRole.findMany({
    where: {
      companyId,
      role: { in: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] },
      user: { isActive: true },
    },
    select: { userId: true },
  });
  return Array.from(new Set(vinculos.map((v) => v.userId)));
}

/** Uniao dos horarios livres de toda a equipe no dia. */
export async function horariosDeQualquerBarbeiro(
  companyId: string,
  dataISO: string,
  slotsDe: SlotsDoBarbeiro
): Promise<Slot[]> {
  const ids = await barbeirosDaEmpresa(companyId);
  const listas = await Promise.all(ids.map((id) => slotsDe(id, dataISO)));
  const porHorario = new Map<string, Slot>();
  for (const lista of listas) {
    for (const slot of lista) porHorario.set(slot.scheduled_at, slot);
  }
  return Array.from(porHorario.values()).sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
}

/**
 * Decide o barbeiro para o horario. Retorna null se ninguem estiver livre —
 * o horario foi tomado entre o cliente ver a lista e confirmar.
 */
export async function decidirBarbeiro(
  companyId: string,
  scheduledAt: Date,
  slotsDe: SlotsDoBarbeiro
): Promise<string | null> {
  const ids = await barbeirosDaEmpresa(companyId);
  const dataISO = dataISODaCasa(scheduledAt);
  const instante = scheduledAt.getTime();

  const livres: string[] = [];
  await Promise.all(
    ids.map(async (id) => {
      const slots = await slotsDe(id, dataISO);
      if (slots.some((s) => new Date(s.scheduled_at).getTime() === instante)) livres.push(id);
    })
  );
  if (livres.length === 0) return null;
  if (livres.length === 1) return livres[0];

  const dia = limitesDoDia(scheduledAt);
  const marcados = await prisma.appointment.groupBy({
    by: ['professionalId'],
    where: {
      companyId,
      professionalId: { in: livres },
      scheduledAt: { gte: dia.inicio, lte: dia.fim },
      status: { notIn: STATUS_FORA_DA_CONTA },
    },
    _count: { _all: true },
  });
  const qtd = new Map(marcados.map((m) => [m.professionalId, m._count._all]));
  const menor = Math.min(...livres.map((id) => qtd.get(id) || 0));
  const empatados = livres.filter((id) => (qtd.get(id) || 0) === menor);
  return empatados[Math.floor(Math.random() * empatados.length)];
}
