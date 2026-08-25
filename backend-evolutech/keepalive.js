require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // Acorda e mantem vivo: o Neon suspende o endpoint por inatividade e
  // derruba a sessao de prints no meio.
  for (let i = 1; i <= 10; i++) {
    try { await p.$queryRawUnsafe('SELECT 1'); console.log('banco acordado'); break; }
    catch { console.log('acordando... tentativa', i); await new Promise(r => setTimeout(r, 3000)); }
  }
  setInterval(async () => {
    try { await p.$queryRawUnsafe('SELECT 1'); } catch (e) { console.log('ping falhou:', e.message.split('\n')[0]); }
  }, 25000);
})();
