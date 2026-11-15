import { API_URL } from '@/config/api';

/**
 * Velocidade real de quem usa o app (melhoria 30, RUM), sem biblioteca.
 *
 * Mede no aparelho da pessoa e manda uma vez, quando a aba some
 * (visibilitychange -> hidden), para POST /api/public/vitals:
 *  - LCP: quando o maior elemento da tela apareceu;
 *  - CLS: quanto a tela "pulou" (soma dos deslocamentos sem toque antes);
 *  - INP: aproximado pela interacao mais lenta da visita (o INP oficial usa
 *    o percentil 98, que so difere em visitas com mais de 50 interacoes);
 *  - FCP e TTFB: primeiro conteudo pintado e primeiro byte do HTML.
 *
 * Vai como text/plain via sendBeacon: nao exige preflight de CORS e o
 * navegador entrega mesmo com a aba fechando. So o caminho da tela (sem
 * query string, que pode ter token) e o tipo de conexao acompanham.
 */
export function medirVelocidade() {
  if (typeof PerformanceObserver === 'undefined' || typeof navigator.sendBeacon !== 'function') return;

  const medidas: Record<string, number> = {};
  const observar = (tipo: string, ler: (entradas: PerformanceEntry[]) => void, extra: Record<string, unknown> = {}) => {
    try {
      const observador = new PerformanceObserver((lista) => ler(lista.getEntries()));
      observador.observe({ type: tipo, buffered: true, ...extra } as PerformanceObserverInit);
    } catch (_erro) {
      // navegador sem esse tipo de medida: segue sem ela
    }
  };

  observar('largest-contentful-paint', (entradas) => {
    const ultima = entradas[entradas.length - 1];
    if (ultima) medidas.lcp = ultima.startTime;
  });
  observar('paint', (entradas) => {
    const fcp = entradas.find((entrada) => entrada.name === 'first-contentful-paint');
    if (fcp) medidas.fcp = fcp.startTime;
  });
  medidas.cls = 0;
  observar('layout-shift', (entradas) => {
    for (const entrada of entradas as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
      if (!entrada.hadRecentInput) medidas.cls += entrada.value;
    }
  });
  observar(
    'event',
    (entradas) => {
      for (const entrada of entradas as Array<PerformanceEntry & { interactionId?: number }>) {
        if (entrada.interactionId) medidas.inp = Math.max(medidas.inp || 0, entrada.duration);
      }
    },
    { durationThreshold: 40 },
  );

  const navegacao = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (navegacao) medidas.ttfb = navegacao.responseStart;

  let enviado = false;
  const enviar = () => {
    if (enviado || document.visibilityState !== 'hidden') return;
    enviado = true;
    const conexao = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
    const corpo = JSON.stringify({ ...medidas, caminho: location.pathname, conexao });
    try {
      navigator.sendBeacon(`${API_URL}/public/vitals`, new Blob([corpo], { type: 'text/plain' }));
    } catch (_erro) {
      // medir nunca pode atrapalhar o app
    }
  };
  document.addEventListener('visibilitychange', enviar);
}
