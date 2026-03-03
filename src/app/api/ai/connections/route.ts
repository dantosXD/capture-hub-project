import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';
import { safeParseTags } from '@/lib/parse-utils';
import { apiError, classifyError } from '@/lib/api-route-handler';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemId, limit = 5 } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    // Get the source item
    const sourceItem = await db.captureItem.findUnique({
      where: { id: itemId },
    });

    if (!sourceItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const sourceTags = safeParseTags(sourceItem.tags);

    // Get all other items
    const otherItems = await db.captureItem.findMany({
      where: {
        id: { not: itemId },
        status: { not: 'trash' },
      },
      take: 100,
    });

    const parsedItems = otherItems.map(item => ({
      ...item,
      tags: safeParseTags(item.tags),
    }));

    // Score items by relevance
    const scoredItems = parsedItems.map(item => {
      let score = 0;
      const reasons: string[] = [];

      // Tag similarity
      const sharedTags = item.tags.filter((t: string) => sourceTags.includes(t));
      if (sharedTags.length > 0) {
        score += sharedTags.length * 10;
        reasons.push(`Shared tags: ${sharedTags.join(', ')}`);
      }

      // Content similarity (basic keyword match)
      const sourceContent = (sourceItem.content || '').toLowerCase();
      const itemContent = (item.content || '').toLowerCase();
      const sourceWords = sourceContent.split(/\s+/).filter(w => w.length > 4);
      const matchingWords = sourceWords.filter(w => itemContent.includes(w));
      if (matchingWords.length > 0) {
        score += matchingWords.length * 2;
        reasons.push('Similar content');
      }

      // Same type bonus
      if (item.type === sourceItem.type) {
        score += 3;
        reasons.push('Same type');
      }

      // Title similarity
      const sourceTitle = (sourceItem.title || '').toLowerCase();
      const itemTitle = (item.title || '').toLowerCase();
      const titleWords = sourceTitle.split(/\s+/).filter(w => w.length > 3);
      const matchingTitleWords = titleWords.filter(w => itemTitle.includes(w));
      if (matchingTitleWords.length > 0) {
        score += matchingTitleWords.length * 5;
        reasons.push('Similar title');
      }

      return { ...item, score, reasons };
    });

    // Sort by score and take top items
    const connections = scoredItems
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        score: item.score,
        reason: item.reasons.join('; '),
        tags: item.tags,
      }));

    // If we have AI, enhance the connections with semantic similarity
    if (connections.length > 0 && sourceItem.content) {
      try {
        const zai = await getZAI();
        
        const result = await zai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'You are a semantic similarity assistant. Given a source item and potential connections, re-rank them by semantic relevance. Return a JSON array of indices sorted by relevance.',
            },
            {
              role: 'user',
              content: `Source: "${sourceItem.title}" - ${(sourceItem.content || '').substring(0, 200)}
              
Potential connections:
${connections.map((c, i) => `[${i}] "${c.title}"`).join('\n')}

Return a JSON array of indices sorted by semantic relevance:`,
            }
          ]
        });

        const response = result.choices[0]?.message?.content || '[]';
        const indices: number[] = JSON.parse(response);
        
        // Reorder connections
        const reordered = indices
          .filter(i => i >= 0 && i < connections.length)
          .map(i => connections[i]);
        
        if (reordered.length > 0) {
          return NextResponse.json({ connections: reordered });
        }
      } catch (e) {
        console.error('AI connection enhancement failed:', e);
      }
    }

    return NextResponse.json({ connections });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to find connections' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[POST /api/ai/connections]',
      error,
    });
  }
}
