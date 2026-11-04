/**
 * Toda chamada a API passa por aqui.
 *
 * Existe por tres motivos que a tela sozinha nao resolvia:
 *  - Tempo limite. O backend no Render dorme e leva ~30 s para acordar; sem
 *    limite, uma queda de rede deixava o carregamento girando para sempre.
 *  - Aviso de "servidor lento" e "sem internet" (ver AvisoDeConexao), para a
 *    pessoa saber que o app esta esperando, e nao travado.
 *  - Sessao vencida no meio do uso. Antes a tela so mostrava "Erro 401"; agora
 *    o contexto de login derruba a sessao e o guard leva para o login.
 */

export const EVENTO_REDE = 'ibarber:rede';
export const EVENTO_SESSAO_EXPIRADA = 'ibarber:sessao-expirada';

export type TipoSessao = 'equipe' | 'cliente';
export type EstadoRede = 'ok' | 'lento';

/** Acima disto a requisicao e considerada lenta e o aviso aparece. */
const LENTO_MS = 4000;
/** Cobre o Render acordando (~30 s) com folga. */
const TEMPO_LIMITE_MS = 45000;

let lentas = 0;

const anunciar = (estado: EstadoRede) => {
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_REDE, { detail: { estado } }));
  } catch (_erro) {
    // Ambiente sem window (testes): nada a avisar.
  }
};

export class ErroDeRede extends Error {
  status?: number;
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeRede';
  }
}

export async function requisitar(
  url: string,
  init: RequestInit = {},
  opcoes: { tempoLimiteMs?: number } = {}
): Promise<Response> {
  const controle = new AbortController();
  let estourou = false;
  const limite = setTimeout(() => {
    estourou = true;
    controle.abort();
  }, opcoes.tempoLimiteMs ?? TEMPO_LIMITE_MS);

  // Respeita um signal de quem chamou (ex.: tela que cancela ao desmontar).
  if (init.signal) {
    if (init.signal.aborted) controle.abort();
    else init.signal.addEventListener('abort', () => controle.abort(), { once: true });
  }

  let marcadaLenta = false;
  const lento = setTimeout(() => {
    marcadaLenta = true;
    lentas += 1;
    if (lentas === 1) anunciar('lento');
  }, LENTO_MS);

  try {
    return await fetch(url, { ...init, signal: controle.signal });
  } catch (erro: any) {
    if (estourou) {
      throw new ErroDeRede('O servidor demorou para responder. Tente de novo em instantes.');
    }
    if (erro?.name === 'AbortError') throw erro;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new ErroDeRede('Sem internet. Confira a conexão e tente de novo.');
    }
    throw new ErroDeRede('Não foi possível falar com o servidor. Tente de novo.');
  } finally {
    clearTimeout(limite);
    clearTimeout(lento);
    if (marcadaLenta) {
      lentas = Math.max(0, lentas - 1);
      if (lentas === 0) anunciar('ok');
    }
  }
}

/**
 * Token recusado pelo servidor no meio do uso. So conta quando havia um token:
 * sem token, o 401 e da propria tela de login.
 */
export function avisarSessaoExpirada(tipo: TipoSessao) {
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_SESSAO_EXPIRADA, { detail: { tipo } }));
  } catch (_erro) {
    // sem window
  }
}
