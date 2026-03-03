import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { suggestTags } from '@/lib/ai';
import { broadcastItemCreated, broadcastItemUpdated, broadcastStatsUpdated } from '@/lib/ws-broadcast';
import { safeParseTags, safeParseJSON } from '@/lib/parse-utils';
import type { CaptureItemWhereInput } from '@/lib/prisma-types';
import { apiError, classifyError } from '@/lib/api-route-handler';

// GET - List all capture items
export async function GET(request: NextRequest) {
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
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to fetch items' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[GET /api/capture]',
      error,
    });
  }
}

// POST - Create new capture item
export async function POST(request: NextRequest) {
  try {
    console.log('[POST /api/capture] Starting request');
    const body = await request.json();
    console.log('[POST /api/capture] Request body parsed:', { title: body.title, type: body.type });

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

    console.log('[POST /api/capture] Creating database item');
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
    console.log('[POST /api/capture] Database item created:', item.id);

    // Async: Auto-suggest tags and merge with user tags (non-blocking)
    if (content) {
      console.log('[POST /api/capture] Starting async AI tag suggestion');
      // Don't await - let it run in background
      suggestTags(content, title)
        .then((aiTags) => {
          // Merge AI tags with user tags (avoid duplicates)
          const mergedTags = [...new Set([...userTags, ...aiTags])];

          // Only update if AI suggested new tags
          if (aiTags.length > 0 && JSON.stringify(mergedTags) !== JSON.stringify(userTags)) {
            console.log('[POST /api/capture] AI tags suggested, updating item:', aiTags);
            return db.captureItem.update({
              where: { id: item.id },
              data: {
                tags: JSON.stringify(mergedTags),
              },
            });
          }
          console.log('[POST /api/capture] No new AI tags to add');
          return null;
        })
        .then((updated) => {
          if (updated) {
            console.log('[POST /api/capture] Item updated with AI tags');
            // Broadcast update when tags are added
            try {
              broadcastItemUpdated({
                id: item.id,
                changes: {
                  tags: safeParseTags(updated.tags),
                },
                updatedAt: updated.updatedAt,
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

    // Broadcast full item to all connected clients (non-blocking)
    // Send complete item data so clients can add it directly to their lists
    console.log('[POST /api/capture] Broadcasting item created');
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
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    } catch (broadcastError) {
      console.error('[POST /api/capture] Broadcast failed (non-fatal):', broadcastError);
    }

    // Broadcast stats update (non-blocking)
    console.log('[POST /api/capture] Broadcasting stats updated');
    try {
      broadcastStatsUpdated({
        type: 'capture',
        timestamp: now,
      });
    } catch (broadcastError) {
      console.error('[POST /api/capture] Stats broadcast failed (non-fatal):', broadcastError);
    }

    console.log('[POST /api/capture] Sending response');
    return NextResponse.json({
      ...item,
      tags: userTags,
      metadata: metadata || null,
    });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to create item' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[POST /api/capture]',
      error,
    });
  }
}
