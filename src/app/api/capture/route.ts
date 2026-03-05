import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { suggestTags } from '@/lib/ai';
import { broadcastItemCreated, broadcastItemUpdated, broadcastStatsUpdated } from '@/lib/ws-broadcast';
import { safeParseTags, safeParseJSON } from '@/lib/parse-utils';
import type { CaptureItemWhereInput } from '@/lib/prisma-types';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

// GET - List all capture items
export async function GET(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    // Support both page-based and offset-based pagination
    // Default to page=1, limit=20
    const limitParam = searchParams.get('limit');
    const pageParam = searchParams.get('page');
    const offsetParam = searchParams.get('offset');

    // Feature #425: Validate pagination parameters
    const limit = limitParam ? parseInt(limitParam) : 20;
    if (limitParam && (isNaN(limit) || limit < 1 || limit > 100)) {
      return NextResponse.json(
        { error: 'Invalid limit parameter. Must be between 1 and 100.' },
        { status: 400 }
      );
    }

    let offset = 0;
    let currentPage = 1;

    if (pageParam) {
      // Page-based pagination (1-indexed)
      const pageNum = parseInt(pageParam);
      if (isNaN(pageNum) || pageNum < 1) {
        return NextResponse.json(
          { error: 'Invalid page parameter. Must be a positive integer.' },
          { status: 400 }
        );
      }
      currentPage = pageNum;
      offset = (currentPage - 1) * limit;
    } else if (offsetParam) {
      // Offset-based pagination (backward compatibility)
      const offsetNum = parseInt(offsetParam);
      if (isNaN(offsetNum) || offsetNum < 0) {
        return NextResponse.json(
          { error: 'Invalid offset parameter. Must be a non-negative integer.' },
          { status: 400 }
        );
      }
      offset = offsetNum;
      currentPage = Math.floor(offset / limit) + 1;
    } else {
      // Default: page=1
      currentPage = 1;
      offset = 0;
    }

    // Feature #425: Validate type parameter if provided
    const validTypes = ['note', 'scratchpad', 'ocr', 'screenshot', 'webpage'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type parameter. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Feature #425: Validate status parameter if provided
    const validStatuses = ['inbox', 'assigned', 'archived', 'trash'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status parameter. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const where: CaptureItemWhereInput = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const items = await db.captureItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const totalCount = await db.captureItem.count({ where });
    const totalPages = Math.ceil(totalCount / limit);

    // Parse tags and metadata safely
    const parsedItems = items.map(item => ({
      ...item,
      tags: safeParseTags(item.tags),
      metadata: safeParseJSON(item.metadata),
    }));

    return NextResponse.json({
      items: parsedItems,
      pagination: {
        currentPage,
        limit,
        totalCount,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    return apiError(message, status, { details: process.env.NODE_ENV === 'production' ? undefined : details, logPrefix: '[GET /api/capture]', error });
  }
}

// POST - Create new capture item
export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });

  try {
    const body = await request.json();

    const {
      type = 'note',
      title,
      content,
      extractedText,
      imageUrl,
      sourceUrl,
      metadata,
      tags,
      priority = 'none',
      status = 'inbox',
      assignedTo,
      dueDate,
      projectId,
    } = body;

    // Feature #425: Validate required fields
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required and must be a non-empty string' }, { status: 400 });
    }

    // Feature #425: Validate type parameter
    const validTypes = ['note', 'scratchpad', 'ocr', 'screenshot', 'webpage'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Feature #425: Validate priority parameter
    const validPriorities = ['none', 'low', 'medium', 'high'];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      );
    }

    // Feature #425: Validate status parameter
    const validStatuses = ['inbox', 'assigned', 'archived', 'trash'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Feature #425: Validate tags parameter
    if (tags && !Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Tags must be an array' },
        { status: 400 }
      );
    }

    // Validate dueDate is a valid ISO date string if provided
    if (dueDate !== undefined && dueDate !== null) {
      const parsedDate = new Date(dueDate);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { error: 'dueDate must be a valid ISO date string' },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();

    // Start with user-provided tags (or empty array)
    const userTags = tags || [];

    // Create item with initial tags (user tags only for now)
    const item = await db.captureItem.create({
      data: {
        type,
        title,
        content: content || null,
        extractedText: extractedText || null,
        imageUrl: imageUrl || null,
        sourceUrl: sourceUrl || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        tags: JSON.stringify(userTags),
        priority,
        status,
        assignedTo: assignedTo || null,
        dueDate: dueDate || null,
        projectId: projectId || null,
      },
    });

    // Broadcast full item to all connected clients immediately with user tags (non-blocking)
    // Send complete item data so clients can add it directly to their lists
    try {
      broadcastItemCreated({
        id: item.id,
        type: item.type,
        title: item.title,
        content: item.content,
        extractedText: item.extractedText,
        imageUrl: item.imageUrl,
        sourceUrl: item.sourceUrl,
        metadata: metadata || null,
        tags: userTags,
        priority: item.priority,
        status: item.status,
        assignedTo: item.assignedTo,
        projectId: item.projectId,
        dueDate: item.dueDate,
        reminder: item.reminder,
        reminderSent: item.reminderSent ?? false,
        pinned: item.pinned ?? false,
        createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
        updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
      });
    } catch (broadcastError) {
      console.error('[POST /api/capture] Broadcast failed (non-fatal):', broadcastError);
    }

    // Async: Auto-suggest tags and merge with user tags (non-blocking)
    // broadcastItemCreated is sent immediately above; broadcastItemUpdated is sent once AI tags arrive
    if (content) {
      // Don't await - let it run in background
      suggestTags(content, title)
        .then((aiTags) => {
          // Merge AI tags with user tags (avoid duplicates)
          const mergedTags = [...new Set([...userTags, ...aiTags])];

          // Only update if AI suggested new tags
          if (aiTags.length > 0 && JSON.stringify(mergedTags) !== JSON.stringify(userTags)) {
            return db.captureItem.update({
              where: { id: item.id },
              data: {
                tags: JSON.stringify(mergedTags),
              },
            });
          }
          return null;
        })
        .then((updated) => {
          if (updated) {
            // Broadcast ITEM_UPDATED once AI tags have been persisted
            try {
              broadcastItemUpdated({
                id: item.id,
                changes: {
                  tags: safeParseTags(updated.tags),
                },
                updatedAt: updated.updatedAt instanceof Date ? updated.updatedAt.toISOString() : updated.updatedAt,
              });
            } catch (broadcastError) {
              console.error('[POST /api/capture] Tag update broadcast failed (non-fatal):', broadcastError);
            }
          }
        })
        .catch((aiError) => {
          // If AI fails, log warning but don't affect the response
          console.warn('[POST /api/capture] AI tag suggestion failed (non-fatal):', aiError);
        });
    }

    // Broadcast stats update (non-blocking)
    try {
      broadcastStatsUpdated({
        type: 'capture',
        timestamp: now,
      });
    } catch (broadcastError) {
      console.error('[POST /api/capture] Stats broadcast failed (non-fatal):', broadcastError);
    }

    return NextResponse.json({
      ...item,
      tags: userTags,
      metadata: metadata || null,
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    return apiError(message, status, { details: process.env.NODE_ENV === 'production' ? undefined : details, logPrefix: '[POST /api/capture]', error });
  }
}
