/**
 * Identidade visual do profissional nas telas.
 *
 * Enquanto nao existe foto no cadastro, o barbeiro e reconhecido pelas
 * iniciais numa cor propria. A cor sai do id, entao e a mesma na agenda, nas
 * comissoes e em qualquer tela nova — e o dono aprende a reconhecer pela cor
 * antes de ler o nome.
 */

/** Iniciais do nome: primeira letra do primeiro e do ultimo nome. */
export function iniciais(nome: string): string {
  const partes = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

/** Fundo e texto do avatar, estaveis por profissional. */
export function corDoProfissional(id: string): { backgroundColor: string; color: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return { backgroundColor: `hsl(${hash} 62% 92%)`, color: `hsl(${hash} 68% 28%)` };
}
