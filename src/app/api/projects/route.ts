import { NextRequest, NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { getProjectsWithCounts } from '@/lib/query-optimized';
import { broadcastProjectCreated } from '@/lib/ws-broadcast';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest, validateBody } from '@/lib/api-security';
import { CreateProjectSchema } from '@/lib/validation-schemas';

// GET - Get all projects
export async function GET(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const projects = await getProjectsWithCounts();

    return NextResponse.json({ projects });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[GET /api/projects]', error });
  }
}

// POST - Create a new project
export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  const body = await validateBody(request, CreateProjectSchema);
  if (body instanceof NextResponse) return body;

  try {
    const { name, description, color, icon, status, priority, dueDate } = body;

    // Use withRetry + db.$transaction to atomically get max order and insert
    const project = await withRetry(async () => {
      return db.$transaction(async (tx) => {
        const maxOrderProject = await tx.project.findFirst({
          orderBy: { order: 'desc' },
          select: { order: true },
        });

        return tx.project.create({
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
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[POST /api/projects]', error });
  }
}
