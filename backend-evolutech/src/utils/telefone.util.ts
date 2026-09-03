/**
 * Telefone como identidade do cliente.
 *
 * Nome nao identifica ninguem: numa barbearia de bairro dois "Joao Silva" e o
 * normal, nao a excecao. O que separa duas pessoas e o telefone — e por isso
 * ele precisa comparar igual mesmo escrito diferente: "(31) 99876-5432" no
 * balcao e "5531998765432" no link publico sao a mesma pessoa.
 */

/**
 * Reduz o telefone ao que de fato identifica a linha: DDD + 8 digitos.
 *
 * Tira a formatacao, tira o codigo do pais e tira o nono digito. Assim o
 * mesmo numero digitado de tres jeitos diferentes cai numa chave so, e o
 * cadastro nao duplica nem funde duas pessoas.
 *
 * Devolve string vazia quando nao da para identificar nada.
 */
export function chaveTelefone(bruto: unknown): string {
  let digitos = String(bruto ?? '').replace(/\D/g, '');
  if (!digitos) return '';

  // Codigo do pais na frente (55 + DDD + numero).
  if (digitos.length >= 12 && digitos.startsWith('55')) {
    digitos = digitos.slice(2);
  }

  // Nono digito dos celulares: 31 9 98765432 -> 31 98765432.
  if (digitos.length === 11 && digitos[2] === '9') {
    digitos = digitos.slice(0, 2) + digitos.slice(3);
  }

  return digitos;
}

/** Os 8 ultimos digitos — o filtro barato para buscar candidatos no banco. */
export function finalDoTelefone(bruto: unknown): string {
  const digitos = String(bruto ?? '').replace(/\D/g, '');
  return digitos.slice(-8);
}

/** true quando os dois numeros sao a mesma linha, escritos como estiverem. */
export function mesmoTelefone(a: unknown, b: unknown): boolean {
  const chaveA = chaveTelefone(a);
  const chaveB = chaveTelefone(b);
  return Boolean(chaveA) && chaveA === chaveB;
}
