import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

// GET - Get a single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const { id } = await params;
    const template = await db.template.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[GET /api/templates/[id]]', error });
  }
}

// PATCH - Update a template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, content, category, icon, variables, isDefault, projectId } = body;

    const template = await db.template.update({
      where: { id },
      data: {
        // Use !== undefined so empty string is a valid update value
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(icon !== undefined && { icon: icon || null }),
        ...(variables !== undefined && { variables: variables ? JSON.stringify(variables) : null }),
        ...(isDefault !== undefined && { isDefault }),
        ...(projectId !== undefined && { projectId: projectId || null }),
        // updatedAt handled by @updatedAt
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[PATCH /api/templates/[id]]', error });
  }
}

// DELETE - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const { id } = await params;
    // Don't allow deletion of default templates
    const template = await db.template.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete default templates' },
        { status: 403 }
      );
    }

    await db.template.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[DELETE /api/templates/[id]]', error });
  }
}
