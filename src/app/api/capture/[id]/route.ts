import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastItemUpdated, broadcastItemDeleted, broadcastStatsUpdated } from '@/lib/ws-broadcast';
import { safeParseTags, safeParseJSON } from '@/lib/parse-utils';
import type { CaptureItemUpdateInput } from '@/lib/prisma-types';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { withConflictResolution, conflictResolutionResponse, checkConcurrentUpdate, updateWithConflictCheck } from '@/lib/api-middleware';
import { conflictTracker } from '@/lib/conflict-resolution';
import { validateRequest } from '@/lib/api-security';

// GET - Get single capture item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });

  try {
    const { id } = await params;
    const item = await db.captureItem.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...item,
      tags: safeParseTags(item.tags),
      metadata: safeParseJSON(item.metadata),
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    return apiError(message, status, { details: process.env.NODE_ENV === 'production' ? undefined : details, logPrefix: '[GET /api/capture/[id]]', error });
  }
}

// PUT - Update capture item with conflict resolution
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });

  try {
    const { id } = await params;
    const body = await request.json();

    // Use raw SQL to avoid P2023 DateTime coercion on existing rows
    type RawItem = { id: string; type: string; title: string; content: string | null; extractedText: string | null; imageUrl: string | null; sourceUrl: string | null; metadata: string | null; tags: string; priority: string; status: string; assignedTo: string | null; dueDate: string | null; reminder: string | null; reminderSent: number; pinned: number; projectId: string | null; processedAt: string | null; processedBy: string | null; createdAt: string; updatedAt: string };
    const rows = await db.$queryRawUnsafe<RawItem[]>(
      `SELECT * FROM CaptureItem WHERE id = ?`, id
    );
    const existingItem = rows[0] || null;

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Feature #425: Validate request body
    const updateData: CaptureItemUpdateInput = {
      updatedAt: new Date().toISOString(),
    };

    // Only update fields that are provided
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim() === '') {
        return NextResponse.json(
          { error: 'Title must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.title = body.title.trim();
    }
    if (body.content !== undefined) updateData.content = body.content;
    if (body.extractedText !== undefined) updateData.extractedText = body.extractedText;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.sourceUrl !== undefined) updateData.sourceUrl = body.sourceUrl;
    if (body.metadata !== undefined) updateData.metadata = body.metadata ? JSON.stringify(body.metadata) : null;
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags)) {
        return NextResponse.json(
          { error: 'Tags must be an array' },
          { status: 400 }
        );
      }
      updateData.tags = JSON.stringify(body.tags);
    }
    if (body.priority !== undefined) {
      const validPriorities = ['none', 'low', 'medium', 'high'];
      if (!validPriorities.includes(body.priority)) {
        return NextResponse.json(
          { error: `Priority must be one of: ${validPriorities.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.priority = body.priority;
    }
    if (body.status !== undefined) {
      const validStatuses = ['inbox', 'assigned', 'archived', 'trash'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Status must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.status = body.status;
    }
    if (body.assignedTo !== undefined) {
      updateData.assignedTo = body.assignedTo;
      // Auto-change status to 'assigned' when assigning to a category
      if (body.assignedTo && body.assignedTo !== '') {
        updateData.status = 'assigned';
      }
      // If unassigning, revert to 'inbox' (only if currently in 'assigned' status)
      else if (!body.assignedTo || body.assignedTo === '') {
        if (existingItem.status === 'assigned') {
          updateData.status = 'inbox';
        }
      }
    }
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate;
    if (body.reminder !== undefined) updateData.reminder = body.reminder;
    if (body.pinned !== undefined) {
      if (typeof body.pinned !== 'boolean') {
        return NextResponse.json(
          { error: 'Pinned must be a boolean' },
          { status: 400 }
        );
      }
      updateData.pinned = body.pinned;
    }
    if (body.projectId !== undefined) updateData.projectId = body.projectId;

    // Feature #492: Conflict resolution with last-write-wins
    const clientTimestamp = body._timestamp || request.headers.get('x-client-timestamp');

    if (clientTimestamp && clientTimestamp !== existingItem.updatedAt) {
      // Potential conflict detected - compare timestamps
      const clientDate = new Date(clientTimestamp);
      const serverDate = new Date(existingItem.updatedAt);

      if (clientDate < serverDate) {
        // Client has stale data - return current server version

        // Track conflict
        conflictTracker.recordConflict('item', 'remote');

        return NextResponse.json({
          ...existingItem,
          tags: safeParseTags(existingItem.tags),
          metadata: safeParseJSON(existingItem.metadata),
          _conflict: {
            detected: true,
            winner: 'remote',
            reason: 'Server has newer version',
            serverTimestamp: existingItem.updatedAt,
          },
        }, {
          headers: {
            'X-Conflict-Resolved': 'remote',
            'X-Conflict-Reason': 'stale-client-data',
          },
        });
      }

      // Client has newer or same version - proceed with update
      if (clientDate > serverDate) {
        conflictTracker.recordConflict('item', 'local');
      }
    }

    // Build raw SQL SET clauses to avoid Prisma DateTime coercion on update return value
    const setClauses: string[] = ['updatedAt = ?'];
    const setValues: unknown[] = [updateData.updatedAt];

    if (updateData.title !== undefined) { setClauses.push('title = ?'); setValues.push(updateData.title); }
    if (updateData.content !== undefined) { setClauses.push('content = ?'); setValues.push(updateData.content); }
    if (updateData.extractedText !== undefined) { setClauses.push('extractedText = ?'); setValues.push(updateData.extractedText); }
    if (updateData.imageUrl !== undefined) { setClauses.push('imageUrl = ?'); setValues.push(updateData.imageUrl); }
    if (updateData.sourceUrl !== undefined) { setClauses.push('sourceUrl = ?'); setValues.push(updateData.sourceUrl); }
    if (updateData.metadata !== undefined) { setClauses.push('metadata = ?'); setValues.push(updateData.metadata); }
    if (updateData.tags !== undefined) { setClauses.push('tags = ?'); setValues.push(updateData.tags); }
    if (updateData.priority !== undefined) { setClauses.push('priority = ?'); setValues.push(updateData.priority); }
    if (updateData.status !== undefined) { setClauses.push('status = ?'); setValues.push(updateData.status); }
    if (updateData.assignedTo !== undefined) { setClauses.push('assignedTo = ?'); setValues.push(updateData.assignedTo); }
    if (updateData.dueDate !== undefined) { setClauses.push('dueDate = ?'); setValues.push(updateData.dueDate); }
    if (updateData.reminder !== undefined) { setClauses.push('reminder = ?'); setValues.push(updateData.reminder); }
    if (updateData.pinned !== undefined) { setClauses.push('pinned = ?'); setValues.push(updateData.pinned ? 1 : 0); }
    if (updateData.projectId !== undefined) { setClauses.push('projectId = ?'); setValues.push(updateData.projectId); }

    await db.$executeRawUnsafe(
      `UPDATE CaptureItem SET ${setClauses.join(', ')} WHERE id = ?`,
      ...setValues, id
    );

    // Construct synthetic response using existing data merged with updates
    const updatedAt = updateData.updatedAt as string;
    const mergedItem = {
      ...existingItem,
      ...updateData,
      id,
      updatedAt,
      pinned: updateData.pinned !== undefined ? updateData.pinned : !!existingItem.pinned,
      reminderSent: !!existingItem.reminderSent,
      tags: safeParseTags((updateData.tags as string | null | undefined) ?? existingItem.tags),
      metadata: safeParseJSON((updateData.metadata as string | null | undefined) ?? existingItem.metadata),
    };

    // Broadcast update to all connected clients (with parsed tags/metadata for consumers)
    broadcastItemUpdated({
      id,
      changes: {
        ...updateData,
        ...(updateData.tags !== undefined ? { tags: safeParseTags(updateData.tags as string) } : {}),
        ...(updateData.metadata !== undefined ? { metadata: safeParseJSON(updateData.metadata as string | null) } : {}),
      },
      updatedAt,
    });

    // Broadcast stats update
    broadcastStatsUpdated({ type: 'capture', timestamp: updatedAt });

    return NextResponse.json(mergedItem);
  } catch (error) {
    const { message, status, details } = classifyError(error);
    return apiError(message, status, { details: process.env.NODE_ENV === 'production' ? undefined : details, logPrefix: '[PUT /api/capture/[id]]', error });
  }
}

// DELETE - Delete capture item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });

  try {
    const { id } = await params;

    // Get item before deletion for broadcast
    const item = await db.captureItem.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await db.captureItem.delete({
      where: { id },
    });

    // Broadcast deletion to all connected clients
    broadcastItemDeleted({
      id,
      deletedAt: new Date().toISOString(),
    });

    // Broadcast stats update
    broadcastStatsUpdated({
      type: 'capture',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    return apiError(message, status, { details: process.env.NODE_ENV === 'production' ? undefined : details, logPrefix: '[DELETE /api/capture/[id]]', error });
  }
}
