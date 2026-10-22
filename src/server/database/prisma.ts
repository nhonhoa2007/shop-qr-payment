if (typeof window !== 'undefined') {
  throw new Error('This module is server-only and cannot be executed on the client');
}

// Fallback an toàn cho local dev khi chưa cấu hình file .env
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.NODE_ENV === 'test'
      ? 'postgresql://postgres:postgres@localhost:5432/shop_qr_test?schema=public'
      : 'postgresql://postgres:postgres@localhost:5432/shopqr?schema=public';
}

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
