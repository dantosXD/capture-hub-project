import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeParseTags } from '@/lib/parse-utils';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

/**
 * AI Content Suggestions Endpoint
 * POST /api/ai/suggestions
 *
 * Provides intelligent suggestions for:
 * - Related items (based on tags and content similarity)
 * - Tag recommendations (based on content analysis)
 * - GTD processing actions (what to do with the item)
 *
 * Note: Project-scoped suggestions are not yet implemented.
 * Project scoring currently uses only name-in-content matching.
 */
export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'standard' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const body = await request.json();
    const { title, content, tags = [], type = 'note', excludeId } = body;

    // Validate input
    if (!title && !content) {
      return NextResponse.json(
        { error: 'Title or content is required' },
        { status: 400 }
      );
    }

    // Get all items for analysis (exclude current item if editing)
    const items = await db.captureItem.findMany({
      where: {
        status: { not: 'trash' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const parsedItems = items.map(item => ({
      ...item,
      tags: safeParseTags(item.tags),
    }));

    // Combine provided tags with content for analysis
    const searchContent = `${title || ''} ${content || ''}`.toLowerCase();
    const providedTags = Array.isArray(tags) ? tags : [];

    // 1. Find related items (based on shared tags and content similarity)
    const relatedItems = parsedItems
      .map(item => {
        let score = 0;
        const reasons: string[] = [];

        // Check for shared tags
        const sharedTags = item.tags.filter((t: string) => providedTags.includes(t));
        if (sharedTags.length > 0) {
          score += sharedTags.length * 10;
          reasons.push(`Shared tags: ${sharedTags.join(', ')}`);
        }

        // Content similarity (basic keyword match)
        const itemContent = (item.content || '').toLowerCase();
        const itemTitle = (item.title || '').toLowerCase();
        const searchWords = searchContent.split(/\s+/).filter(w => w.length > 4);

        const matchingContentWords = searchWords.filter(w =>
          itemContent.includes(w) || itemTitle.includes(w)
        );

        if (matchingContentWords.length > 0) {
          score += matchingContentWords.length * 2;
          reasons.push('Similar content');
        }

        // Same type bonus
        if (item.type === type) {
          score += 3;
          if (reasons.length === 0) {
            reasons.push('Same type');
          }
        }

        return { ...item, score, reason: reasons.join('; ') };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        tags: item.tags,
        score: item.score,
        reason: item.reason,
      }));

    // 2. Suggest tags based on content and existing tag patterns
    const tagFrequency: Record<string, number> = {};
    parsedItems.forEach(item => {
      const itemTags = item.tags as string[];
      itemTags.forEach((tag: string) => {
        // Check if this item's content is similar to current content
        const itemCombined = `${item.title} ${item.content || ''}`.toLowerCase();
        const searchWords = searchContent.split(/\s+/).filter(w => w.length > 4);
        const matchCount = searchWords.filter(w => itemCombined.includes(w)).length;

        if (matchCount > 0) {
          tagFrequency[tag] = (tagFrequency[tag] || 0) + matchCount;
        }
      });
    });

    // Get top tag suggestions that aren't already provided
    const suggestedTags = Object.entries(tagFrequency)
      .sort((a, b) => b[1] - a[1])
      .filter(([tag]) => !providedTags.includes(tag))
      .slice(0, 5)
      .map(([tag]) => tag);

    // 3. GTD processing suggestions based on content analysis
    const generateProcessingSuggestions = (): string[] => {
      const suggestions: string[] = [];

      // Analyze content keywords for GTD patterns
      const lowerContent = searchContent;
      const hasActionableWords = /\b(todo|task|follow.?up|remind|remember|call|email|schedule|meeting|deadline|due)\b/i.test(lowerContent);
      const hasReferenceWords = /\b(reference|info|information|read|review|check out|bookmark|save)\b/i.test(lowerContent);
      const hasSomedayWords = /\b(someday|maybe|later|idea|thought|note|interesting)\b/i.test(lowerContent);
      const hasProjectWords = /\b(project|initiative|goal|launch|build|create|develop)\b/i.test(lowerContent);

      // Check content length
      const isLongContent = (content?.length || 0) > 500;

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

      if (isLongContent) {
        suggestions.push('Long-form content - consider summarizing for quick reference');
      }

      // Default suggestion if no patterns matched
      if (suggestions.length === 0) {
        suggestions.push('Review and decide: does this require action, or is it reference material?');
      }

      // Add tagging suggestion if no tags provided
      if (providedTags.length === 0) {
        suggestions.push('Add tags to make this item easier to find later');
      }

      return suggestions.slice(0, 3);
    };

    const processingSuggestions = generateProcessingSuggestions();

    // 4. Suggest related projects based on name-in-content matching
    // Note: project-scoped filtering (by item.projectId) is not yet implemented.
    const projects = await db.project.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        status: true,
        _count: { select: { items: true } },
      },
      where: { status: 'active' },
    });

    // Score projects by content similarity (name appears in search content)
    const suggestedProjects = projects
      .map(project => {
        let score = 0;
        const projectName = project.name.toLowerCase();

        // Check if project name appears in content
        if (searchContent.includes(projectName)) {
          score += 10;
        }

        return { ...project, score };
      })
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        itemCount: p._count.items,
      }));

    return NextResponse.json({
      relatedItems,
      suggestedTags,
      processingSuggestions,
      suggestedProjects,
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(
      message === 'Internal server error' ? 'Failed to generate suggestions' : message,
      status,
      { details: safeDetails, logPrefix: '[POST /api/ai/suggestions]', error }
    );
  }
}
