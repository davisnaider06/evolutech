require("dotenv/config");
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const [companies, customers, appts, subs, hist, adj] = await Promise.all([
    p.company.count(), p.customer.count(), p.appointment.count(),
    p.customerSubscription.count(), p.customerServiceHistoryEntry.count(),
    p.commissionAdjustment.count(),
  ]);
  console.log('empresas:', companies);
  console.log('clientes:', customers);
  console.log('agendamentos:', appts);
  console.log('assinaturas:', subs);
  console.log('historico de atendimento:', hist);
  console.log('ajustes de comissao:', adj);
  const cols = await p.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='customers' AND column_name IN ('preferred_professional_id','last_visit_at','deactivated_at')`);
  console.log('colunas novas ja existentes em customers:', cols.length);
  const tbl = await p.$queryRawUnsafe(`SELECT to_regclass('public.appointment_blocks') AS t`);
  console.log('tabela appointment_blocks existe?', tbl[0].t !== null);
  await p.$disconnect();
})().catch(async (e) => { console.error('ERRO:', e.message); process.exit(1); });
