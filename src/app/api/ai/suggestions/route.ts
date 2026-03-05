import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeParseTags } from '@/lib/parse-utils';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';
import { getProcessingSuggestions, suggestTags } from '@/ai/ai-service';

function generateProcessingSuggestions(searchContent: string, providedTags: string[]): string[] {
  const suggestions: string[] = [];
  const hasActionableWords = /\b(todo|task|follow.?up|remind|remember|call|email|schedule|meeting|deadline|due)\b/i.test(searchContent);
  const hasReferenceWords = /\b(reference|info|information|read|review|check out|bookmark|save)\b/i.test(searchContent);
  const hasSomedayWords = /\b(someday|maybe|later|idea|thought|note|interesting)\b/i.test(searchContent);
  const hasProjectWords = /\b(project|initiative|goal|launch|build|create|develop)\b/i.test(searchContent);

  if (hasActionableWords) {
    suggestions.push('This looks actionable - consider adding a due date and assigning to Tasks');
  }
  if (hasReferenceWords) {
    suggestions.push('Appears to be reference material - archive for future lookup');
  }
  if (hasSomedayWords) {
    suggestions.push('Could be a someday/maybe item - add to Review or archive');
  }
  if (hasProjectWords) {
    suggestions.push('Might be project-related - assign to an existing project or create a new one');
  }
  if (providedTags.length === 0) {
    suggestions.push('Add tags to make this item easier to find later');
  }

  return suggestions.slice(0, 3);
}

export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'standard' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });

  try {
    const body = await request.json();
    const { title, content, tags = [], type = 'note', excludeId } = body;

    if (!title && !content) {
      return NextResponse.json({ error: 'Title or content is required' }, { status: 400 });
    }

    const items = await db.captureItem.findMany({
      where: {
        status: { not: 'trash' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const parsedItems = items.map((item) => ({
      ...item,
      tags: safeParseTags(item.tags),
    }));

    const searchContent = `${title || ''} ${content || ''}`.toLowerCase();
    const providedTags = Array.isArray(tags) ? tags : [];

    const relatedItems = parsedItems
      .map((item) => {
        let score = 0;
        const reasons: string[] = [];

        const sharedTags = item.tags.filter((tag: string) => providedTags.includes(tag));
        if (sharedTags.length > 0) {
          score += sharedTags.length * 10;
          reasons.push(`Shared tags: ${sharedTags.join(', ')}`);
        }

        const itemContent = (item.content || '').toLowerCase();
        const itemTitle = item.title.toLowerCase();
        const searchWords = searchContent.split(/\s+/).filter((word) => word.length > 4);
        const matchingWords = searchWords.filter((word) => itemContent.includes(word) || itemTitle.includes(word));
        if (matchingWords.length > 0) {
          score += matchingWords.length * 2;
          reasons.push('Similar content');
        }

        if (item.type === type) {
          score += 3;
          if (reasons.length === 0) reasons.push('Same type');
        }

        return {
          ...item,
          score,
          reason: reasons.join('; '),
        };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        tags: item.tags,
        score: item.score,
        reason: item.reason,
      }));

    const tagFrequency: Record<string, number> = {};
    parsedItems.forEach((item) => {
      item.tags.forEach((tag: string) => {
        const itemCombined = `${item.title} ${item.content || ''}`.toLowerCase();
        const matches = searchContent
          .split(/\s+/)
          .filter((word) => word.length > 4)
          .filter((word) => itemCombined.includes(word)).length;

        if (matches > 0) {
          tagFrequency[tag] = (tagFrequency[tag] || 0) + matches;
        }
      });
    });

    const heuristicTags = Object.entries(tagFrequency)
      .sort((left, right) => right[1] - left[1])
      .filter(([tag]) => !providedTags.includes(tag))
      .slice(0, 5)
      .map(([tag]) => tag);

    const [aiTags, aiProcessing, projects] = await Promise.all([
      suggestTags({ title: title || '', content: content || '' }).catch(() => ({ tags: [], confidence: 0 })),
      getProcessingSuggestions({ title: title || '', content: content || '', type, tags: providedTags }).catch(() => []),
      db.project.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          name: true,
          color: true,
          _count: { select: { items: true } },
        },
      }),
    ]);

    const suggestedProjects = projects
      .map((project) => ({
        ...project,
        score: searchContent.includes(project.name.toLowerCase()) ? 10 : 0,
      }))
      .filter((project) => project.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map((project) => ({
        id: project.id,
        name: project.name,
        color: project.color,
        itemCount: project._count.items,
      }));

    const processingSuggestions = aiProcessing.length > 0
      ? aiProcessing.map((suggestion) => suggestion.text)
      : generateProcessingSuggestions(searchContent, providedTags);

    return NextResponse.json({
      relatedItems,
      suggestedTags: aiTags.tags.length > 0 ? aiTags.tags : heuristicTags,
      processingSuggestions,
      suggestedProjects,
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    return apiError(
      message === 'Internal server error' ? 'Failed to generate suggestions' : message,
      status,
      {
        details: process.env.NODE_ENV === 'production' ? undefined : details,
        logPrefix: '[POST /api/ai/suggestions]',
        error,
      },
    );
  }
}
