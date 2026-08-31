/**
 * Faixas fixas da agenda.
 *
 * A barbearia nao controla expediente por barbeiro: a grade da operacao mostra
 * a mesma faixa para todo mundo, das 7h as 22h, mesmo que um barbeiro nao va
 * ficar ate as 22h. Quem trabalha ate mais cedo bloqueia o proprio horario pela
 * agenda (appointment_blocks), e e isso que tira o horario do ar.
 *
 * O cliente enxerga uma faixa menor, das 7h as 19h: ninguem agenda sozinho para
 * as 21h. Dentro dela, um horario so aparece se nao estiver bloqueado pelo
 * barbeiro nem sobreposto a um agendamento existente.
 *
 * `appointment_availability` deixou de alimentar essas contas. A tabela e os
 * endpoints continuam de pe, sem uso, para quando expediente por barbeiro
 * voltar a fazer sentido.
 */

/** Grade interna: o que a equipe ve na tela de Agendamentos. */
export const AGENDA_INICIO_MINUTOS = 7 * 60;
export const AGENDA_FIM_MINUTOS = 22 * 60;

/** Janela de auto-atendimento: link publico e portal do cliente. */
export const CLIENTE_INICIO_MINUTOS = 7 * 60;
export const CLIENTE_FIM_MINUTOS = 19 * 60;
