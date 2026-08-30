/**
 * Monta o link que abre a conversa do cliente no WhatsApp.
 *
 * O envio automatico (regua de cobranca, avisos) continua passando pelo
 * backend via Z-API. Isto aqui e outra coisa: e o atalho para o atendente
 * falar com o cliente na hora, pelo proprio WhatsApp dele.
 */

/**
 * Deixa o telefone no formato que o WhatsApp espera: so digitos, com codigo
 * do pais. Mesma regra do `normalizePhone` do backend, para um numero que
 * funciona la funcionar aqui.
 *
 * Devolve null quando o numero nao da para usar — assim quem chama decide se
 * esconde o botao ou o mostra desabilitado, em vez de abrir uma aba quebrada.
 */
export function toWhatsAppNumber(phone?: string | null): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;

  // 10 ou 11 digitos: numero brasileiro sem o codigo do pais.
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  // 12 ou 13: ja veio com o 55 na frente.
  if (digits.length === 12 || digits.length === 13) return digits;

  return null;
}

/** true quando da para abrir conversa com esse telefone. */
export const podeAbrirWhatsApp = (phone?: string | null) => toWhatsAppNumber(phone) !== null;

/**
 * Link da conversa. Usa `wa.me`, que o proprio WhatsApp mantem e que resolve
 * sozinho entre app e web conforme o dispositivo — no celular abre o
 * aplicativo, no computador abre o WhatsApp Web.
 */
export function linkWhatsApp(phone?: string | null, mensagem?: string): string | null {
  const numero = toWhatsAppNumber(phone);
  if (!numero) return null;

  const base = `https://wa.me/${numero}`;
  const texto = String(mensagem || '').trim();
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
