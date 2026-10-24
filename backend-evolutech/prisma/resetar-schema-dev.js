/**
 * Apaga TODO o schema public do banco apontado pelo .env e recria vazio.
 * Serve so para o ambiente de homologacao (dev): depois rode
 *   node prisma/apply-migrations.js
 *   node prisma/demo-barbearia.js
 *
 * TRAVA: so roda se DEV_HOST_PERMITIDO (parte do host do branch dev no Neon)
 * aparecer no host da DIRECT_URL, e nunca se aparecer HOST_PRODUCAO_BLOQUEADO.
 *
 * Uso: DEV_HOST_PERMITIDO=ep-xxxx HOST_PRODUCAO_BLOQUEADO=ep-yyyy \
 *        node prisma/resetar-schema-dev.js --confirmo
 */
require('dotenv/config');
const { Client } = require('pg');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const host = (url.match(/@([^/?]+)/) || [])[1] || '';
const permitido = process.env.DEV_HOST_PERMITIDO;
const bloqueado = process.env.HOST_PRODUCAO_BLOQUEADO;

async function main() {
  if (!permitido || !host.includes(permitido)) {
    throw new Error(`Host ${host || '(vazio)'} nao bate com DEV_HOST_PERMITIDO. Abortando.`);
  }
  if (bloqueado && host.includes(bloqueado)) {
    throw new Error(`Host ${host} e o de PRODUCAO. Abortando.`);
  }
  if (!process.argv.includes('--confirmo')) {
    throw new Error('Faltou --confirmo. Nada foi feito.');
  }

  let client;
  for (let i = 1; i <= 8; i += 1) {
    client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try { await client.connect(); break; } catch (e) {
      await client.end().catch(() => {});
      if (i === 8) throw e;
      console.log(`acordando banco, tentativa ${i}`);
      await sleep(5000);
    }
  }
  console.log('Conectado em', host);
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  console.log('Schema public recriado vazio.');
  await client.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
