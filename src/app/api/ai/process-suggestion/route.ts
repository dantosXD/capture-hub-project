import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeParseTags } from '@/lib/parse-utils';
import { getProcessingSuggestions, suggestTags } from '@/ai/ai-service';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

function fallbackSuggestion(item: { type: string; title: string }): string {
  if (item.type === 'screenshot') {
    return 'Review the screenshot, tag it, and archive it if it is only reference material.';
  }
  if (item.type === 'webpage') {
    return 'Decide whether this page needs follow-up or should be archived as reference.';
  }
  if (/\b(call|email|meeting|schedule|follow up|deadline|due)\b/i.test(item.title)) {
    return 'This looks actionable. Assign it to the right bucket and give it a next step.';
  }
  return 'Decide whether this needs action, project context, or simple archival.';
}

export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });

  try {
    const body = await request.json();
    const { itemId } = body;

    if (!itemId || typeof itemId !== 'string') {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    const [item, projects] = await Promise.all([
      db.captureItem.findUnique({ where: { id: itemId } }),
      db.project.findMany({
        where: { status: 'active' },
        select: { id: true, name: true },
        take: 20,
      }),
    ]);

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const parsedTags = safeParseTags(item.tags);
    const projectMatch = projects.find((project) => {
      const haystack = `${item.title} ${item.content || ''}`.toLowerCase();
      return haystack.includes(project.name.toLowerCase());
    });

    const [processingSuggestions, tagSuggestions] = await Promise.all([
      getProcessingSuggestions({
        title: item.title,
        content: item.content || '',
        type: item.type,
        tags: parsedTags,
      }).catch(() => []),
      suggestTags({
        title: item.title,
        content: item.content || '',
      }).catch(() => ({ tags: [], confidence: 0 })),
    ]);

    return NextResponse.json({
      suggestion: processingSuggestions[0]?.text || fallbackSuggestion(item),
      suggestedTags: tagSuggestions.tags.filter((tag) => !parsedTags.includes(tag)).slice(0, 3),
      suggestedProject: projectMatch?.name || '',
    });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to generate suggestion' : classified.message, classified.status, {
      details: process.env.NODE_ENV === 'production' ? undefined : classified.details,
      logPrefix: '[POST /api/ai/process-suggestion]',
      error,
    });
  }
}
