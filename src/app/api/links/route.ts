import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastLinkCreated, broadcastLinkDeleted } from '@/lib/ws-broadcast';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

// GET - Get all links for an item
export async function GET(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

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

      // Collect all unique source and target IDs for batch fetch
      const sourceIds = [...new Set(links.map(l => l.sourceId))];
      const targetIds = [...new Set(links.map(l => l.targetId))];
      const allIds = [...new Set([...sourceIds, ...targetIds])];

      const fetchedItems = await db.captureItem.findMany({
        where: { id: { in: allIds } },
        select: { id: true, title: true, type: true, status: true },
      });

      const itemMap = new Map(fetchedItems.map(item => [item.id, item]));

      // Join in memory
      const enrichedLinks = links.map(link => ({
        ...link,
        sourceItem: itemMap.get(link.sourceId) ?? null,
        targetItem: itemMap.get(link.targetId) ?? null,
      }));

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

    // Collect all unique source and target IDs for batch fetch
    const allSourceIds = [...new Set(links.map(l => l.sourceId))];
    const allTargetIds = [...new Set(links.map(l => l.targetId))];
    const allIds = [...new Set([...allSourceIds, ...allTargetIds])];

    const fetchedItems = await db.captureItem.findMany({
      where: { id: { in: allIds } },
      select: { id: true, title: true, type: true, status: true },
    });

    const itemMap = new Map(fetchedItems.map(item => [item.id, item]));

    // Join in memory
    const enrichedLinks = links.map(link => ({
      ...link,
      sourceItem: itemMap.get(link.sourceId) ?? null,
      targetItem: itemMap.get(link.targetId) ?? null,
    }));

    return NextResponse.json({ links: enrichedLinks, total, limit, offset });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[GET /api/links]', error });
  }
}

// POST - Create a new link
export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

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
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[POST /api/links]', error });
  }
}

// DELETE - Remove a link
export async function DELETE(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

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
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[DELETE /api/links]', error });
  }
}
