import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    // Enable query optimization features
    // Note: SQLite doesn't support connection pooling like PostgreSQL,
    // but these settings optimize query execution and connection reuse
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Graceful shutdown for Prisma
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await globalForPrisma.prisma?.$disconnect()
  })
}

/**
 * Execute a database transaction with automatic retry on deadlock
 * Useful for high-concurrency scenarios
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      // Only retry on transaction errors (like database is locked in SQLite)
      const isRetryable = lastError.message.includes('database is locked') ||
                         lastError.message.includes('SQLITE_BUSY');

      if (!isRetryable || attempt === maxRetries - 1) {
        throw lastError;
      }

      // Exponential backoff: 100ms, 200ms, 400ms
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
    }
  }

  throw lastError!;
}