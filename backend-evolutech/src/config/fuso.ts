/**
 * Fuso horario da barbearia — a fonte unica da hora do sistema.
 *
 * O servidor de producao roda em UTC. A barbearia vive em Sao Paulo. Como o
 * codigo da agenda usa hora local do processo (`getHours`, `setHours`) para
 * decidir a que minuto do dia um agendamento pertence, rodar em UTC fazia o
 * painel do dono mostrar 15:00 num agendamento que o cliente marcou (e via)
 * como 12:00. Tres horas de diferenca entre a mesma linha do banco, so por
 * causa de quem estava olhando.
 *
 * A correcao e fixar o fuso do processo. Assim "hora local do servidor" passa
 * a ser exatamente "hora da barbearia", e todo o codigo que ja existia — a
 * grade, os bloqueios, os horarios livres, os relatorios por dia — passa a
 * falar a mesma hora que o cliente ve na tela dele.
 *
 * O front tambem formata tudo neste fuso (`src/lib/horario.ts`), entao
 * celular com fuso errado, barbeiro viajando ou dono no notebook em outro
 * pais continuam vendo a hora da barbearia.
 */

/** Fuso da casa. Trocavel por variavel de ambiente se abrir em outra praca. */
export const FUSO_BARBEARIA = String(process.env.TZ_BARBEARIA || 'America/Sao_Paulo');

/**
 * Fixa o fuso do processo. Precisa rodar antes de qualquer conta com data —
 * por isso e chamado na primeira linha do server.
 */
export function aplicarFusoDaCasa(): string {
  process.env.TZ = FUSO_BARBEARIA;
  // Node le TZ a cada operacao de data, mas so depois que alguem cria uma
  // data nova. Esta linha forca a releitura ainda no boot.
  new Date().getTimezoneOffset();
  return FUSO_BARBEARIA;
}

/**
 * Converte o que chega na API em um instante de verdade.
 *
 * Aceita tres formatos, e a diferenca entre eles e o motivo deste arquivo:
 *  - "2026-09-02T15:00:00.000Z" / "...-03:00": ja traz o fuso, vale o que veio;
 *  - "2026-09-02T15:00" (o que um <input type="datetime-local"> manda):
 *    nao traz fuso nenhum. Aqui isso significa 15:00 NA BARBEARIA — e nao
 *    15:00 no fuso de quem digitou nem 15:00 em UTC;
 *  - "2026-09-02": meia-noite da barbearia.
 *
 * Antes essa string ia crua para o Prisma, que a interpretava como UTC. Era
 * a origem do agendamento que nascia tres horas fora do lugar.
 */
export function interpretarDataHora(valor: unknown): Date | null {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }

  const texto = String(valor ?? '').trim();
  if (!texto) return null;

  // Com fuso explicito (Z ou +/-HH:MM no fim): o instante ja esta definido.
  if (/[zZ]$/.test(texto) || /[+-]\d{2}:?\d{2}$/.test(texto)) {
    const comFuso = new Date(texto);
    return Number.isNaN(comFuso.getTime()) ? null : comFuso;
  }

  const casa = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(texto);
  if (!casa) {
    const solto = new Date(texto);
    return Number.isNaN(solto.getTime()) ? null : solto;
  }

  // Sem fuso: e hora de parede da barbearia. Como o processo roda no fuso da
  // casa, montar a data pelos componentes ja da o instante certo.
  const data = new Date(
    Number(casa[1]),
    Number(casa[2]) - 1,
    Number(casa[3]),
    Number(casa[4] || 0),
    Number(casa[5] || 0),
    Number(casa[6] || 0),
    0
  );
  return Number.isNaN(data.getTime()) ? null : data;
}

// Efeito ja na importacao: quem importar este arquivo antes das rotas
// garante o fuso certo mesmo se o bundler reordenar os imports.
aplicarFusoDaCasa();

/** Minutos desde a meia-noite da barbearia. 15:30 -> 930. */
export function minutosDoDia(instante: Date): number {
  return instante.getHours() * 60 + instante.getMinutes();
}

/** Meia-noite e fim do dia da barbearia para o instante informado. */
export function limitesDoDia(instante: Date): { inicio: Date; fim: Date } {
  const inicio = new Date(instante);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(instante);
  fim.setHours(23, 59, 59, 999);
  return { inicio, fim };
}

/** "AAAA-MM-DD" do dia da barbearia — nunca via toISOString, que e UTC. */
export function dataISODaCasa(instante: Date): string {
  const ano = instante.getFullYear();
  const mes = String(instante.getMonth() + 1).padStart(2, '0');
  const dia = String(instante.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}
