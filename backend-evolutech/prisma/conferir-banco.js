/**
 * Somente leitura: lista as empresas do banco e confere se existem a tabela de
 * avaliacoes e o historico de migrations do Prisma.
 *
 * Uso: node prisma/conferir-banco.js .env.prod
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(process.argv[2] || '.env') });
const { Client } = require('pg');

(async () => {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  console.log('host:', (url.match(/@([^/?]+)/) || [])[1]);
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  for (let i = 1; ; i += 1) {
    try { await c.connect(); break; } catch (e) {
      if (i === 6) throw e;
      console.log('acordando banco, tentativa', i);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  console.table((await c.query('select name, slug, created_at::date as criada from companies')).rows);
  const q = "select to_regclass('public.appointment_reviews')::text as avaliacoes, to_regclass('public._prisma_migrations')::text as historico";
  console.log((await c.query(q)).rows[0]);
  for (const t of ['appointments', 'customers', 'cash_transactions']) {
    console.log(t, (await c.query(`select count(*)::int as n from ${t}`)).rows[0].n);
  }
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
