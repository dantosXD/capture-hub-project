import { NextRequest, NextResponse } from 'next/server';
import { generateSummary } from '@/lib/ai';
import { validateRequest } from '@/lib/api-security';
import { apiError, classifyError } from '@/lib/api-route-handler';

/**
 * AI Bulk Summarization Endpoint
 * POST /api/ai/bulk-summary
 *
 * Generates a combined summary for multiple items
 */
export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'standard' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const body = await request.json();
    const { items, maxLength = 5 } = body;

    // Validate input
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (items.length > 20) {
      return NextResponse.json(
        { error: 'Cannot summarize more than 20 items at once' },
        { status: 400 }
      );
    }

    // Combine all content into a single summary request
    const combinedContent = items
      .map((item, idx) => {
        const title = item.title || `Item ${idx + 1}`;
        const content = item.content || '';
        return `## ${title}\n${content}`;
      })
      .join('\n\n---\n\n');

    // Generate summary of all items
    const summary = await generateSummary(combinedContent, maxLength);

    return NextResponse.json({
      summary,
      itemCount: items.length,
      totalLength: combinedContent.length,
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[POST /api/ai/bulk-summary]', error });
  }
}
