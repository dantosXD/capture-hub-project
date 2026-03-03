import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastLinkCreated, broadcastLinkDeleted } from '@/lib/ws-broadcast';
import { apiError, classifyError } from '@/lib/api-route-handler';

// GET - Get all links for an item
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    if (itemId) {
      // Get links for a specific item (bidirectional: where item is source OR target)
      const links = await db.itemLink.findMany({
        where: {
          OR: [
            { sourceId: itemId },
            { targetId: itemId },
          ],
        },
      });

      // Enrich links with source and target item details
      const enrichedLinks = await Promise.all(
        links.map(async (link) => {
          const [sourceItem, targetItem] = await Promise.all([
            db.captureItem.findUnique({
              where: { id: link.sourceId },
              select: { id: true, title: true, type: true, status: true },
            }),
            db.captureItem.findUnique({
              where: { id: link.targetId },
              select: { id: true, title: true, type: true, status: true },
            }),
          ]);

          return {
            ...link,
            sourceItem: sourceItem || null,
            targetItem: targetItem || null,
          };
        })
      );

      // Extract linked items for easier consumption
      const linkedItems = enrichedLinks
        .map(link => link.sourceId === itemId ? link.targetItem : link.sourceItem)
        .filter((item): item is { id: string; title: string; type: string; status: string } => item !== null);

      return NextResponse.json({ links: enrichedLinks, linkedItems });
    }

    // Get all links with source and target details (paginated)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const [total, links] = await Promise.all([
      db.itemLink.count(),
      db.itemLink.findMany({ take: limit, skip: offset, orderBy: { createdAt: 'desc' } }),
    ]);

    const enrichedLinks = await Promise.all(
      links.map(async (link) => {
        const [sourceItem, targetItem] = await Promise.all([
          db.captureItem.findUnique({
            where: { id: link.sourceId },
            select: { id: true, title: true, type: true, status: true },
          }),
          db.captureItem.findUnique({
            where: { id: link.targetId },
            select: { id: true, title: true, type: true, status: true },
          }),
        ]);

        return {
          ...link,
          sourceItem: sourceItem || null,
          targetItem: targetItem || null,
        };
      })
    );

    return NextResponse.json({ links: enrichedLinks, total, limit, offset });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to fetch links' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[GET /api/links]',
      error,
    });
  }
}

// POST - Create a new link
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId, targetId, relationType, note } = body;

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'Source and target IDs are required' }, { status: 400 });
    }

    if (sourceId === targetId) {
      return NextResponse.json({ error: 'Cannot link item to itself' }, { status: 400 });
    }

    // Validate both items exist
    const [sourceItem, targetItem] = await Promise.all([
      db.captureItem.findUnique({ where: { id: sourceId } }),
      db.captureItem.findUnique({ where: { id: targetId } }),
    ]);

    if (!sourceItem) {
      return NextResponse.json({ error: 'Source item not found' }, { status: 404 });
    }

    if (!targetItem) {
      return NextResponse.json({ error: 'Target item not found' }, { status: 404 });
    }

    // Check if link already exists (enforce unique constraint)
    const existing = await db.itemLink.findFirst({
      where: { sourceId, targetId },
    });

    if (existing) {
      return NextResponse.json({ error: 'Link already exists' }, { status: 400 });
    }

    const link = await db.itemLink.create({
      data: {
        sourceId,
        targetId,
        relationType: relationType || 'related',
        note: note || null,
        // createdAt handled by @default(now())
      },
    });

    // Broadcast link:created via WebSocket
    broadcastLinkCreated({
      id: link.id,
      sourceId: link.sourceId,
      targetId: link.targetId,
      relationType: link.relationType,
      createdAt: link.createdAt,
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to create link' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[POST /api/links]',
      error,
    });
  }
}

// DELETE - Remove a link
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const targetId = searchParams.get('targetId');

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'Source and target IDs are required' }, { status: 400 });
    }

    // Find the link first to get its data for broadcast
    const link = await db.itemLink.findFirst({
      where: { sourceId, targetId },
    });

    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    // Delete the link
    await db.itemLink.deleteMany({
      where: { sourceId, targetId },
    });

    // Broadcast link:deleted via WebSocket
    broadcastLinkDeleted({
      sourceId: link.sourceId,
      targetId: link.targetId,
      deletedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to delete link' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[DELETE /api/links]',
      error,
    });
  }
}
