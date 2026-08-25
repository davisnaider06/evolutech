/**
 * Aplicador de migrations resiliente ao Neon.
 *
 * Por que existe: o endpoint deste projeto derruba a conexao em queries que
 * passam de poucos segundos, e o `prisma migrate deploy` executa cada migration
 * como um bloco unico e longo — cai sempre no meio (P1017).
 *
 * Este script faz o mesmo trabalho, mas: le cada migration.sql em ordem, quebra
 * em statements individuais (respeitando blocos $$ ... $$), executa um a um e
 * reconecta quando a conexao cai. Ao final registra a migration em
 * `_prisma_migrations` com o checksum que o Prisma espera, para que
 * `prisma migrate status` continue coerente daqui pra frente.
 *
 * Uso: node prisma/apply-migrations.js
 */
require('dotenv/config');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const CONNECTION_STRING = process.env.DIRECT_URL || process.env.DATABASE_URL;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect() {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
      // Sem timeout de statement do lado do cliente: quem corta e o servidor.
      statement_timeout: 0,
    });
    try {
      await client.connect();
      return client;
    } catch (error) {
      await client.end().catch(() => {});
      if (attempt === 8) throw error;
      await sleep(3000);
    }
  }
  throw new Error('nao foi possivel conectar');
}

/**
 * Quebra o SQL em statements.
 * Precisa respeitar dollar-quoting ($$ ... $$), senao os blocos DO da migration
 * de barbearia seriam cortados nos ";" internos e o SQL sairia invalido.
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let dollarTag = null;
  let inLineComment = false;
  let inString = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const rest = sql.slice(i);

    if (inLineComment) {
      current += char;
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (!dollarTag && !inString && rest.startsWith('--')) {
      inLineComment = true;
      current += char;
      continue;
    }

    if (!dollarTag && char === "'") {
      inString = !inString;
      current += char;
      continue;
    }

    if (!inString) {
      const dollarMatch = rest.match(/^\$([A-Za-z_]*)\$/);
      if (dollarMatch) {
        const tag = dollarMatch[0];
        if (!dollarTag) {
          dollarTag = tag;
        } else if (dollarTag === tag) {
          dollarTag = null;
        }
        current += tag;
        i += tag.length - 1;
        continue;
      }
    }

    if (char === ';' && !dollarTag && !inString) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function runStatement(clientRef, statement) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await clientRef.client.query(statement);
      return;
    } catch (error) {
      const message = String(error.message || '');
      const conexaoCaiu =
        message.includes('Connection terminated') ||
        message.includes('terminating connection') ||
        message.includes('server closed') ||
        message.includes('Client has encountered a connection error') ||
        error.code === 'ECONNRESET' ||
        error.code === '57P01';

      if (!conexaoCaiu) throw error;
      if (attempt === 5) throw error;

      // Reconecta e tenta de novo o mesmo statement.
      await clientRef.client.end().catch(() => {});
      await sleep(2000);
      clientRef.client = await connect();
    }
  }
}

async function ensureMigrationsTable(clientRef) {
  await runStatement(
    clientRef,
    `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
       id VARCHAR(36) PRIMARY KEY NOT NULL,
       checksum VARCHAR(64) NOT NULL,
       finished_at TIMESTAMPTZ,
       migration_name VARCHAR(255) NOT NULL,
       logs TEXT,
       rolled_back_at TIMESTAMPTZ,
       started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       applied_steps_count INTEGER NOT NULL DEFAULT 0
     )`
  );
}

async function main() {
  if (!CONNECTION_STRING) {
    throw new Error('DIRECT_URL/DATABASE_URL nao definidas no .env');
  }

  const clientRef = { client: await connect() };
  console.log('conectado ao banco');

  await ensureMigrationsTable(clientRef);

  const aplicadas = new Set(
    (
      await clientRef.client.query(
        `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`
      )
    ).rows.map((row) => row.migration_name)
  );

  const pastas = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((nome) => fs.statSync(path.join(MIGRATIONS_DIR, nome)).isDirectory())
    .sort();

  let totalAplicadas = 0;

  for (const pasta of pastas) {
    if (aplicadas.has(pasta)) {
      console.log(`- ${pasta}: ja aplicada, pulando`);
      continue;
    }

    const arquivo = path.join(MIGRATIONS_DIR, pasta, 'migration.sql');
    if (!fs.existsSync(arquivo)) continue;

    const sql = fs.readFileSync(arquivo, 'utf8');
    const checksum = crypto.createHash('sha256').update(sql, 'utf8').digest('hex');
    const statements = splitStatements(sql);

    process.stdout.write(`- ${pasta}: ${statements.length} statements ... `);

    // Limpa registro incompleto de uma tentativa anterior que falhou no meio.
    await runStatement(
      clientRef,
      `DELETE FROM "_prisma_migrations" WHERE migration_name = '${pasta}'`
    );

    let executados = 0;
    for (const statement of statements) {
      await runStatement(clientRef, statement);
      executados += 1;
    }

    const id = crypto.randomUUID();
    await clientRef.client.query(
      `INSERT INTO "_prisma_migrations"
         (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES ($1, $2, now(), $3, NULL, NULL, now(), $4)`,
      [id, checksum, pasta, executados]
    );

    console.log('ok');
    totalAplicadas += 1;
  }

  await clientRef.client.end().catch(() => {});
  console.log(`\nconcluido: ${totalAplicadas} migrations aplicadas, ${aplicadas.size} ja estavam.`);
}

main().catch((error) => {
  console.error('\nFALHOU:', error.message);
  process.exit(1);
});
