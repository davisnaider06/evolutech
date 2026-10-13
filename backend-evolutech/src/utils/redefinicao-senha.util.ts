import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, resolveCorsOrigins } from '../config/secrets';

/**
 * Link de "criar nova senha", sem tabela nova no banco.
 *
 * O token e um JWT assinado com uma chave derivada so para isso: assinado
 * com o JWT_SECRET puro, ele passaria no middleware de login e serviria de
 * sessao. Dentro vai uma impressao do hash da senha atual — trocada a senha,
 * a impressao muda e o link para de valer. Por isso ele so funciona uma vez.
 */
export type TipoConta = 'equipe' | 'cliente';

const CHAVE = crypto.createHash('sha256').update(`${JWT_SECRET}:redefinir-senha`).digest('hex');

type Conteudo = { tipo: TipoConta; sub: string; v: string };

const impressaoDaSenha = (passwordHash: string | null | undefined) =>
  crypto.createHash('sha256').update(String(passwordHash || '')).digest('hex').slice(0, 16);

export function gerarTokenDeRedefinicao(
  tipo: TipoConta,
  contaId: string,
  passwordHash: string | null | undefined,
  validade: jwt.SignOptions['expiresIn']
) {
  const conteudo: Conteudo = { tipo, sub: contaId, v: impressaoDaSenha(passwordHash) };
  return jwt.sign(conteudo, CHAVE, { expiresIn: validade });
}

/** Devolve o id da conta, ou null se o link for invalido, vencido ou de outro tipo. */
export function lerTokenDeRedefinicao(token: string, tipo: TipoConta): string | null {
  try {
    const conteudo = jwt.verify(String(token || ''), CHAVE) as Conteudo;
    return conteudo?.tipo === tipo && conteudo.sub ? conteudo.sub : null;
  } catch {
    return null;
  }
}

/** Confere se o link ainda vale para a senha que esta gravada agora. */
export function tokenValeParaSenha(token: string, passwordHash: string | null | undefined) {
  const conteudo = jwt.decode(String(token || '')) as Conteudo | null;
  return Boolean(conteudo?.v) && conteudo!.v === impressaoDaSenha(passwordHash);
}

/**
 * Endereco do app para montar o link. Vem da configuracao, nunca do pedido:
 * se viesse do navegador, alguem pediria a redefinicao da conta de outra
 * pessoa apontando o link para um site dele e ficaria com o token.
 */
export function enderecoDoApp() {
  const configurado = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (configurado) return configurado;
  const origem = resolveCorsOrigins().find((item) => item !== '*');
  return origem || 'http://localhost:8080';
}

export const SENHA_MINIMA = 6;
