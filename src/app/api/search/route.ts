import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enhanceSearch } from '@/lib/ai';
import { safeParseTags, safeParseJSON } from '@/lib/parse-utils';
import type { CaptureItemWhereInput, CaptureItem } from '@/lib/prisma-types';
import { apiError, classifyError } from '@/lib/api-route-handler';

/**
 * Escape special characters for SQL LIKE queries with ESCAPE clause.
 * This allows searching for literal %, _, and \ characters.
 */
function escapeSqlLike(query: string): string {
  return query
    .replace(/\\/g, '\\\\')  // \ → \\  (must be first)
    .replace(/%/g, '\\%')    // % → \%
    .replace(/_/g, '\\_');   // _ → \_
}

/**
 * Check if a query contains characters that need special handling in LIKE
 */
function hasSqlLikeSpecialChars(query: string): boolean {
  return /[%_\\]/.test(query);
}

/**
 * Sanitize search query: trim, truncate, return null for empty
 */
function sanitizeSearchQuery(query: string | null | undefined, maxLength = 1000): string | null {
  if (!query) return null;
  const trimmed = query.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

// GET - Search across all items
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const aiEnhanced = searchParams.get('aiEnhanced') === 'true' || searchParams.get('ai') === 'true';
    const useAI = aiEnhanced;

    // Sanitize query: trim whitespace, truncate if too long
    const sanitizedQuery = sanitizeSearchQuery(query, 1000);

    // Return empty results for empty or whitespace-only queries
    if (!sanitizedQuery) {
      return NextResponse.json({ items: [], results: [], total: 0 });
    }

    let allItems: CaptureItem[];

    // Check if query contains SQL LIKE special characters
    if (hasSqlLikeSpecialChars(sanitizedQuery)) {
      // Use raw SQL query with ESCAPE clause for special characters
      const escapedPattern = escapeSqlLike(sanitizedQuery);

      // Build SQL query with LIKE ... ESCAPE '\' clause
      const likeConditions = [
        `("title" LIKE ? ESCAPE '\\')`,
        `("content" LIKE ? ESCAPE '\\')`,
        `("extractedText" LIKE ? ESCAPE '\\')`,
        `("sourceUrl" LIKE ? ESCAPE '\\')`,
        `("tags" LIKE ? ESCAPE '\\')`
      ];

      let sqlQuery = `SELECT * FROM "CaptureItem" WHERE (${likeConditions.join(' OR ')})`;
      // Use the escaped pattern with wildcards for partial matching
      const sqlParams = Array(5).fill(`%${escapedPattern}%`);

      const extraConditions: string[] = [];
      if (type) {
        extraConditions.push(`"type" = ?`);
        sqlParams.push(type);
      }
      if (status) {
        extraConditions.push(`"status" = ?`);
        sqlParams.push(status);
      }

      if (extraConditions.length > 0) {
        sqlQuery += ` AND ${extraConditions.join(' AND ')}`;
      }

      sqlQuery += ` ORDER BY "createdAt" DESC LIMIT ?`;
      sqlParams.push(String(Math.max(limit * 2, 50)));

      allItems = await db.$queryRawUnsafe<CaptureItem[]>(sqlQuery, ...sqlParams);
    } else {
      // Use Prisma's regular contains for queries without special characters (faster)
      const where: CaptureItemWhereInput = {
        OR: [
          { title: { contains: sanitizedQuery } },
          { content: { contains: sanitizedQuery } },
          { extractedText: { contains: sanitizedQuery } },
          { sourceUrl: { contains: sanitizedQuery } },
          { tags: { contains: sanitizedQuery } },
        ],
      };
      if (type) where.type = type;
      if (status) where.status = status;

      // Query with DB-level text filtering (much faster than fetching all)
      allItems = await db.captureItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.max(limit * 2, 50), // Fetch a bit more for ranking
      });
    }

    // Parse items
    let parsedItems = allItems.map(item => ({
      ...item,
      tags: safeParseTags(item.tags),
      metadata: safeParseJSON(item.metadata),
    }));

    // Use AI to enhance search results if enabled
    if (useAI && parsedItems.length > 0) {
      try {
        parsedItems = await enhanceSearch(sanitizedQuery, parsedItems);
      } catch (e) {
        console.error('AI search enhancement failed, using basic results');
      }
    }

    const total = parsedItems.length;
    const items = parsedItems.slice(0, limit);

    return NextResponse.json({ items, results: items, total, query: sanitizedQuery });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Search failed' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[GET /api/search]',
      error,
    });
  }
}
