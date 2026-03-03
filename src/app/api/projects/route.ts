import { NextRequest, NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { getProjectsWithCounts } from '@/lib/query-optimized';
import { broadcastProjectCreated } from '@/lib/ws-broadcast';
import { apiError, classifyError } from '@/lib/api-route-handler';

// GET - Get all projects
export async function GET(request: NextRequest) {
  try {
    const projects = await getProjectsWithCounts();

    return NextResponse.json({ projects });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to fetch projects' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[GET /api/projects]',
      error,
    });
  }
}

// POST - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color, icon, status, priority, dueDate } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    // Use withRetry for better concurrency handling
    const project = await withRetry(async () => {
      // Get the max order
      const maxOrderProject = await db.project.findFirst({
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      return db.project.create({
        data: {
          name: name.trim(),
          description: description || null,
          color: color || '#6366f1',
          icon: icon || null,
          status: status || 'active',
          priority: priority || 'medium',
          dueDate: dueDate || null,
          order: (maxOrderProject?.order || 0) + 1,
        },
      });
    });

    // Broadcast project creation to all connected clients
    try {
      broadcastProjectCreated({
        id: project.id,
        name: project.name,
        color: project.color,
        status: project.status,
        createdAt: project.createdAt,
      });
    } catch (broadcastError) {
      console.error('[POST /api/projects] Broadcast failed (non-fatal):', broadcastError);
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to create project' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[POST /api/projects]',
      error,
    });
  }
}
