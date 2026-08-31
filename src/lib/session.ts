/**
 * Sessao que sobrevive a fechar e abrir o app.
 *
 * O token sempre esteve no localStorage, mas isso nao bastava: na abertura os
 * dois contextos chamavam `/auth/me` e, em QUALQUER falha, apagavam o token.
 * Falha de rede conta — e num PWA aberto pela tela de inicio ela e comum:
 * o app abre antes do wifi conectar, o backend esta acordando, o Neon saiu da
 * hibernacao. O resultado era pedir login de novo sem a sessao ter expirado.
 *
 * Aqui ficam as duas pecas que resolvem isso: saber se o token expirou de
 * verdade (lendo o proprio token, sem rede) e guardar a ultima resposta boa
 * do servidor para reabrir instantaneamente, inclusive sem conexao.
 */

/** Conteudo do JWT, sem validar assinatura — quem valida e o servidor. */
export function decodeJwt<T = Record<string, any>>(token: string): T | null {
  try {
    const partes = token.split('.');
    if (partes.length < 2) return null;
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    return JSON.parse(json) as T;
  } catch (_error) {
    return null;
  }
}

/**
 * O token ja passou da validade?
 *
 * Uma folga de 30s evita o caso de borda de expirar entre a checagem e a
 * requisicao. Token sem `exp` e tratado como valido: quem decide e o servidor.
 */
export function tokenExpirado(token: string | null | undefined): boolean {
  if (!token) return true;
  const claims = decodeJwt<{ exp?: number }>(token);
  if (!claims?.exp) return false;
  return claims.exp * 1000 <= Date.now() + 30_000;
}

/**
 * A falha veio do servidor recusando a credencial, ou foi problema de rede?
 *
 * Só a primeira justifica derrubar a sessao. 500, 502, 503 e erro de conexao
 * dizem que o backend esta indisponivel — nao que o usuario perdeu o acesso.
 */
export function credencialRecusada(erro: unknown): boolean {
  const status = (erro as { status?: number })?.status;
  if (typeof status === 'number') return status === 401 || status === 403;

  const mensagem = String((erro as Error)?.message || '');
  return /\b401\b|\b403\b/.test(mensagem);
}

/** Ultima resposta boa do servidor, para reabrir sem esperar a rede. */
export function salvarSessao(chave: string, payload: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify({ salvoEm: Date.now(), payload }));
  } catch (_error) {
    // Cota cheia ou modo privado: seguir sem cache e so um pouco mais lento.
  }
}

export function lerSessao<T>(chave: string): T | null {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return null;
    const dados = JSON.parse(bruto);
    return (dados?.payload as T) ?? null;
  } catch (_error) {
    return null;
  }
}

export function limparSessao(chave: string) {
  try {
    localStorage.removeItem(chave);
  } catch (_error) {
    // Nada a fazer: o token ja foi removido junto.
  }
}
