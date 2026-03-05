import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastItemBulkUpdate, broadcastStatsUpdated } from '@/lib/ws-broadcast';
import { safeParseTags, safeParseJSON } from '@/lib/parse-utils';
import type { CaptureItemUpdateInput } from '@/lib/prisma-types';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

// POST - Assign items to categories
export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const body = await request.json();
    const { ids, status, assignedTo, priority, dueDate, tags, addTags, projectId } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Item IDs are required' }, { status: 400 });
    }

    // Pre-flight existence check: confirm all requested IDs exist
    const existingItems = await db.captureItem.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });

    if (existingItems.length !== ids.length) {
      const foundIds = new Set(existingItems.map(item => item.id));
      const missingIds = (ids as string[]).filter(id => !foundIds.has(id));
      return NextResponse.json(
        { error: 'Some items were not found', missingIds },
        { status: 404 }
      );
    }

    const updatePromises = ids.map(async (id: string) => {
      const updateData: CaptureItemUpdateInput = {};

      if (status !== undefined) updateData.status = status;
      if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
      if (priority !== undefined) updateData.priority = priority;
      if (dueDate !== undefined) updateData.dueDate = dueDate;
      if (projectId !== undefined) updateData.projectId = projectId;

      // Handle tag updates
      if (tags !== undefined) {
        updateData.tags = JSON.stringify(tags);
      } else if (addTags !== undefined && addTags.length > 0) {
        // Get current tags and add new ones
        const current = await db.captureItem.findUnique({ where: { id } });
        if (current) {
          const currentTags: string[] = safeParseTags(current.tags);
          const newTags = [...new Set([...currentTags, ...addTags])];
          updateData.tags = JSON.stringify(newTags);
        }
      }

      try {
        const item = await db.captureItem.update({ where: { id }, data: updateData });
        return { ok: true as const, item };
      } catch {
        return { ok: false as const, id };
      }
    });

    const results = await Promise.all(updatePromises);
    const updatedItems = results.filter(r => r.ok).map(r => (r as { ok: true; item: any }).item);
    const failedIds = results.filter(r => !r.ok).map(r => (r as { ok: false; id: string }).id);

    // Build changes object for broadcast
    const changes: Record<string, any> = {};
    if (status !== undefined) changes.status = status;
    if (assignedTo !== undefined) changes.assignedTo = assignedTo;
    if (priority !== undefined) changes.priority = priority;
    if (dueDate !== undefined) changes.dueDate = dueDate;
    if (projectId !== undefined) changes.projectId = projectId;
    if (tags !== undefined) changes.tags = tags;
    if (addTags !== undefined && addTags.length > 0) changes.addTags = addTags;

    // Broadcast bulk update event to all connected clients
    broadcastItemBulkUpdate({
      itemIds: ids,
      changes,
      updatedAt: new Date().toISOString(),
    });

    // Broadcast stats update
    broadcastStatsUpdated({
      type: 'inbox',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      count: updatedItems.length,
      ...(failedIds.length > 0 && { failedIds, failedCount: failedIds.length }),
      items: updatedItems.map(item => ({
        ...item,
        tags: safeParseTags(item.tags),
        metadata: safeParseJSON(item.metadata),
      })),
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[POST /api/inbox/assign]', error });
  }
}
