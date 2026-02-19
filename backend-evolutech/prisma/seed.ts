import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Na versão 6, ele lê o .env automaticamente sem precisar de configs extras
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando Seed (Prisma v6)...");

  const email = 'admin@evolutech.com';
  const passwordHash = await bcrypt.hash('adm2026', 10);

  // Upsert do Usuário
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      fullName: 'Super Admin',
      isActive: true,
    },
    create: {
      email,
      fullName: 'Super Admin',
      passwordHash,
      isActive: true,
      // Cria a role junto se for usuário novo
      roles: {
        create: {
          role: 'SUPER_ADMIN_EVOLUTECH'
        }
      }
    },
  });

  console.log(`👤 Usuário garantido: ${user.email}`);

  // Garante a Role (caso o usuário já existisse sem role)
  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, role: 'SUPER_ADMIN_EVOLUTECH' }
  });

  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        role: 'SUPER_ADMIN_EVOLUTECH'
      }
    });
    console.log("👑 Role adicionada!");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("✅ Seed concluído!");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });