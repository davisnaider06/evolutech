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

/*
 * Cache curto de leituras (GET).
 *
 * Cada tela busca os proprios dados ao montar. Sem cache, ir do Painel para a
 * Agenda e voltar refazia todas as consultas (1-3 s cada com o Neon), e a tela
 * voltava a mostrar "..." para dados que tinham acabado de chegar. Com ele:
 *  - voltar a uma tela em ate CACHE_MS mostra os dados na hora;
 *  - duas partes da tela pedindo a mesma coisa ao mesmo tempo viram uma
 *    requisicao so.
 * Qualquer escrita (POST/PUT/PATCH/DELETE) limpa tudo, entao quem acabou de
 * salvar nunca ve o dado antigo. A chave inclui o token: outro usuario no
 * mesmo aparelho nao enxerga o cache do anterior. As atualizacoes automaticas
 * (60 s) passam do prazo e sempre vao ao servidor.
 */
const CACHE_MS = 20000;
const cacheLeituras = new Map<string, { em: number; resposta: Promise<Response> }>();

export function limparCacheDeLeituras() {
  cacheLeituras.clear();
}

export async function requisitar(
  url: string,
  init: RequestInit = {},
  opcoes: { tempoLimiteMs?: number } = {}
): Promise<Response> {
  const metodo = (init.method || 'GET').toUpperCase();
  if (metodo !== 'GET' || init.cache === 'no-store') {
    if (metodo !== 'GET') cacheLeituras.clear();
    return buscar(url, init, opcoes);
  }

  const chave = `${new Headers(init.headers).get('authorization') || ''} ${url}`;
  const guardada = cacheLeituras.get(chave);
  if (guardada && Date.now() - guardada.em < CACHE_MS) {
    try {
      return (await guardada.resposta).clone();
    } catch (_erro) {
      // a requisicao compartilhada falhou: tenta de novo abaixo
    }
  }

  const resposta = buscarComNovaTentativa(url, init, opcoes);
  // Com signal, quem chamou pode cancelar: nao divide essa requisicao com
  // ninguem enquanto ela esta no ar, so guarda depois que der certo.
  if (!init.signal) cacheLeituras.set(chave, { em: Date.now(), resposta });

  try {
    const final = await resposta;
    if (final.ok) {
      if (init.signal) cacheLeituras.set(chave, { em: Date.now(), resposta });
      return final.clone();
    }
    cacheLeituras.delete(chave);
    return final;
  } catch (erro) {
    cacheLeituras.delete(chave);
    throw erro;
  }
}

/*
 * Leitura que volta 500/502/503 tenta mais uma vez, depois de 1,5 s.
 *
 * O Neon desliga o banco quando fica parado e as primeiras consultas ao
 * acordar caem com 500 ("Server has closed the connection"). Sem isto o
 * Painel ficava com zeros ate a proxima atualizacao automatica (60 s). So
 * vale para GET, que pode repetir sem efeito colateral; escrita nunca e
 * repetida sozinha.
 */
const ESPERA_NOVA_TENTATIVA_MS = 1500;

async function buscarComNovaTentativa(
  url: string,
  init: RequestInit,
  opcoes: { tempoLimiteMs?: number }
): Promise<Response> {
  const primeira = await buscar(url, init, opcoes);
  if (![500, 502, 503].includes(primeira.status) || init.signal?.aborted) return primeira;
  await new Promise((pronto) => setTimeout(pronto, ESPERA_NOVA_TENTATIVA_MS));
  if (init.signal?.aborted) return primeira;
  return buscar(url, init, opcoes);
}

async function buscar(
  url: string,
  init: RequestInit,
  opcoes: { tempoLimiteMs?: number }
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
