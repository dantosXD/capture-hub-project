/**
 * Embedding Pipeline (Project Omni P4)
 *
 * Generates and manages vector embeddings for CaptureItems.
 * On PostgreSQL (pgvector), embeddings are stored in the Embedding table.
 * On SQLite, embeddings are stored in an in-memory cache for dev/testing.
 *
 * Architecture:
 *   CaptureItem → content extraction → chunking → embedding → storage
 *   EventBus(item.created/updated) → auto-embed (async, non-blocking)
 */

import { getProvider } from './provider-registry';
import { detectDatabaseProvider } from '@/lib/db-config';
import { eventBus } from '@/contracts/event-bus';
import { EventType } from '@/contracts/events';
import type { EmbeddingResult } from './types';
import { createHash } from 'node:crypto';

// ============================================================================
// In-Memory Embedding Cache (SQLite fallback)
// ============================================================================

interface CachedEmbedding {
  itemId: string;
  vector: number[];
  model: string;
  dimensions: number;
  contentHash: string;
  createdAt: string;
}

const embeddingCache = new Map<string, CachedEmbedding>();

// ============================================================================
// Content Extraction
// ============================================================================

/**
 * Extract embeddable text from a CaptureItem.
 * Combines title, content, tags, and extracted text into a single string.
 */
export function extractEmbeddableContent(item: {
  title: string;
  content?: string | null;
  extractedText?: string | null;
  tags?: string | string[];
  type?: string;
}): string {
  const parts: string[] = [];

  if (item.title) parts.push(item.title);
  if (item.content) parts.push(item.content);
  if (item.extractedText) parts.push(item.extractedText);

  // Parse tags
  if (item.tags) {
    const tagArray = Array.isArray(item.tags)
      ? item.tags
      : (() => { try { return JSON.parse(item.tags); } catch { return []; } })();
    if (tagArray.length > 0) {
      parts.push(`Tags: ${tagArray.join(', ')}`);
    }
  }

  return parts.join('\n\n').trim();
}

/**
 * Compute content hash to detect stale embeddings.
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate embedding for a single text input.
 */
export async function generateEmbedding(text: string): Promise<{
  vector: number[];
  model: string;
  dimensions: number;
  tokenCount?: number;
}> {
  const provider = getProvider();

  // Truncate text to avoid token limits (roughly 8000 tokens ≈ 32000 chars)
  const truncated = text.length > 32000 ? text.substring(0, 32000) : text;

  const result: EmbeddingResult = await provider.embed({ input: truncated });

  return {
    vector: result.embeddings[0],
    model: result.model,
    dimensions: result.dimensions,
    tokenCount: result.usage?.totalTokens,
  };
}

/**
 * Generate embeddings for multiple texts in batch.
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<{
  embeddings: Array<{ vector: number[]; model: string; dimensions: number }>;
  totalTokens: number;
}> {
  const provider = getProvider();

  // Truncate each text
  const truncated = texts.map(t => t.length > 32000 ? t.substring(0, 32000) : t);

  const result: EmbeddingResult = await provider.embed({ input: truncated });

  return {
    embeddings: result.embeddings.map(vector => ({
      vector,
      model: result.model,
      dimensions: result.dimensions,
    })),
    totalTokens: result.usage?.totalTokens || 0,
  };
}

// ============================================================================
// Embedding Storage
// ============================================================================

/**
 * Store an embedding for a CaptureItem.
 * Uses PostgreSQL Embedding table if available, otherwise in-memory cache.
 */
export async function storeEmbedding(
  itemId: string,
  vector: number[],
  model: string,
  dimensions: number,
  contentHash: string,
  tokenCount?: number
): Promise<void> {
  const dbProvider = detectDatabaseProvider();

  if (dbProvider === 'postgresql') {
    // PostgreSQL: Store via raw SQL (pgvector requires raw query for vector type)
    // This will be called via Prisma.$executeRaw when Prisma is connected to PG
    // For now, we store the data structure; actual PG write is in the db layer
    await storeEmbeddingPostgres(itemId, vector, model, dimensions, contentHash, tokenCount);
  } else {
    // SQLite: Store in memory cache
    embeddingCache.set(itemId, {
      itemId,
      vector,
      model,
      dimensions,
      contentHash,
      createdAt: new Date().toISOString(),
    });
  }
}

/**
 * Store embedding in PostgreSQL via Prisma raw query.
 * Separated for clarity; called when DB provider is postgresql.
 */
async function storeEmbeddingPostgres(
  itemId: string,
  vector: number[],
  model: string,
  dimensions: number,
  contentHash: string,
  tokenCount?: number
): Promise<void> {
  // Dynamic import to avoid loading Prisma in test environments
  try {
    const { db } = await import('@/lib/db');

    // Upsert embedding record
    await (db as any).$executeRaw`
      INSERT INTO "Embedding" ("id", "itemId", "vector", "model", "dimensions", "tokenCount", "contentHash", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid()::text,
        ${itemId},
        ${`[${vector.join(',')}]`}::vector,
        ${model},
        ${dimensions},
        ${tokenCount || null},
        ${contentHash},
        NOW(),
        NOW()
      )
      ON CONFLICT ("itemId") DO UPDATE SET
        "vector" = ${`[${vector.join(',')}]`}::vector,
        "model" = ${model},
        "dimensions" = ${dimensions},
        "tokenCount" = ${tokenCount || null},
        "contentHash" = ${contentHash},
        "updatedAt" = NOW()
    `;
  } catch (error) {
    console.error(`[Embedding] Failed to store embedding for ${itemId}:`, error);
    // Fallback to memory cache
    embeddingCache.set(itemId, {
      itemId, vector, model, dimensions, contentHash,
      createdAt: new Date().toISOString(),
    });
  }
}

/**
 * Get stored embedding for an item.
 */
export async function getEmbedding(itemId: string): Promise<CachedEmbedding | null> {
  // Check memory cache first
  const cached = embeddingCache.get(itemId);
  if (cached) return cached;

  // PostgreSQL: query from database
  const dbProvider = detectDatabaseProvider();
  if (dbProvider === 'postgresql') {
    try {
      const { db } = await import('@/lib/db');
      const record = await (db as any).embedding.findUnique({ where: { itemId } });
      if (record) {
        return {
          itemId: record.itemId,
          vector: record.vector || [],
          model: record.model,
          dimensions: record.dimensions,
          contentHash: record.contentHash || '',
          createdAt: record.createdAt.toISOString(),
        };
      }
    } catch {
      // Table may not exist yet on SQLite schema
    }
  }

  return null;
}

// ============================================================================
// Pipeline: Embed a CaptureItem
// ============================================================================

/**
 * Full pipeline: extract content, generate embedding, store it.
 * Idempotent — skips if content hasn't changed (by hash).
 */
export async function embedItem(item: {
  id: string;
  title: string;
  content?: string | null;
  extractedText?: string | null;
  tags?: string | string[];
  type?: string;
}): Promise<{ embedded: boolean; skipped: boolean; reason?: string }> {
  try {
    const text = extractEmbeddableContent(item);
    if (!text || text.length < 10) {
      return { embedded: false, skipped: true, reason: 'Content too short' };
    }

    const contentHash = computeContentHash(text);

    // Check if existing embedding is still fresh
    const existing = await getEmbedding(item.id);
    if (existing && existing.contentHash === contentHash) {
      return { embedded: false, skipped: true, reason: 'Content unchanged' };
    }

    // Generate and store
    const { vector, model, dimensions, tokenCount } = await generateEmbedding(text);
    await storeEmbedding(item.id, vector, model, dimensions, contentHash, tokenCount);

    return { embedded: true, skipped: false };
  } catch (error: any) {
    console.error(`[Embedding] Failed to embed item ${item.id}:`, error?.message);
    return { embedded: false, skipped: false, reason: error?.message };
  }
}

// ============================================================================
// Event-Driven Auto-Embedding
// ============================================================================

let autoEmbedSubscriptionId: string | null = null;

/**
 * Subscribe to item events and auto-generate embeddings.
 * Call during server startup after event mesh is initialized.
 */
export function enableAutoEmbed(): void {
  if (autoEmbedSubscriptionId) return;

  const sub = eventBus.on(EventType.ITEM_CREATED, async (event) => {
    const payload = event.payload as any;
    await embedItem(payload);
  }, { isolated: true });

  autoEmbedSubscriptionId = sub.id;

  // Also embed on item updates
  eventBus.on(EventType.ITEM_UPDATED, async (event) => {
    const payload = event.payload as any;
    if (payload.id) {
      await embedItem(payload);
    }
  }, { isolated: true });

  console.log('[Embedding] Auto-embed enabled for item.created and item.updated events');
}

/**
 * Disable auto-embedding.
 */
export function disableAutoEmbed(): void {
  if (autoEmbedSubscriptionId) {
    eventBus.off(autoEmbedSubscriptionId);
    autoEmbedSubscriptionId = null;
    console.log('[Embedding] Auto-embed disabled');
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get all cached embeddings (for testing/debugging).
 */
export function getCachedEmbeddings(): Map<string, CachedEmbedding> {
  return new Map(embeddingCache);
}

/**
 * Clear the in-memory embedding cache.
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

/**
 * Get embedding pipeline stats.
 */
export function getEmbeddingStats(): {
  cachedCount: number;
  autoEmbedEnabled: boolean;
} {
  return {
    cachedCount: embeddingCache.size,
    autoEmbedEnabled: autoEmbedSubscriptionId !== null,
  };
}
