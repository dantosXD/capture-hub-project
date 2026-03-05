/**
 * Batch operation utilities for efficient bulk database operations.
 * Reduces database round trips by batching operations.
 */

import { db, withRetry } from './db';
import { Prisma } from '@prisma/client';

/**
 * Batch update capture items efficiently
 */
export async function batchUpdateItems(params: {
  ids: string[];
  updates: Partial<{
    status: string;
    priority: string;
    assignedTo: string;
    pinned: boolean;
    projectId: string | null;
    processedAt: string;
    processedBy: string;
  }>;
}) {
  const { ids, updates } = params;

  // Wrap all batches in a single transaction so all succeed or none do
  return withRetry(async () => {
    // Update items in batches (SQLite handles up to 999 variables per query)
    const batchSize = 100;
    const results: Array<{ count: number }> = [];

    await db.$transaction(async (tx) => {
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batch = await tx.captureItem.updateMany({
          where: {
            id: { in: batchIds },
          },
          data: {
            ...updates,
            // updatedAt handled by @updatedAt
          },
        });
        results.push(batch);
      }
    });

    return results;
  });
}

/**
 * Batch delete items efficiently
 */
export async function batchDeleteItems(ids: string[]) {
  return withRetry(async () => {
    const batchSize = 100;
    const results: Array<{ count: number }> = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      const batch = await db.captureItem.deleteMany({
        where: {
          id: { in: batchIds },
        },
      });
      results.push(batch);
    }

    return results;
  });
}

/**
 * Batch assign tags to items
 */
export async function batchAssignTags(params: {
  ids: string[];
  tags: string[];
  mode?: 'replace' | 'append' | 'remove';
}) {
  const { ids, tags, mode = 'append' } = params;

  return withRetry(async () => {
    // Fetch all items first
    const items = await db.captureItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, tags: true },
    });

    // Prepare updates
    const updates = items.map(item => {
      let currentTags: string[] = [];
      try {
        currentTags = JSON.parse(item.tags);
      } catch {
        // Invalid JSON, start fresh
      }

      let newTags: string[];

      switch (mode) {
        case 'replace':
          newTags = tags;
          break;
        case 'remove':
          newTags = currentTags.filter(t => !tags.includes(t));
          break;
        case 'append':
        default:
          newTags = [...new Set([...currentTags, ...tags])];
          break;
      }

      return {
        where: { id: item.id },
        data: {
          tags: JSON.stringify(newTags),
          // updatedAt handled by @updatedAt
        },
      };
    });

    // Execute updates in a transaction
    return await db.$transaction(
      updates.map(update =>
        db.captureItem.update(update)
      )
    );
  });
}

/**
 * Batch move items to trash (soft delete)
 */
export async function batchMoveToTrash(ids: string[]) {
  return batchUpdateItems({
    ids,
    updates: { status: 'trash' },
  });
}

/**
 * Batch archive items
 */
export async function batchArchiveItems(ids: string[]) {
  return batchUpdateItems({
    ids,
    updates: { status: 'archived' },
  });
}

/**
 * Bulk create items atomically — all items are created or none are.
 */
export async function bulkCreateItems(
  items: Array<{
    type: string;
    title: string;
    content?: string;
    tags?: string[];
    priority?: string;
    status?: string;
  }>
) {
  return withRetry(async () => {
    const now = new Date().toISOString();

    return await db.$transaction(async (tx) => {
      return Promise.all(
        items.map(item =>
          tx.captureItem.create({
            data: {
              type: item.type,
              title: item.title,
              content: item.content || null,
              tags: JSON.stringify(item.tags || []),
              priority: item.priority || 'none',
              status: item.status || 'inbox',
              createdAt: now,
              updatedAt: now,
            },
          })
        )
      );
    });
  });
}

/**
 * Get count by status efficiently (single query)
 */
export async function getCountsByStatus() {
  const result = await db.captureItem.groupBy({
    by: ['status'],
    _count: true,
  });

  return Object.fromEntries(
    result.map(r => [r.status, r._count])
  );
}

/**
 * Get count by type efficiently (single query)
 */
export async function getCountsByType() {
  const result = await db.captureItem.groupBy({
    by: ['type'],
    _count: true,
  });

  return Object.fromEntries(
    result.map(r => [r.type, r._count])
  );
}

/**
 * Get all unique tags (efficient extraction)
 */
export async function getAllUniqueTags(): Promise<string[]> {
  const items = await db.captureItem.findMany({
    select: { tags: true },
    where: {
      tags: { not: '[]' },
    },
  });

  const tagSet = new Set<string>();

  for (const item of items) {
    try {
      const tags = JSON.parse(item.tags) as string[];
      for (const tag of tags) {
        if (tag && typeof tag === 'string') {
          tagSet.add(tag);
        }
      }
    } catch {
      // Skip invalid JSON
    }
  }

  return Array.from(tagSet).sort();
}

/**
 * Cleanup stale connected devices
 */
export async function cleanupStaleDevices(maxAgeMinutes = 5) {
  const cutoff = new Date();
  cutoff.setMinutes(cutoff.getMinutes() - maxAgeMinutes);

  return db.connectedDevice.deleteMany({
    where: {
      lastSeen: { lt: cutoff.toISOString() },
    },
  });
}
