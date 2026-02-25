import { PrismaClient } from '@prisma/client';

// Evita múltiplas instâncias em desenvolvimento (Hot Reload)
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const shouldLogQueries = process.env.PRISMA_LOG_QUERIES === 'true';

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: shouldLogQueries ? ['query', 'error', 'warn'] : ['error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
