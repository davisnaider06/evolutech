// src/db.ts
import { Pool } from 'pg';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL nÃ£o definida no .env');
}

const buildConnectionString = () => {
  const url = new URL(process.env.DATABASE_URL as string);

  // Evita conflito entre sslmode da URL e objeto ssl do client.
  url.searchParams.delete('sslmode');

  // Em alguns ambientes Node/TLS, channel_binding=require pode quebrar o handshake com pooler.
  url.searchParams.delete('channel_binding');

  return url.toString();
};

export const pool = new Pool({
  connectionString: buildConnectionString(),
  max: Number(process.env.DB_POOL_MAX || 5),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 15000),
  query_timeout: Number(process.env.DB_QUERY_TIMEOUT_MS || 20000),
  keepAlive: true,
  ssl: {
    rejectUnauthorized: false // NecessÃ¡rio para conectar no Neon em alguns ambientes
  }
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err);
});
pool.on('connect', () => {
  console.log('[DB] New client connected to pool');
});

// Teste de conexÃ£o simples
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Erro ao conectar no Neon:', err.stack);
  }
  client?.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      return console.error('Erro ao executar query de teste', err.stack);
    }
    console.log('ðŸ“¦ Conectado ao Neon com sucesso:', result.rows[0]);
  });
});

