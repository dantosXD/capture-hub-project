import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError, classifyError } from '@/lib/api-route-handler';

// GET - Get a single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to fetch template' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[GET /api/templates/[id]]',
      error,
    });
  }
}

// PATCH - Update a template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, content, category, icon, variables, isDefault, projectId } = body;

    const template = await db.template.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(content && { content }),
        ...(category && { category }),
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
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to update template' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[PATCH /api/templates/[id]]',
      error,
    });
  }
}

// DELETE - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to delete template' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[DELETE /api/templates/[id]]',
      error,
    });
  }
}
