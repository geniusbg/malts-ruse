import { PrismaClient } from '@prisma/client';
import { validateDatabaseUrl } from './env-validation';

if (typeof window === 'undefined') {
  try {
    validateDatabaseUrl(process.env.DATABASE_URL);
  } catch (error) {
    console.error('❌ DATABASE_URL validation failed:', error);
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

globalForPrisma.prisma = prisma;

if (typeof process !== 'undefined' && !(globalThis as { __PRISMA_SHUTDOWN__?: boolean }).__PRISMA_SHUTDOWN__) {
  (globalThis as { __PRISMA_SHUTDOWN__?: boolean }).__PRISMA_SHUTDOWN__ = true;
  const disconnect = () => {
    void prisma.$disconnect().catch(() => {});
  };
  process.once('beforeExit', disconnect);
  process.once('SIGINT', disconnect);
  process.once('SIGTERM', disconnect);
}

export default prisma;
