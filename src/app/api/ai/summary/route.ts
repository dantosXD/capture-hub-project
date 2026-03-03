import { NextRequest, NextResponse } from 'next/server';
import { generateSummary } from '@/lib/ai';

// AI Content Summarization Endpoint
// POST /api/ai/summary
// Generates concise 1-3 sentence summaries of long-form content

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, maxLength = 3 } = body;

    // Validate content exists
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate maxLength parameter
    if (maxLength && (typeof maxLength !== 'number' || maxLength < 1 || maxLength > 10)) {
      return NextResponse.json(
        { error: 'maxLength must be a number between 1 and 10' },
        { status: 400 }
      );
    }

    // Truncate content if too long (API limits)
    const truncatedContent = content.length > 10000
      ? content.substring(0, 10000) + '...'
      : content;

    // Generate summary
    const summary = await generateSummary(truncatedContent);

    if (!summary) {
      return NextResponse.json(
        { error: 'Failed to generate summary' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      summary,
      originalLength: content.length,
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
