/**
 * Horario de funcionamento da barbearia.
 *
 * Uma faixa so, valendo para todo barbeiro e todo dia — e o horario da CASA,
 * nao expediente individual. Barbeiro que nao pode num pedaco do dia fecha
 * aquele pedaco em Bloquear horario, que e a excecao do dia.
 *
 * Vive em `companies.agenda_start_time` / `agenda_end_time` para o dono poder
 * mudar sem deploy. NULL nos dois significa "vale o padrao", entao empresa que
 * nunca configurou continua funcionando igual.
 *
 * Este arquivo e a unica porta de entrada dessa informacao: a agenda da
 * equipe, o link publico e o portal do cliente passam todos por aqui. Foi
 * espalhar essa decisao por quatro lugares que deixou o horario divergente
 * entre o que a equipe via e o que o cliente conseguia marcar.
 */

export interface FaixaMinutos {
  inicioMinutos: number;
  fimMinutos: number;
}

/** "09:30" -> 570. Devolve null no que nao for hora valida. */
export function horaParaMinutos(valor: unknown): number | null {
  const texto = String(valor ?? '').trim();
  const casa = /^(\d{1,2}):(\d{2})/.exec(texto);
  if (!casa) return null;
  const h = Number(casa[1]);
  const m = Number(casa[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** 570 -> "09:30". */
export function minutosParaHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Faixa de funcionamento da empresa, com o padrao como rede de seguranca.
 *
 * Cai no padrao em qualquer situacao suspeita — campo vazio, hora invalida,
 * fim antes do inicio. A agenda nunca deve sumir por causa de um valor
 * estranho gravado: pior que um horario errado e um dia sem horario nenhum.
 */
export async function resolverHorarioDaCasa(
  prismaClient: any,
  companyId: string,
  padrao: FaixaMinutos
): Promise<FaixaMinutos> {
  const empresa = await prismaClient.company.findUnique({
    where: { id: companyId },
    select: { agendaStartTime: true, agendaEndTime: true },
  });

  const inicio = horaParaMinutos(empresa?.agendaStartTime);
  const fim = horaParaMinutos(empresa?.agendaEndTime);

  if (inicio === null || fim === null || fim <= inicio) return { ...padrao };
  return { inicioMinutos: inicio, fimMinutos: fim };
}
