/**
 * Simple in-memory cache for query results with TTL support.
 * Reduces database load for frequently accessed, rarely-changing data.
 */

import { createHash } from 'crypto';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL = 5000; // 5 seconds default TTL
  private maxSize = 500; // maximum number of entries before evicting oldest

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store data in cache with TTL
   */
  set<T>(key: string, data: T, ttlMs = this.defaultTTL): void {
    // Evict the oldest (first) entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const queryCache = new QueryCache();

/**
 * Helper to cache async function results
 */
export async function cachedQuery<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = 5000
): Promise<T> {
  // Check cache first
  const cached = queryCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Execute query and cache result
  const result = await fn();
  queryCache.set(key, result, ttlMs);
  return result;
}

/**
 * Generate cache key from query parameters using SHA-256 to avoid collisions
 * from pipe-separated strings with special characters.
 */
export function generateCacheKey(
  prefix: string,
  params: Record<string, unknown>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');
  return createHash('sha256').update(`${prefix}:${sortedParams}`).digest('hex').slice(0, 32);
}
