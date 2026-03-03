import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeParseTags, safeParseJSON } from '@/lib/parse-utils';
import type { CaptureItemWhereInput, CaptureItemOrderByInput } from '@/lib/prisma-types';
import { apiError, classifyError } from '@/lib/api-route-handler';

// GET - Get inbox items with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status') || 'inbox';
    const priority = searchParams.get('priority');
    const assignedTo = searchParams.get('assignedTo');
    const tag = searchParams.get('tag');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sort') || searchParams.get('sortBy') || 'newest';

    const where: CaptureItemWhereInput = { status };
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;

    // Determine sort order
    // Support: newest (default), oldest, pinned-first (or pinned for backward compat)
    const isPinnedFirst = sortBy === 'pinned-first' || sortBy === 'pinned';
    const orderBy: CaptureItemOrderByInput[] = isPinnedFirst
      ? [{ pinned: 'desc' }, { createdAt: 'desc' }]
      : [{ createdAt: sortBy === 'oldest' ? 'asc' : 'desc' }];

    // If no tag filter, paginate at database level (fast path)
    if (!tag) {
      const [items, total] = await Promise.all([
        db.captureItem.findMany({
          where,
          orderBy,
          take: limit,
          skip: offset,
        }),
        db.captureItem.count({ where }),
      ]);

      const parsedItems = items.map(item => ({
        ...item,
        tags: safeParseTags(item.tags),
        metadata: safeParseJSON(item.metadata),
      }));

      return NextResponse.json({ items: parsedItems, total });
    }

    // Tag filter requires JS filtering (SQLite limitation with JSON fields)
    // Only select needed fields for tag filtering to reduce memory
    const items = await db.captureItem.findMany({
      where,
      orderBy,
    });

    // Parse and filter
    let parsedItems = items.map(item => ({
      ...item,
      tags: safeParseTags(item.tags),
      metadata: safeParseJSON(item.metadata),
    }));

    // Filter by tag
    parsedItems = parsedItems.filter(item =>
      item.tags.some((t: string) => t.toLowerCase() === tag.toLowerCase())
    );

    const total = parsedItems.length;
    parsedItems = parsedItems.slice(offset, offset + limit);

    return NextResponse.json({ items: parsedItems, total });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to fetch inbox items' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[GET /api/inbox]',
      error,
    });
  }
}
