import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastProjectDeleted, broadcastProjectUpdated } from '@/lib/ws-broadcast';
import { safeParseTags, safeParseJSON } from '@/lib/parse-utils';
import type { ProjectUpdateInput } from '@/lib/prisma-types';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { conflictTracker } from '@/lib/conflict-resolution';
import { validateRequest } from '@/lib/api-security';

// GET - Get a specific project with its items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const { id } = await params;

    const project = await db.project.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        templates: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const parsedItems = project.items.map(item => ({
      ...item,
      tags: safeParseTags(item.tags),
      metadata: safeParseJSON(item.metadata),
    }));

    return NextResponse.json({
      project: {
        ...project,
        items: parsedItems,
        itemCount: project.items.length,
      },
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[GET /api/projects/[id]]', error });
  }
}

// PATCH - Update a project with conflict resolution
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, color, icon, status, priority, dueDate, order, _timestamp } = body;

    // Check if project exists
    const existingProject = await db.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Feature #492: Conflict resolution with last-write-wins
    const clientTimestamp = _timestamp || request.headers.get('x-client-timestamp');

    if (clientTimestamp && clientTimestamp !== existingProject.updatedAt) {
      // Potential conflict detected - compare timestamps
      const clientDate = new Date(clientTimestamp);
      const serverDate = new Date(existingProject.updatedAt);

      if (clientDate < serverDate) {
        // Client has stale data - return current server version
        console.warn(`[ConflictResolution] Stale update for project ${id}:`, {
          clientTimestamp,
          serverTimestamp: existingProject.updatedAt,
        });

        // Track conflict
        conflictTracker.recordConflict('project', 'remote');

        return NextResponse.json({
          project: existingProject,
          _conflict: {
            detected: true,
            winner: 'remote',
            reason: 'Server has newer version',
            serverTimestamp: existingProject.updatedAt,
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
        console.warn(`[ConflictResolution] Client has newer version for project ${id}:`, {
          clientTimestamp,
          serverTimestamp: existingProject.updatedAt,
        });
        conflictTracker.recordConflict('project', 'local');
      }
    }

    const updateData: ProjectUpdateInput = { updatedAt: new Date().toISOString() };
    const changes: Record<string, string | number | null | undefined> = {};

    if (name !== undefined) { updateData.name = name; changes.name = name; }
    if (description !== undefined) { updateData.description = description; changes.description = description; }
    if (color !== undefined) { updateData.color = color; changes.color = color; }
    if (icon !== undefined) { updateData.icon = icon; changes.icon = icon; }
    if (status !== undefined) { updateData.status = status; changes.status = status; }
    if (priority !== undefined) { updateData.priority = priority; changes.priority = priority; }
    if (dueDate !== undefined) { updateData.dueDate = dueDate; changes.dueDate = dueDate; }
    if (order !== undefined) { updateData.order = order; changes.order = order; }

    const project = await db.project.update({
      where: { id },
      data: updateData,
    });

    // Broadcast project update to all connected clients
    try {
      broadcastProjectUpdated({
        id: project.id,
        changes,
        updatedAt: project.updatedAt,
      });
    } catch (broadcastError) {
      console.error('[PATCH /api/projects/[id]] Broadcast failed (non-fatal):', broadcastError);
    }

    return NextResponse.json({ project });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[PATCH /api/projects/[id]]', error });
  }
}

// DELETE - Delete a project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const { id } = await params;

    // First, fetch the project to get its data for broadcasting
    const project = await db.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Unassign items from this project before deleting
    await db.captureItem.updateMany({
      where: { projectId: id },
      data: { projectId: null },
    });

    // Delete the project
    await db.project.delete({
      where: { id },
    });

    // Broadcast project deletion to all connected clients
    try {
      broadcastProjectDeleted({
        id: project.id,
        deletedAt: new Date().toISOString(),
      });
    } catch (broadcastError) {
      console.error('[DELETE /api/projects/[id]] Broadcast failed (non-fatal):', broadcastError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[DELETE /api/projects/[id]]', error });
  }
}
