import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeParseTags, safeParseJSON } from '@/lib/parse-utils';
import type { CaptureItemWhereInput, CaptureItemOrderByInput } from '@/lib/prisma-types';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

// GET - Get inbox items with filters
export async function GET(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status') || 'inbox';
    const priority = searchParams.get('priority');
    const assignedTo = searchParams.get('assignedTo');
    const tag = searchParams.get('tag');
    const limitParam = searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam || '50'), 100);
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

    // Tag filter: use DB pre-filter via contains to limit result set, then exact-match in JS
    const tagWhere: CaptureItemWhereInput = { ...where, tags: { contains: tag } };

    const items = await db.captureItem.findMany({
      where: tagWhere,
      orderBy,
    });

    // Parse and exact-match filter
    let parsedItems = items.map(item => ({
      ...item,
      tags: safeParseTags(item.tags),
      metadata: safeParseJSON(item.metadata),
    }));

    // Filter by tag (exact match after parsing JSON array)
    parsedItems = parsedItems.filter(item =>
      item.tags.some((t: string) => t.toLowerCase() === tag.toLowerCase())
    );

    const total = parsedItems.length;
    parsedItems = parsedItems.slice(offset, offset + limit);

    return NextResponse.json({ items: parsedItems, total });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[GET /api/inbox]', error });
  }
}
