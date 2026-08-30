/**
 * Ponto unico onde os segredos do sistema sao resolvidos.
 *
 * Antes cada arquivo fazia `process.env.JWT_SECRET || 'secret_fallback_dev'`.
 * O fallback esta publico no repositorio: quem o conhece assina o proprio
 * token e entra como qualquer usuario. Em desenvolvimento isso e comodo; em
 * producao e uma porta aberta.
 *
 * Aqui a regra passa a ser: em producao o servidor recusa subir sem o segredo.
 * Fora de producao o fallback continua valendo, com aviso no console.
 */

const isProduction = process.env.NODE_ENV === 'production';

class MissingSecretError extends Error {
  constructor(name: string) {
    super(
      `${name} nao esta definida. O servidor recusa subir em producao sem essa variavel: ` +
        `o fallback de desenvolvimento e publico e permitiria assinar tokens validos. ` +
        `Defina ${name} nas variaveis de ambiente do servico.`
    );
    this.name = 'MissingSecretError';
  }
}

function resolveSecret(name: string, devFallback: string): string {
  const value = String(process.env[name] || '').trim();
  if (value) return value;

  if (isProduction) {
    throw new MissingSecretError(name);
  }

  console.warn(
    `[secrets] ${name} ausente: usando fallback de desenvolvimento. NAO suba assim em producao.`
  );
  return devFallback;
}

/** Assina e valida os tokens de equipe e de cliente final. */
export const JWT_SECRET = resolveSecret('JWT_SECRET', 'secret_fallback_dev');

/**
 * Chave que criptografa as credenciais de gateway guardadas no banco.
 *
 * A cadeia de fallback para o JWT_SECRET e intencional e NAO pode ser removida:
 * empresas que conectaram o gateway antes de PAYMENT_KEYS_ENCRYPTION_SECRET
 * existir tiveram as credenciais criptografadas com o JWT_SECRET. Trocar essa
 * ordem torna esses segredos ilegiveis e obriga cada empresa a reconectar o
 * gateway na mao.
 */
export function getPaymentEncryptionSecret(): string {
  const dedicated = String(process.env.PAYMENT_KEYS_ENCRYPTION_SECRET || '').trim();
  if (dedicated) return dedicated;
  return JWT_SECRET;
}

/**
 * Origens liberadas no CORS. Em producao, '*' junto de `credentials: true` e
 * recusado: e uma combinacao que o proprio navegador ja rejeita e que so
 * esconde um dominio mal configurado.
 */
export function resolveCorsOrigins(): string[] {
  const raw = String(process.env.CORS_ORIGIN || (isProduction ? '' : '*'));
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProduction && (origins.length === 0 || origins.includes('*'))) {
    throw new Error(
      'CORS_ORIGIN precisa listar os dominios do frontend em producao (separados por virgula). ' +
        "Liberar '*' com credenciais deixa qualquer site chamar a API em nome do usuario."
    );
  }

  return origins;
}

export { isProduction };
