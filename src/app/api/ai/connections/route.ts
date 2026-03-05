import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enhanceSearch } from '@/ai/ai-service';
import { safeParseTags } from '@/lib/parse-utils';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'standard' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const body = await request.json();
    const { itemId, limit = 5 } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    const sourceItem = await db.captureItem.findUnique({
      where: { id: itemId },
    });

    if (!sourceItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const sourceTags = safeParseTags(sourceItem.tags);
    const otherItems = await db.captureItem.findMany({
      where: {
        id: { not: itemId },
        status: { not: 'trash' },
      },
      take: 120,
    });

    const parsedItems = otherItems.map((item) => ({
      ...item,
      tags: safeParseTags(item.tags),
    }));

    let connections = parsedItems
      .map((item) => {
        let score = 0;
        const reasons: string[] = [];

        const sharedTags = item.tags.filter((tag: string) => sourceTags.includes(tag));
        if (sharedTags.length > 0) {
          score += sharedTags.length * 10;
          reasons.push(`Shared tags: ${sharedTags.join(', ')}`);
        }

        const sourceContent = `${sourceItem.title} ${sourceItem.content || ''}`.toLowerCase();
        const itemContent = `${item.title} ${item.content || ''}`.toLowerCase();
        const sourceWords = sourceContent.split(/\s+/).filter((word) => word.length > 4);
        const matchingWords = sourceWords.filter((word) => itemContent.includes(word));
        if (matchingWords.length > 0) {
          score += matchingWords.length * 2;
          reasons.push('Similar content');
        }

        if (item.type === sourceItem.type) {
          score += 3;
          reasons.push('Same type');
        }

        return {
          id: item.id,
          title: item.title,
          type: item.type,
          tags: item.tags,
          score,
          reason: reasons.join('; '),
        };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(limit * 2, 8));

    if (connections.length > 1) {
      try {
        const ranked = await enhanceSearch({
          query: `${sourceItem.title} ${sourceItem.content || ''}`.trim(),
          items: connections.map((item) => ({
            id: item.id,
            title: item.title,
            content: item.reason,
          })),
        });

        const rankMap = new Map(ranked.map((entry, index) => [entry.id, ranked.length - index]));
        connections = [...connections]
          .sort((left, right) => ((rankMap.get(right.id) || 0) + right.score) - ((rankMap.get(left.id) || 0) + left.score));
      } catch {
        // Heuristic ranking is still good enough.
      }
    }

    return NextResponse.json({ connections: connections.slice(0, limit) });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(
      message === 'Internal server error' ? 'Failed to find connections' : message,
      status,
      { details: safeDetails, logPrefix: '[POST /api/ai/connections]', error },
    );
  }
}
