import { useEffect, useRef } from 'react';

/**
 * Recarrega os dados de uma tela sem a pessoa precisar puxar/atualizar.
 *
 * Antes a agenda do dono e do barbeiro so mudava ao recarregar a pagina: o
 * cliente marcava ou cancelava e quem estava com o app aberto nao via.
 *
 * Recarrega quando:
 *  - o app volta a aparecer (desbloqueou o celular, voltou de outro app);
 *  - a internet volta;
 *  - a cada `intervaloMs` enquanto a tela esta visivel (nada com o app em
 *    segundo plano, para nao gastar bateria e dados).
 *
 * Polling simples, e nao WebSocket, de proposito: o volume de uma barbearia e
 * de dezenas de mudancas por dia, o backend roda numa instancia que dorme, e
 * os avisos imediatos ja chegam por push. 60 s de atraso na tela aberta e
 * aceitavel para esse uso.
 */
export function useAtualizacaoAutomatica(
  recarregar: () => unknown,
  opcoes: { intervaloMs?: number; ativo?: boolean } = {}
) {
  const { intervaloMs = 60_000, ativo = true } = opcoes;
  const ref = useRef(recarregar);
  ref.current = recarregar;

  useEffect(() => {
    if (!ativo) return undefined;
    let ultima = Date.now();

    const executar = () => {
      // Evita rajada: voltar e sair do app varias vezes seguidas nao dispara
      // varias cargas.
      if (Date.now() - ultima < 5_000) return;
      ultima = Date.now();
      try {
        void ref.current();
      } catch (_erro) {
        // A tela trata o proprio erro; aqui so nao pode quebrar o timer.
      }
    };

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'visible') executar();
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') executar();
    }, intervaloMs);

    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    window.addEventListener('online', executar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      window.removeEventListener('online', executar);
    };
  }, [intervaloMs, ativo]);
}
