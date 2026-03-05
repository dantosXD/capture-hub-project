/**
 * RAG Retrieval Engine (Project Omni P4)
 *
 * Semantic search over CaptureItem embeddings.
 * - PostgreSQL: Uses pgvector cosine similarity via raw SQL
 * - SQLite: Uses in-memory cosine similarity over cached embeddings
 *
 * Architecture:
 *   Query → embed query → find nearest neighbors → return ranked results
 */

import { generateEmbedding, getCachedEmbeddings } from './embedding-pipeline';
import { detectDatabaseProvider } from '@/lib/db-config';
import type { SemanticSearchResult } from './types';
import { Prisma } from '@prisma/client';
import { loggers } from '@/lib/logger';

// ============================================================================
// Cosine Similarity (in-memory, for SQLite fallback)
// ============================================================================

/**
 * Compute cosine similarity between two vectors.
 * Returns value between -1 and 1 (1 = identical direction).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

// ============================================================================
// Semantic Search
// ============================================================================

export interface SemanticSearchOptions {
  query: string;
  limit?: number;
  minScore?: number;
  excludeIds?: string[];
}

/**
 * Search for items semantically similar to the query.
 * Routes to PostgreSQL or in-memory search based on database provider.
 */
export async function semanticSearch(
  options: SemanticSearchOptions
): Promise<SemanticSearchResult[]> {
  const { query, limit = 10, minScore = 0.3, excludeIds = [] } = options;

  if (!query || query.trim().length === 0) return [];

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  const dbProvider = detectDatabaseProvider();

  if (dbProvider === 'postgresql') {
    return searchPostgres(queryEmbedding.vector, limit, minScore, excludeIds);
  }

  return searchInMemory(queryEmbedding.vector, limit, minScore, excludeIds);
}

/**
 * PostgreSQL semantic search using pgvector.
 */
async function searchPostgres(
  queryVector: number[],
  limit: number,
  minScore: number,
  excludeIds: string[]
): Promise<SemanticSearchResult[]> {
  try {
    const { db } = await import('@/lib/db');

    const vectorStr = `[${queryVector.join(',')}]`;

    let results: any[];

    if (excludeIds.length > 0) {
      results = await (db as any).$queryRaw(
        Prisma.sql`
          SELECT
            e."itemId" AS id,
            1 - (e."vector" <=> ${vectorStr}::vector) AS score,
            ci."title",
            LEFT(ci."content", 200) AS snippet
          FROM "Embedding" e
          JOIN "CaptureItem" ci ON ci."id" = e."itemId"
          WHERE 1 - (e."vector" <=> ${vectorStr}::vector) >= ${minScore}
            AND e."itemId" NOT IN (${Prisma.join(excludeIds)})
          ORDER BY e."vector" <=> ${vectorStr}::vector
          LIMIT ${limit}
        `
      );
    } else {
      results = await (db as any).$queryRaw(
        Prisma.sql`
          SELECT
            e."itemId" AS id,
            1 - (e."vector" <=> ${vectorStr}::vector) AS score,
            ci."title",
            LEFT(ci."content", 200) AS snippet
          FROM "Embedding" e
          JOIN "CaptureItem" ci ON ci."id" = e."itemId"
          WHERE 1 - (e."vector" <=> ${vectorStr}::vector) >= ${minScore}
          ORDER BY e."vector" <=> ${vectorStr}::vector
          LIMIT ${limit}
        `
      );
    }

    return results.map(r => ({
      id: r.id,
      score: Number(r.score),
      title: r.title,
      snippet: r.snippet || undefined,
    }));
  } catch (error) {
    loggers.ai.error('[RAG] PostgreSQL search failed, falling back to in-memory', error instanceof Error ? error : undefined);
    return searchInMemory(queryVector, limit, minScore, excludeIds);
  }
}

/**
 * In-memory semantic search over cached embeddings.
 */
function searchInMemory(
  queryVector: number[],
  limit: number,
  minScore: number,
  excludeIds: string[]
): SemanticSearchResult[] {
  const cache = getCachedEmbeddings();

  const scored: Array<{ itemId: string; score: number }> = [];

  for (const [itemId, embedding] of cache) {
    if (excludeIds.includes(itemId)) continue;

    const score = cosineSimilarity(queryVector, embedding.vector);
    if (score >= minScore) {
      scored.push({ itemId, score });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => ({
    id: s.itemId,
    score: s.score,
    title: '', // Caller must hydrate title from DB
    snippet: undefined,
  }));
}

// ============================================================================
// Find Similar Items
// ============================================================================

/**
 * Find items similar to a specific item by its embedding.
 */
export async function findSimilarItems(
  itemId: string,
  options?: { limit?: number; minScore?: number }
): Promise<SemanticSearchResult[]> {
  const { limit = 5, minScore = 0.5 } = options || {};

  // Get the item's embedding
  const { getEmbedding } = await import('./embedding-pipeline');
  const embedding = await getEmbedding(itemId);

  if (!embedding || !embedding.vector || embedding.vector.length === 0) {
    return [];
  }

  const dbProvider = detectDatabaseProvider();

  if (dbProvider === 'postgresql') {
    return searchPostgres(embedding.vector, limit, minScore, [itemId]);
  }

  return searchInMemory(embedding.vector, limit, minScore, [itemId]);
}

// ============================================================================
// Hybrid Search (semantic + keyword)
// ============================================================================

/**
 * Combine semantic search with keyword search for better recall.
 * Semantic results are weighted higher; keyword results fill in gaps.
 */
export async function hybridSearch(
  query: string,
  options?: {
    limit?: number;
    semanticWeight?: number;
    keywordWeight?: number;
  }
): Promise<SemanticSearchResult[]> {
  const { limit = 10, semanticWeight = 0.7, keywordWeight = 0.3 } = options || {};

  // Run semantic search
  const semanticResults = await semanticSearch({
    query,
    limit: limit * 2, // Over-fetch to allow merging
    minScore: 0.2,
  });

  // Build result map with weighted scores
  const resultMap = new Map<string, SemanticSearchResult>();

  for (const result of semanticResults) {
    resultMap.set(result.id, {
      ...result,
      score: result.score * semanticWeight,
    });
  }

  // Keyword search results would be merged here when available
  // For now, semantic-only with potential keyword boost from caller

  // Sort and limit
  return Array.from(resultMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ============================================================================
// Engine Status
// ============================================================================

export function getRAGStatus(): {
  provider: string;
  embeddingsCached: number;
  searchMode: 'pgvector' | 'in-memory';
} {
  return {
    provider: detectDatabaseProvider(),
    embeddingsCached: getCachedEmbeddings().size,
    searchMode: detectDatabaseProvider() === 'postgresql' ? 'pgvector' : 'in-memory',
  };
}
