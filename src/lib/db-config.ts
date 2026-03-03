/**
 * Database Configuration (Project Omni P2)
 *
 * Provides runtime detection of database provider (SQLite vs PostgreSQL)
 * and configuration helpers for provider-specific features.
 *
 * The DATABASE_URL environment variable determines which provider is active:
 * - Starts with "file:" → SQLite
 * - Starts with "postgresql://" or "postgres://" → PostgreSQL
 */

export type DatabaseProvider = 'sqlite' | 'postgresql';

/**
 * Detect the active database provider from DATABASE_URL
 */
export function detectDatabaseProvider(): DatabaseProvider {
  const url = process.env.DATABASE_URL || '';

  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return 'postgresql';
  }

  return 'sqlite';
}

/**
 * Check if the current database supports vector operations (pgvector)
 */
export function supportsVectorSearch(): boolean {
  return detectDatabaseProvider() === 'postgresql';
}

/**
 * Check if the current database supports JSON columns natively
 */
export function supportsNativeJson(): boolean {
  return detectDatabaseProvider() === 'postgresql';
}

/**
 * Check if the current database supports full-text search natively
 */
export function supportsFullTextSearch(): boolean {
  return detectDatabaseProvider() === 'postgresql';
}

/**
 * Get database-specific configuration for Prisma
 */
export function getDatabaseConfig(): {
  provider: DatabaseProvider;
  features: {
    vectorSearch: boolean;
    nativeJson: boolean;
    fullTextSearch: boolean;
    eventOutbox: boolean;
    embeddings: boolean;
  };
  connectionPool: {
    maxConnections: number;
    idleTimeout: number;
  };
} {
  const provider = detectDatabaseProvider();
  const isPostgres = provider === 'postgresql';

  return {
    provider,
    features: {
      vectorSearch: isPostgres,
      nativeJson: isPostgres,
      fullTextSearch: isPostgres,
      eventOutbox: isPostgres,
      embeddings: isPostgres,
    },
    connectionPool: isPostgres
      ? { maxConnections: 20, idleTimeout: 300 }
      : { maxConnections: 1, idleTimeout: 0 },
  };
}

/**
 * Log the active database configuration (call during startup)
 */
export function logDatabaseConfig(): void {
  const config = getDatabaseConfig();
  console.log(`[Database] Provider: ${config.provider}`);
  console.log(`[Database] Features: vector=${config.features.vectorSearch}, json=${config.features.nativeJson}, fts=${config.features.fullTextSearch}`);
  console.log(`[Database] Pool: max=${config.connectionPool.maxConnections}, idle=${config.connectionPool.idleTimeout}s`);
}
