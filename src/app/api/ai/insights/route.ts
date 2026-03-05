import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';
import { safeParseTags } from '@/lib/parse-utils';
import { apiError, classifyError } from '@/lib/api-route-handler';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
let aiChecked = false;

async function getZAI() {
  if (!zaiInstance && !aiChecked) {
    aiChecked = true;
    // Check if API key is configured BEFORE attempting to create ZAI instance
    if (!process.env.ZAI_API_KEY && !process.env.OPENAI_API_KEY) {
      return null; // Return null instead of throwing
    }
    try {
      zaiInstance = await ZAI.create();
    } catch (e) {
      console.error('ZAI initialization failed:', e);
      return null;
    }
  }
  return zaiInstance;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { context } = body || {};

    // Get all items for analysis - use raw SQL to avoid P2023 DateTime coercion errors
    type RawItem = { id: string; title: string; type: string; tags: string | null; status: string; content: string | null; createdAt: string; updatedAt: string; projectId: string | null; processedAt: string | null };
    const items = await db.$queryRawUnsafe<RawItem[]>(
      `SELECT id, title, type, tags, status, content, createdAt, updatedAt, projectId, processedAt FROM CaptureItem WHERE status != 'trash' ORDER BY createdAt DESC LIMIT 100`
    );

    const parsedItems = items.map(item => ({
      ...item,
      tags: safeParseTags(item.tags),
    }));

    // Calculate stats
    const now = new Date();
    // Use UTC date to avoid timezone issues - get start of current day in UTC
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const staleDate = new Date(todayStart);
    staleDate.setDate(staleDate.getDate() - 7);

    const stats = {
      total: parsedItems.length,
      inbox: parsedItems.filter(i => i.status === 'inbox').length,
      archived: parsedItems.filter(i => i.status === 'archived').length,
      today: parsedItems.filter(i => new Date(i.createdAt) >= todayStart).length,
      thisWeek: parsedItems.filter(i => new Date(i.createdAt) >= weekStart).length,
      lastWeek: parsedItems.filter(i => {
        const date = new Date(i.createdAt);
        return date >= lastWeekStart && date < weekStart;
      }).length,
      stale: parsedItems.filter(i =>
        i.status === 'inbox' && new Date(i.updatedAt) < staleDate
      ).length,
      processingRate: 0,
      avgProcessingTime: 0,
    };

    // Calculate processing rate
    if (stats.total > 0) {
      stats.processingRate = Math.round((stats.archived / stats.total) * 100);
    }

    // Calculate week-over-week trends
    // Get all items (including trash) to compute historical totals - raw SQL for safety
    type TrendItem = { status: string; createdAt: string; updatedAt: string };
    const allItemsForTrends = await db.$queryRawUnsafe<TrendItem[]>(
      `SELECT status, createdAt, updatedAt FROM CaptureItem`
    );

    // Items that existed by end of last week (created before weekStart)
    const itemsExistingLastWeek = allItemsForTrends.filter(
      i => new Date(i.createdAt) < weekStart
    );
    const lastWeekTotal = itemsExistingLastWeek.length;
    const lastWeekInbox = itemsExistingLastWeek.filter(i => i.status === 'inbox').length;
    const lastWeekArchived = itemsExistingLastWeek.filter(i => i.status === 'archived').length;
    const lastWeekProcessingRate = lastWeekTotal > 0
      ? Math.round((lastWeekArchived / lastWeekTotal) * 100)
      : 0;

    // Helper to calculate percentage change
    function calcPercentChange(current: number, previous: number): number | null {
      if (previous === 0 && current === 0) return 0;
      if (previous === 0) return 100; // went from 0 to something
      return Math.round(((current - previous) / previous) * 100);
    }

    const trends = {
      total: {
        current: stats.total,
        previous: lastWeekTotal,
        change: calcPercentChange(stats.total, lastWeekTotal),
        direction: stats.total >= lastWeekTotal ? 'up' as const : 'down' as const,
      },
      inbox: {
        current: stats.inbox,
        previous: lastWeekInbox,
        change: calcPercentChange(stats.inbox, lastWeekInbox),
        direction: stats.inbox <= lastWeekInbox ? 'up' as const : 'down' as const, // Lower inbox is better
      },
      captures: {
        current: stats.thisWeek,
        previous: stats.lastWeek,
        change: calcPercentChange(stats.thisWeek, stats.lastWeek),
        direction: stats.thisWeek >= stats.lastWeek ? 'up' as const : 'down' as const,
      },
      processingRate: {
        current: stats.processingRate,
        previous: lastWeekProcessingRate,
        change: calcPercentChange(stats.processingRate, lastWeekProcessingRate),
        direction: stats.processingRate >= lastWeekProcessingRate ? 'up' as const : 'down' as const,
      },
    };

    // Find stale items (in inbox, not updated in 7 days)
    const staleItems = parsedItems
      .filter(i => i.status === 'inbox' && new Date(i.updatedAt) < staleDate)
      .slice(0, 5)
      .map(i => ({ id: i.id, title: i.title, type: i.type, createdAt: i.createdAt }));

    // Find recent items (last 10 captures)
    const recentItems = parsedItems.slice(0, 10).map(i => ({
      id: i.id,
      title: i.title,
      type: i.type,
      createdAt: i.createdAt,
    }));

    // Get tag frequency
    const tagCounts: Record<string, number> = {};
    parsedItems.forEach(item => {
      const tags = Array.isArray(item.tags) ? item.tags : [];
      tags.forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag, count]) => ({ tag, count }));

    // Generate weekly data for chart
    const weeklyData: Array<{ date: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(todayStart);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = parsedItems.filter(item => {
        const itemDate = new Date(item.createdAt);
        return itemDate >= date && itemDate < nextDate;
      }).length;

      weeklyData.push({ date: dateStr, count });
    }

    // Get projects
    const projects = await db.project.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        status: true,
        _count: { select: { items: true } },
      },
      take: 10,
    });

    const projectsData = projects.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      status: p.status,
      itemCount: p._count.items,
    }));

    // Calculate productivity metrics
    const daysWithData = weeklyData.filter(d => d.count > 0).length || 1;
    const productivity = {
      capturesPerDay: Math.round((stats.thisWeek / daysWithData) * 10) / 10,
      archiveRate: stats.processingRate,
      staleRate: stats.total > 0 ? Math.round((stats.stale / stats.total) * 100) : 0,
    };

    // Generate AI insight
    let insight = '';
    let suggestions: Array<{ text: string; action: string; target?: string }> = [];

    // Generate contextual actionable suggestions based on data state
    const generateContextualSuggestions = (): Array<{ text: string; action: string; target?: string }> => {
      const result: Array<{ text: string; action: string; target?: string }> = [];

      // Suggestion for stale items
      if (stats.stale > 0) {
        result.push({
          text: `Process ${stats.stale} stale item${stats.stale > 1 ? 's' : ''} older than 7 days`,
          action: 'navigate',
          target: 'inbox',
        });
      }

      // Suggestion for large inbox
      if (stats.inbox > 10) {
        result.push({
          text: `Review ${stats.inbox} items in your inbox`,
          action: 'navigate',
          target: 'inbox',
        });
      }

      // Suggestion for low processing rate
      if (stats.processingRate < 30 && stats.total > 5) {
        result.push({
          text: 'Archive processed items to improve productivity',
          action: 'navigate',
          target: 'archived',
        });
      }

      // Suggestion for GTD processing workflow
      if (stats.inbox > 5) {
        result.push({
          text: 'Start GTD processing workflow',
          action: 'navigate',
          target: 'dashboard',
        });
      }

      // Suggestion for capturing new content
      if (stats.today === 0 && stats.thisWeek < 5) {
        result.push({
          text: 'Capture your first idea today',
          action: 'openCapture',
          target: 'note',
        });
      }

      // Suggestion for organizing with projects
      if (projectsData.length > 0) {
        const itemsWithoutProjects = parsedItems.filter(i => !i.projectId).length;
        if (itemsWithoutProjects > 5) {
          result.push({
            text: `Assign ${itemsWithoutProjects} items to projects`,
            action: 'navigate',
            target: 'projects',
          });
        }
      }

      // Suggestion for tagging
      const untaggedItems = parsedItems.filter(i => !i.tags || i.tags.length === 0).length;
      if (untaggedItems > 5) {
        result.push({
          text: `Add tags to ${untaggedItems} untagged item${untaggedItems > 1 ? 's' : ''}`,
          action: 'navigate',
          target: 'inbox',
        });
      }

      // Limit to 4 suggestions max
      return result.slice(0, 4);
    };

    // First, try AI-generated suggestions
    try {
      const zai = await getZAI();

      if (zai) {
        const insightPrompt = `You are a productivity assistant. Based on these capture statistics, provide a brief (one sentence) insight and 2-3 actionable suggestions.

Stats:
- Total items: ${stats.total}
- In inbox: ${stats.inbox}
- Archived: ${stats.archived}
- Captured today: ${stats.today}
- Captured this week: ${stats.thisWeek}
- Last week: ${stats.lastWeek}
- Stale items (inbox > 7 days): ${stats.stale}
- Processing rate: ${stats.processingRate}%
- Top tags: ${topTags.map(t => t.tag).join(', ')}

Recent item titles: ${recentItems.map(i => i.title).join(', ')}

Respond in JSON format:
{
  "insight": "Your brief insight here",
  "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
}`;

        const result = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a helpful productivity assistant. Always respond with valid JSON.' },
            { role: 'user', content: insightPrompt }
          ]
        });

        const response = result.choices[0]?.message?.content || '';
        try {
          const parsed = JSON.parse(response);
          insight = parsed.insight || '';
          const aiSuggestions = parsed.suggestions || [];
          // Map AI suggestions to actionable format
          suggestions = aiSuggestions.slice(0, 3).map((text: string) => ({
            text,
            action: 'navigate',
            target: 'inbox',
          }));
        } catch {
          insight = response;
        }
      }
    } catch (e: any) {
      console.error('AI insight generation failed:', e);
    }

    // Fall back to or supplement with contextual suggestions
    if (suggestions.length === 0) {
      insight = stats.stale > 0
        ? `You have ${stats.stale} items that haven't been processed in over a week.`
        : `You've captured ${stats.thisWeek} items this week. Keep up the momentum!`;
    }

    // Always include contextual suggestions (supplement AI ones if needed)
    const contextualSuggestions = generateContextualSuggestions();
    if (suggestions.length < 3) {
      // Add contextual suggestions to fill up to 4 total
      const existingTexts = new Set(suggestions.map(s => s.text));
      contextualSuggestions.forEach(s => {
        if (suggestions.length < 4 && !existingTexts.has(s.text)) {
          suggestions.push(s);
        }
      });
    } else if (suggestions.length === 0) {
      suggestions = contextualSuggestions;
    }

    // Find potential connections (items with similar tags or content)
    const connections: Array<{
      itemA: { id: string; title: string };
      itemB: { id: string; title: string };
      reason: string;
      sharedTags: string[];
      confidence: number;
    }> = [];
    for (let i = 0; i < Math.min(parsedItems.length, 30); i++) {
      for (let j = i + 1; j < Math.min(parsedItems.length, 30); j++) {
        const itemA = parsedItems[i];
        const itemB = parsedItems[j];

        // Check for shared tags
        const sharedTags = (itemA.tags as string[]).filter((t: string) => (itemB.tags as string[]).includes(t));
        if (sharedTags.length === 0) continue;

        // Calculate confidence score based on connection strength
        let confidence = 0;
        const reasons: string[] = [];

        // Tag similarity (each shared tag adds 20% confidence, capped)
        confidence += Math.min(60, sharedTags.length * 20);
        reasons.push(`Shared tags: ${sharedTags.join(', ')}`);

        // Content similarity (basic keyword match)
        const contentA = (itemA.content || '').toLowerCase();
        const contentB = (itemB.content || '').toLowerCase();
        const wordsA = contentA.split(/\s+/).filter((w: string) => w.length > 4);
        const matchingContentWords = wordsA.filter((w: string) => contentB.includes(w));
        if (matchingContentWords.length > 0) {
          confidence += Math.min(25, matchingContentWords.length * 5);
          reasons.push('Similar content');
        }

        // Title similarity
        const titleA = (itemA.title || '').toLowerCase();
        const titleB = (itemB.title || '').toLowerCase();
        const titleWordsA = titleA.split(/\s+/).filter((w: string) => w.length > 3);
        const matchingTitleWords = titleWordsA.filter((w: string) => titleB.includes(w));
        if (matchingTitleWords.length > 0) {
          confidence += Math.min(15, matchingTitleWords.length * 5);
          reasons.push('Similar title');
        }

        // Same type bonus
        if (itemA.type === itemB.type) {
          confidence += 5;
        }

        confidence = Math.min(100, confidence);

        connections.push({
          itemA: { id: itemA.id, title: itemA.title },
          itemB: { id: itemB.id, title: itemB.title },
          reason: reasons.join('; '),
          sharedTags,
          confidence,
        });
      }
      if (connections.length >= 5) break;
    }

    // Sort by confidence descending
    connections.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      stats,
      trends,
      staleItems,
      recentItems,
      topTags,
      insight,
      suggestions,
      connections: connections.slice(0, 5),
      weeklyData,
      projects: projectsData,
      productivity,
    });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to generate insights' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[POST /api/ai/insights]',
      error,
    });
  }
}
