// src/db.ts
import { Pool } from 'pg';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não definida no .env');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necessário para conectar no Neon em alguns ambientes
  }
});

// Teste de conexão simples
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Erro ao conectar no Neon:', err.stack);
  }
  client?.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      return console.error('Erro ao executar query de teste', err.stack);
    }
    console.log('📦 Conectado ao Neon com sucesso:', result.rows[0]);
  });
});