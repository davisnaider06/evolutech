import { useEffect, useState } from 'react';
import { Loader2, WifiOff } from 'lucide-react';
import { EVENTO_REDE } from '@/lib/rede';

/**
 * Faixa no topo quando a conexao atrapalha.
 *
 * - Sem internet: o celular saiu do ar (metro, elevador, wi-fi da barbearia).
 * - Servidor lento: alguma chamada passou de 4 s. Quase sempre e o backend
 *   acordando; sem aviso, a pessoa achava que o app tinha travado e tocava de
 *   novo no botao.
 *
 * Fica em cima de tudo e nao bloqueia toque: so informa.
 */
export function AvisoDeConexao() {
  const [offline, setOffline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine === false : false
  );
  const [lento, setLento] = useState(false);

  useEffect(() => {
    const ficouOffline = () => setOffline(true);
    const voltou = () => setOffline(false);
    const aoMudarRede = (evento: Event) => setLento((evento as CustomEvent).detail?.estado === 'lento');
    window.addEventListener('offline', ficouOffline);
    window.addEventListener('online', voltou);
    window.addEventListener(EVENTO_REDE, aoMudarRede);
    return () => {
      window.removeEventListener('offline', ficouOffline);
      window.removeEventListener('online', voltou);
      window.removeEventListener(EVENTO_REDE, aoMudarRede);
    };
  }, []);

  if (!offline && !lento) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[max(env(safe-area-inset-top),8px)]"
    >
      <div className="flex items-center gap-2 rounded-full bg-neutral-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg">
        {offline ? (
          <>
            <WifiOff className="h-4 w-4" aria-hidden="true" />
            Sem internet. O que você fizer agora não será salvo.
          </>
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Conectando ao servidor, pode levar alguns segundos…
          </>
        )}
      </div>
    </div>
  );
}
