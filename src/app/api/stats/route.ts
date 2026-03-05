import { NextRequest, NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/query-optimized';
import { db } from '@/lib/db';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

export async function GET(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const [stats, projectCount] = await Promise.all([
      getDashboardStats(),
      db.project.count(),
    ]);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    // Calculate processing rate
    const processingRate = stats.total > 0 ? (stats.processed / stats.total * 100).toFixed(1) : '0.0';

    // Helper function to calculate percentage change
    const calculatePercentChange = (current: number, previous: number): number | null => {
      if (previous > 0) {
        return parseFloat(((current - previous) / previous * 100).toFixed(1));
      } else if (current > 0) {
        return 100; // New items this week, none last week
      }
      return null; // No items either week
    };

    // Helper function to determine trend direction
    const getTrendDirection = (percentChange: number | null): 'up' | 'down' | 'stable' => {
      if (percentChange === null) return 'stable';
      if (percentChange > 5) return 'up';
      if (percentChange < -5) return 'down';
      return 'stable';
    };

    // Feature #372: Calculate week-over-week trends
    const weekOverWeek = calculatePercentChange(stats.thisWeek, stats.lastWeek);
    const weekOverWeekTrend = getTrendDirection(weekOverWeek);

    // Feature #372: Inbox items week-over-week
    const inboxWeekOverWeek = calculatePercentChange(stats.inboxThisWeek, stats.inboxLastWeek);
    const inboxWeekOverWeekTrend = getTrendDirection(inboxWeekOverWeek);

    // Feature #372: Processing rate comparison
    const processingRateThisWeek = stats.thisWeek > 0 ? (stats.processedThisWeek / stats.thisWeek * 100).toFixed(1) : '0.0';
    const processingRateLastWeek = stats.lastWeek > 0 ? (stats.processedLastWeek / stats.lastWeek * 100).toFixed(1) : '0.0';
    const processingRateChange = calculatePercentChange(
      parseFloat(processingRateThisWeek),
      parseFloat(processingRateLastWeek)
    );
    const processingRateTrend = getTrendDirection(processingRateChange);

    const responseStats = {
      inbox: stats.inbox,
      assigned: stats.assigned,
      projects: projectCount,
      archived: stats.archived,
      trash: stats.trash,
      total: stats.total,
      // Backward-compatible aliases
      totalItems: stats.total,
      inboxCount: stats.inbox,
      today: stats.today,
      todayCount: stats.today,
      thisWeek: stats.thisWeek,
      weekCount: stats.thisWeek,
      lastWeek: stats.lastWeek,
      // Feature #372: Total items week-over-week
      weekOverWeek,
      weekOverWeekTrend,
      // Feature #372: Inbox items week-over-week
      inboxThisWeek: stats.inboxThisWeek,
      inboxLastWeek: stats.inboxLastWeek,
      inboxWeekOverWeek,
      inboxWeekOverWeekTrend,
      // Feature #372: Processing rate comparison
      processedThisWeek: stats.processedThisWeek,
      processedLastWeek: stats.processedLastWeek,
      processingRateThisWeek,
      processingRateLastWeek,
      processingRateChange,
      processingRateTrend,
      // Existing fields
      processed: stats.processed,
      processingRate,
      stale: stats.stale,
      staleItems: stats.stale,
      recentItems: stats.recentItems,
      // Retained for legacy clients expecting this field
      topTags: [],
    };

    return NextResponse.json(responseStats);
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[GET /api/stats]', error });
  }
}
