import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastItemUpdated, broadcastItemDeleted, broadcastStatsUpdated } from '@/lib/ws-broadcast';
import { safeParseTags, safeParseJSON } from '@/lib/parse-utils';
import type { CaptureItemUpdateInput } from '@/lib/prisma-types';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { withConflictResolution, conflictResolutionResponse, checkConcurrentUpdate, updateWithConflictCheck } from '@/lib/api-middleware';
import { conflictTracker } from '@/lib/conflict-resolution';

// GET - Get single capture item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to fetch item' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[GET /api/capture/[id]]',
      error,
    });
  }
}

// PUT - Update capture item with conflict resolution
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Feature #425: Check if item exists before updating
    const existingItem = await db.captureItem.findUnique({
      where: { id },
    });

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
        console.warn(`[ConflictResolution] Stale update for item ${id}:`, {
          clientTimestamp,
          serverTimestamp: existingItem.updatedAt,
        });

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
        console.warn(`[ConflictResolution] Client has newer version for item ${id}:`, {
          clientTimestamp,
          serverTimestamp: existingItem.updatedAt,
        });
        conflictTracker.recordConflict('item', 'local');
      }
    }

    const item = await db.captureItem.update({
      where: { id },
      data: updateData,
    });

    // Broadcast update to all connected clients
    broadcastItemUpdated({
      id: item.id,
      changes: updateData,
      updatedAt: item.updatedAt,
    });

    // Broadcast stats update
    broadcastStatsUpdated({
      type: 'capture',
      timestamp: item.updatedAt,
    });

    return NextResponse.json({
      ...item,
      tags: safeParseTags(item.tags),
      metadata: safeParseJSON(item.metadata),
    });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to update item' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[PUT /api/capture/[id]]',
      error,
    });
  }
}

// DELETE - Delete capture item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to delete item' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[DELETE /api/capture/[id]]',
      error,
    });
  }
}
