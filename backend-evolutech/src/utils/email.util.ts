/**
 * Ponto unico de envio de e-mail.
 *
 * Provedor, nesta ordem:
 *  1. API do Gmail (HTTPS) — quando GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET e
 *     GMAIL_REFRESH_TOKEN existem. E o que funciona no Render free, que
 *     bloqueia as portas SMTP (25/465/587) desde set/2025. Entrega para
 *     qualquer endereco a partir da conta Gmail, ~500 e-mails/dia.
 *     O refresh token sai de `node scripts/gmail-token.js`.
 *  2. SMTP — quando SMTP_USER e SMTP_PASS existem. Serve para rodar local ou
 *     num plano pago do Render.
 *  3. Resend — quando so RESEND_API_KEY existe. Sem dominio verificado ele so
 *     entrega no e-mail do dono da conta Resend.
 *
 * Variaveis:
 *  GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN
 *  GMAIL_SENDER    conta remetente da API (padrao: SMTP_USER)
 *  SMTP_USER       conta remetente (ex.: ibarber.app@gmail.com)
 *  SMTP_PASS       senha de app do Google (16 letras), NAO a senha da conta
 *  SMTP_HOST       padrao smtp.gmail.com
 *  SMTP_PORT       padrao 465 (SSL)
 *  EMAIL_FROM_NAME nome que aparece como remetente, padrao "iBarber"
 *  SUPPORT_FROM_EMAIL remetente usado no Resend
 */
import nodemailer, { type Transporter } from 'nodemailer';

export type ResultadoEmail = { sent: boolean; skipped?: string; error?: string };

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const env = (nome: string) => String(process.env[nome] || '').trim();

let transportador: Transporter | null = null;
let chaveDoTransportador = '';

function smtp(): Transporter | null {
  const user = env('SMTP_USER');
  // A senha de app do Google e exibida com espacos ("abcd efgh ..."); tanto faz.
  const pass = env('SMTP_PASS').replace(/\s+/g, '');
  if (!user || !pass) return null;

  const host = env('SMTP_HOST') || 'smtp.gmail.com';
  const port = Number(env('SMTP_PORT') || 465);
  const chave = `${host}:${port}:${user}:${pass}`;
  if (transportador && chave === chaveDoTransportador) return transportador;

  transportador = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // Render free acorda devagar; sem isso um SMTP lento segura a requisicao.
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  chaveDoTransportador = chave;
  return transportador;
}

const temGmailApi = () => Boolean(env('GMAIL_CLIENT_ID') && env('GMAIL_CLIENT_SECRET') && env('GMAIL_REFRESH_TOKEN'));

let tokenDeAcesso: { valor: string; expiraEm: number } | null = null;

async function tokenDoGmail(): Promise<string> {
  if (tokenDeAcesso && tokenDeAcesso.expiraEm > Date.now() + 60_000) return tokenDeAcesso.valor;
  const resposta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GMAIL_CLIENT_ID'),
      client_secret: env('GMAIL_CLIENT_SECRET'),
      refresh_token: env('GMAIL_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(15000),
  });
  const dados: any = await resposta.json().catch(() => ({}));
  if (!resposta.ok || !dados.access_token) {
    // invalid_grant = token revogado/expirado: rodar scripts/gmail-token.js de novo.
    throw new Error(`Gmail recusou o token (${resposta.status} ${dados.error || ''})`.trim());
  }
  tokenDeAcesso = { valor: dados.access_token, expiraEm: Date.now() + Number(dados.expires_in || 3600) * 1000 };
  return tokenDeAcesso.valor;
}

/** Cabecalho com acento precisa ir codificado (RFC 2047). */
const cabecalhoUtf8 = (texto: string) => `=?UTF-8?B?${Buffer.from(texto, 'utf8').toString('base64')}?=`;

async function enviarPelaApiDoGmail(params: { to: string; subject: string; html: string; nome: string }) {
  const remetente = env('GMAIL_SENDER') || env('SMTP_USER');
  const corpo = Buffer.from(params.html, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
  const mensagem = [
    `From: ${cabecalhoUtf8(params.nome)} <${remetente}>`,
    `To: ${params.to}`,
    `Subject: ${cabecalhoUtf8(params.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    corpo,
  ].join('\r\n');

  const enviar = async (token: string) =>
    fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: Buffer.from(mensagem, 'utf8').toString('base64url') }),
      signal: AbortSignal.timeout(20000),
    });

  let resposta = await enviar(await tokenDoGmail());
  if (resposta.status === 401) {
    tokenDeAcesso = null;
    resposta = await enviar(await tokenDoGmail());
  }
  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(`Gmail recusou o envio (${resposta.status}) ${detalhe.slice(0, 200)}`);
  }
}

export function provedorDeEmail(): 'gmail' | 'smtp' | 'resend' | null {
  if (temGmailApi()) return 'gmail';
  if (env('SMTP_USER') && env('SMTP_PASS')) return 'smtp';
  if (env('RESEND_API_KEY')) return 'resend';
  return null;
}

/**
 * Envia um e-mail. Nunca lanca: quem chama (agendamento, cobranca, suporte)
 * segue adiante mesmo se o envio falhar, e o motivo fica no log.
 */
export async function enviarEmail(params: {
  to: string;
  subject: string;
  html: string;
  contexto: string;
}): Promise<ResultadoEmail> {
  const destino = String(params.to || '').trim();
  if (!destino || !destino.includes('@')) {
    console.info(`[email] ${params.contexto}: ignorado, destinatario sem e-mail valido`);
    return { sent: false, skipped: 'sem e-mail' };
  }

  const nome = env('EMAIL_FROM_NAME') || 'iBarber';

  try {
    if (temGmailApi()) {
      await enviarPelaApiDoGmail({ to: destino, subject: params.subject, html: params.html, nome });
      console.info(`[email] ${params.contexto}: enviado para ${destino} (gmail api)`);
      return { sent: true };
    }

    const transporte = smtp();
    if (transporte) {
      // O Gmail troca qualquer remetente pela propria conta; usar ela evita
      // cair no spam por remetente divergente.
      await transporte.sendMail({
        from: { name: nome, address: env('SMTP_USER') },
        to: destino,
        subject: params.subject,
        html: params.html,
      });
      console.info(`[email] ${params.contexto}: enviado para ${destino} (smtp)`);
      return { sent: true };
    }

    const apiKey = env('RESEND_API_KEY');
    if (!apiKey) {
      console.info(`[email] ${params.contexto}: ignorado, nenhum provedor configurado (SMTP_USER/SMTP_PASS ou RESEND_API_KEY)`);
      return { sent: false, skipped: 'sem provedor de e-mail' };
    }

    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env('SUPPORT_FROM_EMAIL') || `${nome} <onboarding@resend.dev>`,
        to: [destino],
        subject: params.subject,
        html: params.html,
      }),
    });
    if (!response.ok) {
      const detalhe = await response.text().catch(() => '');
      console.error(`[email] ${params.contexto}: provedor recusou (${response.status}) ${detalhe.slice(0, 200)}`);
      return { sent: false, error: `HTTP ${response.status}` };
    }
    console.info(`[email] ${params.contexto}: enviado para ${destino} (resend)`);
    return { sent: true };
  } catch (error: any) {
    console.error(`[email] ${params.contexto}: falhou -`, error?.message);
    return { sent: false, error: String(error?.message || 'erro desconhecido') };
  }
}
