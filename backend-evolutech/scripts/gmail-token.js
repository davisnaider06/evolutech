/**
 * Gera o GMAIL_REFRESH_TOKEN que o backend usa para mandar e-mail pela API do
 * Gmail (o Render free bloqueia SMTP). Roda uma vez, no seu computador.
 *
 * Uso (de dentro de backend-evolutech):
 *   node scripts/gmail-token.js <GMAIL_CLIENT_ID> <GMAIL_CLIENT_SECRET>
 *
 * Abre um link; entre com a conta que vai enviar (ibarber.app@gmail.com) e
 * autorize. O token aparece aqui no terminal. Ele so pede permissao de ENVIAR
 * e-mail (gmail.send): nao le a caixa de entrada.
 */
const http = require('http');
const crypto = require('crypto');

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error('Uso: node scripts/gmail-token.js <GMAIL_CLIENT_ID> <GMAIL_CLIENT_SECRET>');
  process.exit(1);
}

const PORTA = 53682;
const REDIRECT = `http://127.0.0.1:${PORTA}`;
const estado = crypto.randomBytes(16).toString('hex');

const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
url.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT,
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/gmail.send',
  access_type: 'offline',
  prompt: 'consent',
  state: estado,
}).toString();

const servidor = http.createServer(async (req, res) => {
  const params = new URL(req.url, REDIRECT).searchParams;
  if (!params.get('code') && !params.get('error')) {
    res.writeHead(404).end();
    return;
  }
  if (params.get('state') !== estado || params.get('error')) {
    res.end('Autorizacao cancelada ou invalida. Pode fechar esta aba.');
    console.error('Falhou:', params.get('error') || 'state nao confere');
    servidor.close();
    process.exitCode = 1;
    return;
  }
  try {
    const resposta = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: params.get('code'),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT,
        grant_type: 'authorization_code',
      }),
    });
    const dados = await resposta.json();
    if (!dados.refresh_token) throw new Error(JSON.stringify(dados));
    res.end('Pronto! Volte para o terminal. Pode fechar esta aba.');
    console.log('\nColoque no Render (Environment do servico evolutech):\n');
    console.log(`GMAIL_CLIENT_ID=${clientId}`);
    console.log('GMAIL_CLIENT_SECRET=<o mesmo que voce passou>');
    console.log(`GMAIL_REFRESH_TOKEN=${dados.refresh_token}`);
    console.log('GMAIL_SENDER=ibarber.app@gmail.com\n');
  } catch (erro) {
    res.end('Erro ao trocar o codigo. Veja o terminal.');
    console.error('Erro:', erro.message);
    process.exitCode = 1;
  } finally {
    servidor.close();
  }
});

servidor.listen(PORTA, '127.0.0.1', () => {
  console.log('Abra este link no navegador e entre com ibarber.app@gmail.com:\n');
  console.log(url.toString(), '\n');
});
