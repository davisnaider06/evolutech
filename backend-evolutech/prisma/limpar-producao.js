/**
 * Deixa o banco de PRODUCAO so com os dados do Felipe Barber.
 *
 * Por padrao NAO apaga nada: lista o que sairia (dry-run). Para apagar:
 *   node prisma/limpar-producao.js .env.prod --apply
 *
 * O que sai: toda empresa cujo slug nao seja o MANTER_SLUG (cascade leva
 * agenda, clientes, caixa, etc. dela) e os usuarios que so tinham vinculo com
 * essas empresas. Quem tem vinculo com outra empresa (ou papel global, como o
 * super admin) NUNCA e apagado. Catalogo (modulos, sistema base) fica.
 *
 * TRAVAS: o host da conexao precisa conter HOST_PRODUCAO e a empresa mantida
 * precisa existir. Sem --apply, o script so le.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(process.argv[2] || '.env.prod') });

const HOST_PRODUCAO = 'ep-nameless-bird-aivtbm6o';
const MANTER_SLUG = 'felipe-barber';
const APLICAR = process.argv.includes('--apply');

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const host = (url.match(/@([^/?]+)/) || [])[1] || '';
if (!host.includes(HOST_PRODUCAO)) {
  console.error(`Host ${host || '(vazio)'} nao e o de producao esperado. Abortando.`);
  process.exit(1);
}
// O Prisma le DATABASE_URL; usa a conexao direta, que aguenta o script inteiro.
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
  console.log('Banco:', host, APLICAR ? '(MODO APLICAR)' : '(dry-run: nao apaga nada)');
  await acordarBanco();

  const manter = await prisma.company.findUnique({ where: { slug: MANTER_SLUG } });
  if (!manter) throw new Error(`Empresa a manter (${MANTER_SLUG}) nao encontrada. Abortando.`);

  const sair = await prisma.company.findMany({ where: { slug: { not: MANTER_SLUG } } });
  console.log(`\nMANTER: ${manter.name} (${manter.slug})`);
  if (sair.length === 0) {
    console.log('Nenhuma outra empresa. Nada a fazer.');
    return;
  }

  const idsSair = sair.map((c) => c.id);
  const vinculos = await prisma.userRole.findMany({
    where: { companyId: { in: idsSair } },
    include: { user: { select: { id: true, email: true } } },
  });
  const userIds = [...new Set(vinculos.map((v) => v.userId))];
  const outrosVinculos = await prisma.userRole.findMany({
    where: { userId: { in: userIds }, OR: [{ companyId: null }, { companyId: { notIn: idsSair } }] },
    select: { userId: true },
  });
  const protegidos = new Set(outrosVinculos.map((v) => v.userId));
  const usuariosApagar = vinculos.filter((v) => !protegidos.has(v.userId));

  console.log('\nSAIRIAM:');
  for (const c of sair) {
    const [agend, clientes, pedidos, caixa] = await Promise.all([
      prisma.appointment.count({ where: { companyId: c.id } }),
      prisma.customer.count({ where: { companyId: c.id } }),
      prisma.order.count({ where: { companyId: c.id } }),
      prisma.cashTransaction.count({ where: { companyId: c.id } }),
    ]);
    console.log(`  - ${c.name} (${c.slug}): ${agend} agendamentos, ${clientes} clientes, ${pedidos} pedidos, ${caixa} lancamentos de caixa`);
  }
  console.log('\nUSUARIOS que seriam apagados (so tinham vinculo com essas empresas):');
  [...new Map(usuariosApagar.map((v) => [v.userId, v.user.email])).values()].forEach((e) => console.log('  -', e));
  const preservados = userIds.filter((id) => protegidos.has(id));
  console.log(`\nUsuarios preservados por terem outro vinculo (ex.: super admin): ${preservados.length}`);

  if (!APLICAR) {
    console.log('\nDry-run: nada foi apagado. Para aplicar, rode de novo com --apply.');
    return;
  }

  for (const c of sair) {
    await prisma.$executeRawUnsafe(`DELETE FROM "employee_module_permissions" WHERE "empresa_id" = $1`, c.id);
    await prisma.company.delete({ where: { id: c.id } });
    console.log(`Empresa removida: ${c.name}`);
  }
  const apagar = usuariosApagar.map((v) => v.userId);
  if (apagar.length > 0) {
    const r = await prisma.user.deleteMany({ where: { id: { in: [...new Set(apagar)] }, roles: { none: {} } } });
    console.log(`Usuarios removidos: ${r.count}`);
  }
  console.log('Pronto. Rode: node prisma/conferir-banco.js .env.prod');
}

main()
  .catch((e) => { console.error('FALHOU:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
