import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeParseTags } from '@/lib/parse-utils';
import { executeChat } from '@/ai/runtime';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

type CandidateItem = {
  id: string;
  title: string;
  content: string | null;
  tags: string[];
  type: string;
  projectId: string | null;
};

type AskAction = {
  type: 'open_item' | 'archive_item' | 'tag_item' | 'assign_project' | 'insert_scratchpad';
  label: string;
  itemId?: string;
  projectId?: string;
  tags?: string[];
  content?: string;
};

function scoreCandidate(query: string, item: CandidateItem): number {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2);

  let score = 0;
  for (const term of terms) {
    if (item.title.toLowerCase().includes(term)) score += 6;
    if ((item.content || '').toLowerCase().includes(term)) score += 2;
    if (item.tags.some((tag) => tag.toLowerCase().includes(term))) score += 4;
  }

  if (item.projectId) score += 1;
  return score;
}

function buildFallbackResponse(question: string, candidates: CandidateItem[]) {
  const citations = candidates.slice(0, 3).map((item) => ({
    id: item.id,
    title: item.title,
    snippet: (item.content || '').slice(0, 220),
    tags: item.tags,
    reason: 'Keyword and tag match',
  }));

  if (citations.length === 0) {
    return {
      answer: `No saved captures matched "${question}" yet.`,
      citations: [],
      actions: [] as AskAction[],
    };
  }

  return {
    answer: `I found ${citations.length} saved capture${citations.length > 1 ? 's' : ''} that look relevant. Start with ${citations[0].title}.`,
    citations,
    actions: [
      {
        type: 'open_item' as const,
        label: `Open ${citations[0].title}`,
        itemId: citations[0].id,
      },
      {
        type: 'insert_scratchpad' as const,
        label: 'Send answer to scratchpad',
        content: citations.map((citation) => `- ${citation.title}`).join('\n'),
      },
    ],
  };
}

export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'standard' });
  if (!security.success) {
    return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });
  }

  try {
    const body = await request.json();
    const question = typeof body.question === 'string' ? body.question.trim() : '';

    if (!question) {
      return NextResponse.json({ error: 'A question is required' }, { status: 400 });
    }

    const [items, projects] = await Promise.all([
      db.captureItem.findMany({
        where: { status: { not: 'trash' } },
        select: {
          id: true,
          title: true,
          content: true,
          tags: true,
          type: true,
          projectId: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 150,
      }),
      db.project.findMany({
        where: { status: 'active' },
        select: { id: true, name: true },
        take: 15,
      }),
    ]);

    const candidates = items
      .map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        tags: safeParseTags(item.tags),
        type: item.type,
        projectId: item.projectId,
        score: scoreCandidate(question, {
          id: item.id,
          title: item.title,
          content: item.content,
          tags: safeParseTags(item.tags),
          type: item.type,
          projectId: item.projectId,
        }),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);

    if (candidates.length === 0) {
      return NextResponse.json({
        answer: `No saved captures matched "${question}" yet.`,
        citations: [],
        actions: [],
      });
    }

    try {
      const { result, meta } = await executeChat({
        messages: [
          {
            role: 'system',
            content: 'Answer using only the provided capture items. Return JSON with fields: answer, citations, actions. citations must be an array of {id, reason}. actions must use only these types: open_item, archive_item, tag_item, assign_project, insert_scratchpad. Never invent ids.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              question,
              candidates: candidates.map((item) => ({
                id: item.id,
                title: item.title,
                type: item.type,
                tags: item.tags,
                projectId: item.projectId,
                snippet: (item.content || '').slice(0, 500),
              })),
              projects,
            }),
          },
        ],
        responseFormat: 'json',
      });

      const parsed = JSON.parse(result.content || '{}');
      const citationIds = Array.isArray(parsed.citations)
        ? parsed.citations
            .map((citation: { id?: unknown; reason?: unknown }) => ({
              id: typeof citation.id === 'string' ? citation.id : '',
              reason: typeof citation.reason === 'string' ? citation.reason : 'Relevant evidence',
            }))
            .filter((citation: { id: string }) => citation.id)
        : [];
      const candidateMap = new Map(candidates.map((item) => [item.id, item]));

      const citations = citationIds
        .map((citation: { id: string; reason: string }) => {
          const item = candidateMap.get(citation.id);
          if (!item) return null;

          return {
            id: item.id,
            title: item.title,
            snippet: (item.content || '').slice(0, 220),
            tags: item.tags,
            reason: citation.reason,
          };
        })
        .filter(Boolean);

      const actions: AskAction[] = Array.isArray(parsed.actions)
        ? parsed.actions
            .map((action: {
              type?: unknown;
              label?: unknown;
              itemId?: unknown;
              projectId?: unknown;
              tags?: unknown;
              content?: unknown;
            }) => ({
              type: action.type,
              label: typeof action.label === 'string' ? action.label : 'Suggested action',
              itemId: typeof action.itemId === 'string' ? action.itemId : undefined,
              projectId: typeof action.projectId === 'string' ? action.projectId : undefined,
              tags: Array.isArray(action.tags) ? action.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
              content: typeof action.content === 'string' ? action.content : undefined,
            }))
            .filter((action): action is AskAction => (
              action.type === 'open_item' ||
              action.type === 'archive_item' ||
              action.type === 'tag_item' ||
              action.type === 'assign_project' ||
              action.type === 'insert_scratchpad'
            ))
        : [];

      const fallback = buildFallbackResponse(question, candidates);

      return NextResponse.json({
        answer: typeof parsed.answer === 'string' && parsed.answer.trim() ? parsed.answer : fallback.answer,
        citations: citations.length > 0 ? citations : fallback.citations,
        actions: actions.length > 0 ? actions : fallback.actions,
        meta: {
          provider: meta.provider,
          model: meta.model,
        },
      });
    } catch {
      return NextResponse.json(buildFallbackResponse(question, candidates));
    }
  } catch (error) {
    const { message, status, details } = classifyError(error);
    return apiError(
      message === 'Internal server error' ? 'Failed to answer question' : message,
      status,
      {
        details: process.env.NODE_ENV === 'production' ? undefined : details,
        logPrefix: '[POST /api/ai/ask]',
        error,
      },
    );
  }
}
