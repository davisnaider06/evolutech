import { lazy, type ComponentType } from 'react';

/**
 * `lazy()` que lembra como baixar a tela, para dar para baixar antes de abrir.
 *
 * As telas viraram lazy para o JS inicial cair de 2,28 MB para 407 KB. O
 * custo era cada primeira visita a uma tela esperar o download do codigo dela
 * (com o app inteiro trocado por um spinner). Com `precarregarTelas`, o
 * layout logado baixa o resto em segundo plano, quando o navegador esta
 * ocioso: o login continua leve e a navegacao fica instantanea.
 */
type Fabrica = () => Promise<{ default: ComponentType<any> }>;

const fabricas: Fabrica[] = [];

export function lazyTela(fabrica: Fabrica) {
  fabricas.push(fabrica);
  return lazy(fabrica);
}

let jaPrecarregou = false;

/** Baixa o codigo de todas as telas, aos poucos e so com o navegador ocioso. */
export function precarregarTelas() {
  if (jaPrecarregou) return;
  jaPrecarregou = true;

  // Quem esta no 3G ou pediu economia de dados nao paga por telas que talvez
  // nem abra.
  const conexao = (navigator as any).connection;
  if (conexao?.saveData || /2g/.test(conexao?.effectiveType || '')) return;

  const ocioso: (cb: () => void) => void =
    (window as any).requestIdleCallback
      ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 3000 })
      : (cb) => window.setTimeout(cb, 1200);

  const fila = [...fabricas];
  const proxima = () => {
    const fabrica = fila.shift();
    if (!fabrica) return;
    fabrica()
      .catch(() => undefined) // falhou agora, baixa quando abrir a tela
      .finally(() => ocioso(proxima));
  };
  ocioso(proxima);
}
