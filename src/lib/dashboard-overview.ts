import { db } from './db';
import { safeParseTags } from './parse-utils';

export interface DashboardStats {
  total: number;
  inbox: number;
  archived: number;
  today: number;
  thisWeek: number;
  lastWeek: number;
  stale: number;
  processingRate: number;
  avgProcessingTime: number;
}

interface TrendInfo {
  current: number;
  previous: number;
  change: number | null;
  direction: 'up' | 'down';
}

export interface DashboardOverview {
  stats: DashboardStats;
  trends: {
    total: TrendInfo;
    inbox: TrendInfo;
    captures: TrendInfo;
    processingRate: TrendInfo;
  };
  staleItems: Array<{ id: string; title: string; type: string; createdAt: string }>;
  recentItems: Array<{ id: string; title: string; type: string; createdAt: string }>;
  topTags: Array<{ tag: string; count: number }>;
  insight: string;
  suggestions: Array<{ text: string; action: string; target?: string }>;
  connections: Array<{
    itemA: { id: string; title: string };
    itemB: { id: string; title: string };
    reason: string;
    sharedTags: string[];
    confidence: number;
  }>;
  weeklyData: Array<{ date: string; count: number }>;
  projects: Array<{ id: string; name: string; itemCount: number; color: string; status: string }>;
  productivity: {
    capturesPerDay: number;
    archiveRate: number;
    staleRate: number;
  };
  isFirstRun: boolean;
  untaggedItems: number;
  itemsWithoutProjects: number;
}

type RawItem = {
  id: string;
  title: string;
  type: string;
  tags: string | null;
  status: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
  projectId: string | null;
  processedAt: string | null;
};

type TrendItem = {
  status: string;
  createdAt: string;
};

function calcPercentChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function buildContextualSuggestions(input: {
  stats: DashboardStats;
  projectsCount: number;
  untaggedItems: number;
  itemsWithoutProjects: number;
}): Array<{ text: string; action: string; target?: string }> {
  const { stats, projectsCount, untaggedItems, itemsWithoutProjects } = input;
  const suggestions: Array<{ text: string; action: string; target?: string }> = [];

  if (stats.stale > 0) {
    suggestions.push({
      text: `Process ${stats.stale} stale item${stats.stale > 1 ? 's' : ''} older than 7 days`,
      action: 'navigate',
      target: 'inbox',
    });
  }

  if (stats.inbox > 10) {
    suggestions.push({
      text: `Review ${stats.inbox} items in your inbox`,
      action: 'navigate',
      target: 'inbox',
    });
  }

  if (stats.processingRate < 30 && stats.total > 5) {
    suggestions.push({
      text: 'Archive processed items to improve productivity',
      action: 'navigate',
      target: 'archived',
    });
  }

  if (stats.today === 0 && stats.thisWeek < 5) {
    suggestions.push({
      text: 'Capture your first idea today',
      action: 'openCapture',
      target: 'quick',
    });
  }

  if (projectsCount > 0 && itemsWithoutProjects > 5) {
    suggestions.push({
      text: `Assign ${itemsWithoutProjects} items to projects`,
      action: 'navigate',
      target: 'projects',
    });
  }

  if (untaggedItems > 5) {
    suggestions.push({
      text: `Add tags to ${untaggedItems} untagged item${untaggedItems > 1 ? 's' : ''}`,
      action: 'navigate',
      target: 'inbox',
    });
  }

  return suggestions.slice(0, 4);
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const items = await db.$queryRawUnsafe<RawItem[]>(
    'SELECT id, title, type, tags, status, content, createdAt, updatedAt, projectId, processedAt FROM CaptureItem WHERE status != \'trash\' ORDER BY createdAt DESC LIMIT 100'
  );

  const parsedItems = items.map((item) => ({
    ...item,
    tags: safeParseTags(item.tags),
  }));

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
  const staleDate = new Date(todayStart);
  staleDate.setUTCDate(staleDate.getUTCDate() - 7);

  const stats: DashboardStats = {
    total: parsedItems.length,
    inbox: parsedItems.filter((item) => item.status === 'inbox').length,
    archived: parsedItems.filter((item) => item.status === 'archived').length,
    today: parsedItems.filter((item) => new Date(item.createdAt) >= todayStart).length,
    thisWeek: parsedItems.filter((item) => new Date(item.createdAt) >= weekStart).length,
    lastWeek: parsedItems.filter((item) => {
      const date = new Date(item.createdAt);
      return date >= lastWeekStart && date < weekStart;
    }).length,
    stale: parsedItems.filter((item) => item.status === 'inbox' && new Date(item.updatedAt) < staleDate).length,
    processingRate: 0,
    avgProcessingTime: 0,
  };

  if (stats.total > 0) {
    stats.processingRate = Math.round((stats.archived / stats.total) * 100);
  }

  const allItemsForTrends = await db.$queryRawUnsafe<TrendItem[]>(
    'SELECT status, createdAt FROM CaptureItem'
  );

  const itemsExistingLastWeek = allItemsForTrends.filter((item) => new Date(item.createdAt) < weekStart);
  const lastWeekTotal = itemsExistingLastWeek.length;
  const lastWeekInbox = itemsExistingLastWeek.filter((item) => item.status === 'inbox').length;
  const lastWeekArchived = itemsExistingLastWeek.filter((item) => item.status === 'archived').length;
  const lastWeekProcessingRate = lastWeekTotal > 0 ? Math.round((lastWeekArchived / lastWeekTotal) * 100) : 0;

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
      direction: stats.inbox <= lastWeekInbox ? 'up' as const : 'down' as const,
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

  const staleItems = parsedItems
    .filter((item) => item.status === 'inbox' && new Date(item.updatedAt) < staleDate)
    .slice(0, 5)
    .map((item) => ({ id: item.id, title: item.title, type: item.type, createdAt: item.createdAt }));

  const recentItems = parsedItems.slice(0, 10).map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    createdAt: item.createdAt,
  }));

  const tagCounts: Record<string, number> = {};
  parsedItems.forEach((item) => {
    item.tags.forEach((tag: string) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }));

  const weeklyData: Array<{ date: string; count: number }> = [];
  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(todayStart);
    date.setUTCDate(date.getUTCDate() - index);
    const dateStr = date.toISOString().split('T')[0];
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    const count = parsedItems.filter((item) => {
      const itemDate = new Date(item.createdAt);
      return itemDate >= date && itemDate < nextDate;
    }).length;

    weeklyData.push({ date: dateStr, count });
  }

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

  const projectsData = projects.map((project) => ({
    id: project.id,
    name: project.name,
    color: project.color,
    status: project.status,
    itemCount: project._count.items,
  }));

  const productivity = {
    capturesPerDay: Math.round((stats.thisWeek / (weeklyData.filter((day) => day.count > 0).length || 1)) * 10) / 10,
    archiveRate: stats.processingRate,
    staleRate: stats.total > 0 ? Math.round((stats.stale / stats.total) * 100) : 0,
  };

  const connections: DashboardOverview['connections'] = [];
  for (let index = 0; index < Math.min(parsedItems.length, 30); index += 1) {
    for (let nestedIndex = index + 1; nestedIndex < Math.min(parsedItems.length, 30); nestedIndex += 1) {
      const itemA = parsedItems[index];
      const itemB = parsedItems[nestedIndex];
      const sharedTags = itemA.tags.filter((tag: string) => itemB.tags.includes(tag));
      if (sharedTags.length === 0) continue;

      let confidence = Math.min(60, sharedTags.length * 20);
      const reasons = [`Shared tags: ${sharedTags.join(', ')}`];

      const contentA = (itemA.content || '').toLowerCase();
      const contentB = (itemB.content || '').toLowerCase();
      const matchingContentWords = contentA
        .split(/\s+/)
        .filter((word: string) => word.length > 4)
        .filter((word: string) => contentB.includes(word));

      if (matchingContentWords.length > 0) {
        confidence += Math.min(25, matchingContentWords.length * 5);
        reasons.push('Similar content');
      }

      const titleA = itemA.title.toLowerCase();
      const titleB = itemB.title.toLowerCase();
      const matchingTitleWords = titleA
        .split(/\s+/)
        .filter((word: string) => word.length > 3)
        .filter((word: string) => titleB.includes(word));

      if (matchingTitleWords.length > 0) {
        confidence += Math.min(15, matchingTitleWords.length * 5);
        reasons.push('Similar title');
      }

      if (itemA.type === itemB.type) {
        confidence += 5;
      }

      connections.push({
        itemA: { id: itemA.id, title: itemA.title },
        itemB: { id: itemB.id, title: itemB.title },
        reason: reasons.join('; '),
        sharedTags,
        confidence: Math.min(100, confidence),
      });
    }

    if (connections.length >= 5) break;
  }

  connections.sort((left, right) => right.confidence - left.confidence);

  const untaggedItems = parsedItems.filter((item) => item.tags.length === 0).length;
  const itemsWithoutProjects = parsedItems.filter((item) => !item.projectId).length;
  const contextualSuggestions = buildContextualSuggestions({
    stats,
    projectsCount: projectsData.length,
    untaggedItems,
    itemsWithoutProjects,
  });

  return {
    stats,
    trends,
    staleItems,
    recentItems,
    topTags,
    insight: stats.stale > 0
      ? `You have ${stats.stale} items that have not been processed in over a week.`
      : stats.total === 0
      ? 'Start capturing ideas and Capture Hub will begin building your recall surface.'
      : `You have captured ${stats.thisWeek} items this week. Keep the flow going.`,
    suggestions: contextualSuggestions,
    connections: connections.slice(0, 5),
    weeklyData,
    projects: projectsData,
    productivity,
    isFirstRun: parsedItems.length === 0,
    untaggedItems,
    itemsWithoutProjects,
  };
}
