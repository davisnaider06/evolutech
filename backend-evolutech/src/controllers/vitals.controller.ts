import { Request, Response } from 'express';

/**
 * Velocidade medida no aparelho de quem usa o app (melhoria 30, RUM).
 *
 * O front manda uma vez por visita, ao sair da tela, via sendBeacon com
 * text/plain (dispensa o preflight de CORS, que o application/json exigiria
 * entre o dominio da Vercel e o do Render). Nao grava em banco: vira uma
 * linha `[vitals]` no log, que da para filtrar no painel do Render. Nada
 * pessoal entra: so as metricas, o caminho da tela e o tipo de conexao.
 */

const METRICAS = ['lcp', 'cls', 'inp', 'ttfb', 'fcp'] as const;
const LIMITES: Record<(typeof METRICAS)[number], number> = {
  lcp: 120000,
  inp: 60000,
  ttfb: 120000,
  fcp: 120000,
  cls: 50,
};

const numeroValido = (valor: unknown, max: number) =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= max;

export class VitalsController {
  registrar(req: Request, res: Response) {
    let corpo: any = req.body;
    if (typeof corpo === 'string') {
      try {
        corpo = JSON.parse(corpo);
      } catch {
        return res.status(400).end();
      }
    }
    if (!corpo || typeof corpo !== 'object') return res.status(400).end();

    const partes: string[] = [];
    for (const nome of METRICAS) {
      if (numeroValido(corpo[nome], LIMITES[nome])) {
        const valor = corpo[nome] as number;
        partes.push(nome === 'cls' ? `CLS=${valor.toFixed(3)}` : `${nome.toUpperCase()}=${Math.round(valor)}ms`);
      }
    }
    if (partes.length === 0) return res.status(400).end();

    // Caminho e conexao sao texto livre do cliente: corta e limpa antes de logar.
    const caminho = String(corpo.caminho || '').replace(/[^\w\-/.:]/g, '').slice(0, 120) || '-';
    const conexao = String(corpo.conexao || '').replace(/[^\w-]/g, '').slice(0, 12) || '-';
    console.log(`[vitals] ${partes.join(' ')} caminho=${caminho} conexao=${conexao}`);
    return res.status(204).end();
  }
}
