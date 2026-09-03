/**
 * A hora da barbearia, unica para todo mundo.
 *
 * Tres pessoas olham o mesmo agendamento: o Felipe no computador da loja, o
 * barbeiro no celular e o cliente no portal. Se cada tela formatar a data com
 * o fuso do proprio aparelho, o mesmo horario aparece diferente em cada uma —
 * e foi exatamente o que aconteceu: o painel mostrava 15:00 e o cliente lia
 * 12:00 no mesmo agendamento.
 *
 * Aqui todo horario e formatado e montado no fuso da barbearia. Celular com
 * fuso trocado, notebook em viagem ou navegador em ingles continuam vendo a
 * hora da loja, que e a unica que importa para quem vai cortar o cabelo.
 *
 * O backend faz a mesma coisa do outro lado (`src/config/fuso.ts`): sem fuso
 * explicito na string, a hora e lida como hora da barbearia.
 */

/** Fuso da casa. Igual ao do backend — os dois tem de andar juntos. */
export const FUSO_BARBEARIA = 'America/Sao_Paulo';

interface PartesDaData {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

const formatador = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_BARBEARIA,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Quebra um instante nas partes da hora de parede da barbearia. */
function partesDaCasa(instante: Date): PartesDaData {
  const mapa: Record<string, string> = {};
  for (const parte of formatador.formatToParts(instante)) {
    if (parte.type !== 'literal') mapa[parte.type] = parte.value;
  }
  return {
    ano: Number(mapa.year),
    mes: Number(mapa.month),
    dia: Number(mapa.day),
    // 24h em algumas engines devolve "24" na virada; 24 e a meia-noite do dia.
    hora: Number(mapa.hour) % 24,
    minuto: Number(mapa.minute),
    segundo: Number(mapa.second),
  };
}

/** Quantos minutos a barbearia esta a frente do UTC naquele instante (-180). */
function deslocamentoMinutos(instante: Date): number {
  const p = partesDaCasa(instante);
  const comoSeFosseUTC = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return (comoSeFosseUTC - instante.getTime()) / 60000;
}

const paraData = (valor: Date | string | number | null | undefined): Date | null => {
  if (valor === null || valor === undefined || valor === '') return null;
  const data = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
};

const doisDigitos = (valor: number) => String(valor).padStart(2, '0');

/**
 * O instante em que a barbearia marca determinada hora de parede.
 *
 * Roda o calculo duas vezes de proposito: o primeiro palpite usa o
 * deslocamento errado quando a data cai perto de uma virada de horario de
 * verao, e a segunda passada corrige.
 */
export function instanteNaBarbearia(
  ano: number,
  mes: number,
  dia: number,
  hora = 0,
  minuto = 0
): Date {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto, 0);
  const primeiro = palpite - deslocamentoMinutos(new Date(palpite)) * 60000;
  const segundo = palpite - deslocamentoMinutos(new Date(primeiro)) * 60000;
  return new Date(segundo);
}

/** "2026-09-02" + 930 minutos -> instante das 15:30 na barbearia. */
export function instanteDoSlot(dataISO: string, minutosDoDia: number): Date {
  const [ano, mes, dia] = dataISO.split('-').map((parte) => Number(parte));
  return instanteNaBarbearia(ano, mes, dia, 0, minutosDoDia);
}

/** Hoje na barbearia, "AAAA-MM-DD" — nao "hoje" no fuso do aparelho. */
export function hojeNaBarbearia(): string {
  const p = partesDaCasa(new Date());
  return `${p.ano}-${doisDigitos(p.mes)}-${doisDigitos(p.dia)}`;
}

/** "AAAA-MM-DD" do instante, na barbearia. */
export function dataISONaBarbearia(valor: Date | string | number | null | undefined): string {
  const data = paraData(valor);
  if (!data) return '';
  const p = partesDaCasa(data);
  return `${p.ano}-${doisDigitos(p.mes)}-${doisDigitos(p.dia)}`;
}

/** "15:30" na barbearia. */
export function formatarHora(valor: Date | string | number | null | undefined): string {
  const data = paraData(valor);
  if (!data) return '';
  const p = partesDaCasa(data);
  return `${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}`;
}

/** "02/09/2026" na barbearia. */
export function formatarData(valor: Date | string | number | null | undefined): string {
  const data = paraData(valor);
  if (!data) return '';
  const p = partesDaCasa(data);
  return `${doisDigitos(p.dia)}/${doisDigitos(p.mes)}/${p.ano}`;
}

/** "02/09/2026 15:30" na barbearia. */
export function formatarDataHora(valor: Date | string | number | null | undefined): string {
  const data = paraData(valor);
  if (!data) return '';
  return `${formatarData(data)} ${formatarHora(data)}`;
}

/**
 * Valor de um <input type="datetime-local">: "AAAA-MM-DDTHH:mm".
 *
 * O campo nao tem fuso — ele mostra o texto que receber. Entregar a ele o
 * resultado de toISOString() (que e UTC) fazia o formulario de edicao abrir
 * com tres horas a mais do que a agenda mostrava, e salvar assim.
 */
export function paraCampoDataHora(valor: Date | string | number | null | undefined): string {
  const data = paraData(valor);
  if (!data) return '';
  const p = partesDaCasa(data);
  return `${p.ano}-${doisDigitos(p.mes)}-${doisDigitos(p.dia)}T${doisDigitos(p.hora)}:${doisDigitos(
    p.minuto
  )}`;
}

/**
 * Caminho inverso: o texto do campo vira o instante que o backend recebe.
 *
 * Mandamos ISO completo, com fuso, para nao sobrar duvida na travessia.
 */
export function doCampoDataHora(texto: string): string {
  const casa = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(texto || '').trim());
  if (!casa) return '';
  return instanteNaBarbearia(
    Number(casa[1]),
    Number(casa[2]),
    Number(casa[3]),
    Number(casa[4]),
    Number(casa[5])
  ).toISOString();
}

/** Minutos desde a meia-noite da barbearia (a mesma conta que a agenda usa). */
export function minutosDoDiaNaBarbearia(valor: Date | string | number | null | undefined): number {
  const data = paraData(valor);
  if (!data) return 0;
  const p = partesDaCasa(data);
  return p.hora * 60 + p.minuto;
}

/** "930" -> "15:30". Rotulo da grade, sem passar por Date. */
export function minutosParaHora(minutos: number): string {
  const total = Math.max(0, Math.round(minutos));
  return `${doisDigitos(Math.floor(total / 60))}:${doisDigitos(total % 60)}`;
}
