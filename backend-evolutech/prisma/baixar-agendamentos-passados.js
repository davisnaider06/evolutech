/**
 * Da baixa (status "concluido") em agendamentos que ja passaram e ficaram
 * como pendente/confirmado. Sem a baixa, a comissao e a "ultima visita" do
 * cliente ficam erradas e a avaliacao nunca e pedida.
 *
 * Reproduz o que a tela faz ao concluir (company.service.ts): status
 * "concluido", Customer.lastVisitAt e barbeiro de referencia se o cliente
 * ainda nao tem. NAO dispara push de avaliacao: o atendimento e antigo.
 *
 * Por padrao so lista (dry-run). Uso:
 *   node prisma/baixar-agendamentos-passados.js [arquivo.env] [--apply]
 *        [--dias=1] [--empresa=<slug>] [--prod]
 *
 *   --dias=N     so agendamentos com mais de N dias (padrao 1: nao mexe em hoje)
 *   --empresa    restringe a uma empresa pelo slug
 *   --prod       exigido para aplicar em banco que nao seja o de homologacao
 *
 * Idempotente: rodar de novo nao encontra mais nada para baixar.
 */
const path = require('path');
const args = process.argv.slice(2);
const arquivoEnv = args.find((a) => !a.startsWith('--')) || '.env';
require('dotenv').config({ path: path.resolve(arquivoEnv) });

const HOST_DEV = 'ep-bitter-lab-b4v4w6sc';
const APLICAR = args.includes('--apply');
const PROD = args.includes('--prod');
const opcao = (nome) => (args.find((a) => a.startsWith(`--${nome}=`)) || '').split('=')[1];
const DIAS = Number(opcao('dias') ?? 1);
const SLUG = opcao('empresa');
// Horario sempre no fuso da barbearia (o banco guarda UTC).
const TZ = process.env.TZ_BARBEARIA || 'America/Sao_Paulo';
const emBrasilia = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(d);
const PENDENTES = ['scheduled', 'pendente', 'pending', 'confirmado', 'confirmed'];

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const host = (url.match(/@([^/?]+)/) || [])[1] || '';
if (!host) { console.error('Sem DIRECT_URL/DATABASE_URL em', arquivoEnv); process.exit(1); }
if (APLICAR && !host.includes(HOST_DEV) && !PROD) {
  console.error(`Host ${host} nao e o de homologacao. Para aplicar fora dele, passe --prod.`);
  process.exit(1);
}
if (!Number.isFinite(DIAS) || DIAS < 0) { console.error('--dias invalido'); process.exit(1); }
process.env.DATABASE_URL = url;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function acordarBanco() {
  for (let i = 1; i <= 8; i += 1) {
    try { await prisma.$queryRawUnsafe('SELECT 1'); return; } catch {
      console.log(`acordando banco, tentativa ${i}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error('nao consegui conectar no banco');
}

async function main() {
  console.log('Banco:', host, APLICAR ? '(APLICANDO)' : '(dry-run: nao altera nada)');
  await acordarBanco();

  const limite = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000);
  const empresa = SLUG ? await prisma.company.findUnique({ where: { slug: SLUG } }) : null;
  if (SLUG && !empresa) throw new Error(`Empresa ${SLUG} nao encontrada`);

  const lista = await prisma.appointment.findMany({
    where: {
      scheduledAt: { lt: limite },
      ...(empresa ? { companyId: empresa.id } : {}),
      OR: PENDENTES.map((s) => ({ status: { equals: s, mode: 'insensitive' } })),
    },
    include: { company: { select: { name: true } } },
    orderBy: { scheduledAt: 'asc' },
  });

  console.log(`\nAntes de ${emBrasilia(limite)} (Brasilia), sem baixa: ${lista.length}`);
  for (const a of lista) {
    const dia = emBrasilia(a.scheduledAt);
    console.log(`  ${dia}  ${a.company.name}  ${a.status.padEnd(10)}  ${a.serviceName} / ${a.professionalName || a.barber_name || 'sem barbeiro'} / ${a.customerName || 'sem cadastro'}`);
  }

  if (!APLICAR) {
    console.log('\nDry-run: nada foi alterado. Rode de novo com --apply.');
    return;
  }
  if (lista.length === 0) return;

  // Ultimo atendimento de cada cliente entre os que estao sendo baixados.
  const porCliente = new Map();
  for (const a of lista) {
    if (!a.customerId) continue;
    const atual = porCliente.get(a.customerId);
    if (!atual || a.scheduledAt > atual.scheduledAt) porCliente.set(a.customerId, a);
  }

  await prisma.$transaction(async (tx) => {
    await tx.appointment.updateMany({
      where: { id: { in: lista.map((a) => a.id) } },
      data: { status: 'concluido' },
    });
    for (const [customerId, a] of porCliente) {
      const cliente = await tx.customer.findUnique({
        where: { id: customerId },
        select: { lastVisitAt: true, preferredProfessionalId: true },
      });
      if (!cliente) continue;
      const data = {};
      if (!cliente.lastVisitAt || cliente.lastVisitAt < a.scheduledAt) data.lastVisitAt = a.scheduledAt;
      if (!cliente.preferredProfessionalId && a.professionalId) data.preferredProfessionalId = a.professionalId;
      if (Object.keys(data).length > 0) await tx.customer.update({ where: { id: customerId }, data });
    }
  }, { timeout: 60000 });

  console.log(`\nBaixa dada em ${lista.length} agendamentos; ${porCliente.size} clientes com ultima visita conferida.`);
}

main()
  .catch((e) => { console.error('FALHOU:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
