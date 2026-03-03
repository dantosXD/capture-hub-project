/**
 * Enhanced Capture API Route with Full Security Implementation
 * This demonstrates the use of all security features:
 * - Zod validation schemas
 * - Content sanitization
 * - Rate limiting
 * - CSRF protection
 * - Security headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { suggestTags } from '@/lib/ai';
import { broadcastItemCreated, broadcastItemUpdated, broadcastStatsUpdated } from '@/lib/ws-broadcast';
import { safeParseTags, safeParseJSON } from '@/lib/parse-utils';
import type { CaptureItemWhereInput } from '@/lib/prisma-types';
import {
  validateRequest,
  validateBody,
  validateQuery,
  secureSuccess,
  handleOptions,
} from '@/lib/api-security';
import {
  CreateCaptureItemSchema,
  CaptureItemQuerySchema,
} from '@/lib/validation-schemas';
import {
  sanitizeCaptureItem,
  sanitizeUrl,
  validateId,
} from '@/lib/sanitization';
import { apiError, classifyError } from '@/lib/api-route-handler';

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// GET - List all capture items with security validation
export async function GET(request: NextRequest) {
  // Step 1: Security validation (CSRF + rate limiting)
  const securityValidation = await validateRequest(request, {
    requireCsrf: false, // GET requests are read-only, no CSRF needed
    rateLimitPreset: 'read',
  });

  if (!securityValidation.success) {
    return NextResponse.json(
      { error: securityValidation.error },
      {
        status: securityValidation.status || 500,
        headers: securityValidation.headers,
      }
    );
  }

  try {
    // Step 2: Query parameter validation using Zod
    const queryResult = validateQuery(request, CaptureItemQuerySchema);

    if (queryResult instanceof NextResponse) {
      return queryResult;
    }

    const {
      type,
      status,
      priority,
      assignedTo,
      tag,
      sort,
      limit,
      page,
      offset,
    } = queryResult;

    // Build where clause
    const where: CaptureItemWhereInput = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;
    if (tag) {
      // Client-side filter for tags (stored as JSON string)
      // This is safe because we're using Prisma parameterized queries
    }

    // Calculate offset
    let finalOffset = 0;
    let currentPage = 1;

    if (page) {
      currentPage = page;
      finalOffset = (page - 1) * limit;
    } else if (offset) {
      finalOffset = offset;
      currentPage = Math.floor(offset / limit) + 1;
    }

    // Order by clause based on sort parameter
    let orderBy: { [key: string]: 'asc' | 'desc' } = { createdAt: 'desc' };
    if (sort === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (sort === 'pinned-first') {
      // Prisma doesn't support complex ordering directly, so we'll sort in memory
      // For production with large datasets, use raw SQL or pagination
      orderBy = { pinned: 'desc' };
    }

    const items = await db.captureItem.findMany({
      where,
      orderBy,
      take: limit,
      skip: finalOffset,
    });

    const totalCount = await db.captureItem.count({ where });
    const totalPages = Math.ceil(totalCount / limit);

    // Parse tags and metadata safely
    let parsedItems = items.map(item => ({
      ...item,
      tags: safeParseTags(item.tags),
      metadata: safeParseJSON(item.metadata),
    }));

    // Filter by tag if specified (client-side filter)
    if (tag) {
      parsedItems = parsedItems.filter(item =>
        item.tags.some(t => t.toLowerCase() === tag.toLowerCase())
      );
    }

    // Sort pinned items first if requested
    if (sort === 'pinned-first') {
      parsedItems.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    return secureSuccess(
      {
        items: parsedItems,
        pagination: {
          currentPage,
          limit,
          totalCount,
          totalPages,
          hasNextPage: currentPage < totalPages,
          hasPreviousPage: currentPage > 1,
        },
      },
      200,
      request
    );
  } catch (error) {
    const classified = classifyError(error);
    return apiError(
      classified.message === 'Internal server error' ? 'Failed to fetch items' : classified.message,
      classified.status,
      {
        details: classified.details,
        logPrefix: '[GET /api/capture]',
        error,
      }
    );
  }
}

// POST - Create new capture item with security validation
export async function POST(request: NextRequest) {
  // Step 1: Security validation (CSRF + rate limiting)
  const securityValidation = await validateRequest(request, {
    requireCsrf: true, // POST requires CSRF validation
    rateLimitPreset: 'write', // Stricter rate limit for writes
  });

  if (!securityValidation.success) {
    return NextResponse.json(
      { error: securityValidation.error },
      {
        status: securityValidation.status || 500,
        headers: securityValidation.headers,
      }
    );
  }

  try {
    // Step 2: Body validation using Zod schema
    const bodyResult = await validateBody(request, CreateCaptureItemSchema);

    if (bodyResult instanceof NextResponse) {
      return bodyResult;
    }

    // Step 3: Sanitize all input data
    const sanitizedData = sanitizeCaptureItem(bodyResult);

    // Step 4: Create the item
    const now = new Date().toISOString();

    // Start with user-provided tags
    const userTags = sanitizedData.tags;

    // Create item with initial tags
    const item = await db.captureItem.create({
      data: {
        type: bodyResult.type,
        title: sanitizedData.title,
        content: sanitizedData.content,
        extractedText: sanitizedData.extractedText,
        imageUrl: sanitizedData.imageUrl,
        sourceUrl: sanitizedData.sourceUrl,
        metadata: sanitizedData.metadata ? JSON.stringify(sanitizedData.metadata) : null,
        tags: JSON.stringify(userTags),
        priority: sanitizedData.priority,
        status: sanitizedData.status,
        assignedTo: sanitizedData.assignedTo,
        dueDate: sanitizedData.dueDate,
        projectId: sanitizedData.projectId,
        createdAt: now,
        updatedAt: now,
      },
    });

    // Async: Auto-suggest tags and merge with user tags (non-blocking)
    if (sanitizedData.content) {
      suggestTags(sanitizedData.content, sanitizedData.title)
        .then((aiTags) => {
          // Merge AI tags with user tags (avoid duplicates)
          const mergedTags = [...new Set([...userTags, ...aiTags])];

          // Only update if AI suggested new tags
          if (aiTags.length > 0 && JSON.stringify(mergedTags) !== JSON.stringify(userTags)) {
            return db.captureItem.update({
              where: { id: item.id },
              data: {
                tags: JSON.stringify(mergedTags),
                updatedAt: new Date().toISOString(),
              },
            });
          }
          return null;
        })
        .then((updated) => {
          if (updated) {
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
          console.warn('[POST /api/capture] AI tag suggestion failed (non-fatal):', aiError);
        });
    }

    // Broadcast full item to all connected clients (non-blocking)
    try {
      broadcastItemCreated({
        id: item.id,
        type: item.type,
        title: item.title,
        content: item.content,
        extractedText: item.extractedText,
        imageUrl: item.imageUrl,
        sourceUrl: item.sourceUrl,
        metadata: sanitizedData.metadata || null,
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
    try {
      broadcastStatsUpdated({
        type: 'capture',
        timestamp: now,
      });
    } catch (broadcastError) {
      console.error('[POST /api/capture] Stats broadcast failed (non-fatal):', broadcastError);
    }

    return secureSuccess(
      {
        ...item,
        tags: userTags,
        metadata: sanitizedData.metadata || null,
      },
      201,
      request
    );
  } catch (error) {
    const classified = classifyError(error);
    return apiError(
      classified.message === 'Internal server error' ? 'Failed to create item' : classified.message,
      classified.status,
      {
        details: classified.details,
        logPrefix: '[POST /api/capture]',
        error,
      }
    );
  }
}
