import { Request, Response, NextFunction } from 'express';
import { isProduction } from '../config/secrets';

/**
 * Protecoes de borda que o servidor nao tinha.
 *
 * Escrito sem dependencia nova de proposito: o servico ja esta no ar e o
 * `node_modules` de producao esta fechado. Sao poucas linhas e evitam um
 * deploy de biblioteca so para ligar isso.
 */

/**
 * Cabecalhos que o helmet colocaria. Como aqui e uma API que responde JSON,
 * ficam de fora as diretivas que so fazem sentido para HTML (CSP, por exemplo).
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  // O Express anuncia a versao do framework por padrao; nao ha motivo.
  res.removeHeader('X-Powered-By');

  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  next();
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Faxina periodica: sem ela o Map cresce com a lista de todo IP que ja passou.
const CLEANUP_MS = 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, CLEANUP_MS).unref();

const clientKey = (req: Request) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return req.ip || forwarded || req.socket.remoteAddress || 'desconhecido';
};

/**
 * Janela fixa em memoria.
 *
 * Vale a ressalva: o estado vive no processo. Com mais de uma instancia, cada
 * uma conta a sua parte e o limite efetivo e o dobro. Continua resolvendo o
 * problema real — forca bruta em cima do login —, mas se o backend for
 * escalado horizontalmente o certo passa a ser um contador compartilhado.
 */
export const rateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
  /** Diferencia buckets quando o mesmo IP bate em rotas distintas. */
  scope: string;
}) => {
  const { windowMs, max, scope } = options;
  const message = options.message || 'Muitas tentativas. Aguarde um momento e tente de novo.';

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${scope}:${clientKey(req)}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Remaining', String(max - 1));
      next();
      return;
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.status(429).json({ error: message });
      return;
    }

    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    next();
  };
};

/**
 * Limite dos endpoints de autenticacao.
 *
 * Generoso o bastante para nao atrapalhar quem erra a senha algumas vezes,
 * apertado o bastante para inviabilizar varredura de senha — ainda mais agora
 * que o e-mail do super admin nao esta mais publico no repositorio.
 */
export const loginRateLimit = rateLimit({
  windowMs: Math.max(60_000, Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60_000)),
  max: Math.max(3, Number(process.env.LOGIN_RATE_LIMIT_MAX || 10)),
  scope: 'login',
  message: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
});

/** Teto geral da API, bem acima do uso normal: pega abuso, nao usuario. */
export const apiRateLimit = rateLimit({
  windowMs: Math.max(60_000, Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60_000)),
  max: Math.max(60, Number(process.env.API_RATE_LIMIT_MAX || 600)),
  scope: 'api',
});
