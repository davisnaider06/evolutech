/**
 * Nome do profissional como o cliente ve.
 *
 * Convite aceito sem nome deixa o e-mail no fullName, e o link publico
 * mostrava "fulano88@gmail.com" para qualquer visitante. Aqui o e-mail vira
 * so a parte antes do @, sem numeros — reconhecivel e sem expor o endereco.
 * Vale para o link publico e para o portal do cliente.
 */
export function nomePublicoProfissional(fullName?: string | null) {
  const nome = String(fullName || '').trim();
  if (!nome.includes('@')) return nome || 'Profissional';
  const usuario = nome.split('@')[0].replace(/[\d._-]+/g, ' ').trim();
  if (!usuario) return 'Profissional';
  return usuario.charAt(0).toUpperCase() + usuario.slice(1);
}
