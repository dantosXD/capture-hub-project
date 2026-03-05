import { NextRequest, NextResponse } from 'next/server';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';
import { getDashboardOverview } from '@/lib/dashboard-overview';
import { generateInsights } from '@/ai/ai-service';

export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'standard' });
  if (!security.success) {
    return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });
  }

  try {
    const overview = await getDashboardOverview();
    const aiInsight = await generateInsights({
      stats: overview.stats,
      topTags: overview.topTags,
      recentTitles: overview.recentItems.map((item) => item.title),
    });

    const aiSuggestions: Array<{ text: string; action: string; target?: string }> = aiInsight.suggestions.map((text) => ({
      text,
      action: 'navigate',
      target: 'inbox',
    }));
    const existing = new Set(aiSuggestions.map((suggestion) => suggestion.text));
    const suggestions: Array<{ text: string; action: string; target?: string }> = [...aiSuggestions];

    for (const suggestion of overview.suggestions) {
      if (suggestions.length >= 4) break;
      if (existing.has(suggestion.text)) continue;
      suggestions.push(suggestion);
    }

    return NextResponse.json({
      ...overview,
      insight: aiInsight.insight || overview.insight,
      suggestions,
      meta: aiInsight.meta ?? null,
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    return apiError(
      message === 'Internal server error' ? 'Failed to generate insights' : message,
      status,
      {
        details: process.env.NODE_ENV === 'production' ? undefined : details,
        logPrefix: '[POST /api/ai/insights]',
        error,
      },
    );
  }
}
