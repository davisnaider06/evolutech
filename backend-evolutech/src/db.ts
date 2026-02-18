import { PrismaClient } from '@prisma/client';

// Evita múltiplas instâncias em desenvolvimento (Hot Reload)
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['query', 'error', 'warn'], // Útil para debugar
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;