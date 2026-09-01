/**
 * Horario de funcionamento da barbearia.
 *
 * A casa abre as 9h30 e fecha as 21h, e vale igual para todo mundo. Nao existe
 * expediente por barbeiro nem por dia da semana: barbeiro que nao pode num
 * horario especifico fecha aquele pedaco pela agenda, em Bloquear horario
 * (appointment_blocks). E isso que tira o horario do ar.
 *
 * A distincao importa: expediente e regra fixa da casa, bloqueio e a excecao
 * do dia. Misturar os dois foi o que gerou barbeiro sem agenda nenhuma.
 *
 * A mesma faixa serve a equipe e o cliente. O link publico oferecia ate as 19h
 * por supor que ninguem marca sozinho para as 21h — mas marca, e recusar era
 * perder agendamento no fim do dia.
 *
 * `appointment_availability` nao alimenta estas contas. A tabela e os
 * endpoints seguem de pe, sem uso, caso expediente por barbeiro volte a fazer
 * sentido em outra barbearia.
 */

/** Grade interna: o que a equipe ve na tela de Agendamentos. */
export const AGENDA_INICIO_MINUTOS = 9 * 60 + 30;
export const AGENDA_FIM_MINUTOS = 21 * 60;

/** Janela de auto-atendimento: link publico e portal do cliente. */
export const CLIENTE_INICIO_MINUTOS = 9 * 60 + 30;
export const CLIENTE_FIM_MINUTOS = 21 * 60;
