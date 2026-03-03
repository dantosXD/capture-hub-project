import { NextRequest, NextResponse } from 'next/server';
import { captureWebPage, fetchWebPageBasic, suggestTags, isAIConfigured } from '@/lib/ai';
import { db } from '@/lib/db';
import { broadcastItemCreated, broadcastStatsUpdated } from '@/lib/ws-broadcast';
import { apiError, classifyError } from '@/lib/api-route-handler';

// Validate URL format
function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// POST - Capture web page content
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, saveToInbox = true } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL format
    if (!isValidUrl(url)) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Try AI capture first, fall back to basic fetch if AI not available
    let webContent;
    if (isAIConfigured()) {
      try {
        webContent = await captureWebPage(url);
      } catch (aiError: any) {
        // If AI fails for other reasons, fall back to basic fetch
        console.log('AI capture failed, using basic fetch for:', url, aiError?.message);
        webContent = await fetchWebPageBasic(url);
      }
    } else {
      console.log('AI not configured, using basic fetch for:', url);
      webContent = await fetchWebPageBasic(url);
    }

    // Auto-suggest tags based on content
    const tags = await suggestTags(
      webContent.content || webContent.description,
      webContent.title
    );

    const now = new Date().toISOString();
    const metadata = {
      favicon: webContent.favicon,
      description: webContent.description,
      capturedAt: now,
    };

    // Save to inbox if requested
    if (saveToInbox) {
      const item = await db.captureItem.create({
        data: {
          type: 'webpage',
          title: webContent.title,
          content: webContent.content,
          extractedText: null,
          imageUrl: webContent.favicon || null,
          sourceUrl: url,
          metadata: JSON.stringify(metadata),
          tags: JSON.stringify(tags),
          priority: 'none',
          status: 'inbox',
          assignedTo: null,
          dueDate: null,
          createdAt: now,
          updatedAt: now,
        },
      });

      // Broadcast item creation to all connected clients
      try {
        broadcastItemCreated({
          id: item.id,
          type: item.type,
          title: item.title,
          content: item.content,
          extractedText: item.extractedText,
          imageUrl: item.imageUrl,
          sourceUrl: item.sourceUrl,
          metadata,
          tags,
          priority: item.priority,
          status: item.status,
          assignedTo: item.assignedTo,
          projectId: item.projectId,
          dueDate: item.dueDate,
          reminder: item.reminder,
          reminderSent: item.reminderSent ?? false,
          pinned: item.pinned ?? false,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        });
      } catch (broadcastError) {
        console.error('[POST /api/capture/webpage] Broadcast failed (non-fatal):', broadcastError);
      }

      // Broadcast stats update
      try {
        broadcastStatsUpdated({
          type: 'capture',
          timestamp: now,
        });
      } catch (broadcastError) {
        console.error('[POST /api/capture/webpage] Stats broadcast failed (non-fatal):', broadcastError);
      }

      return NextResponse.json({
        success: true,
        ...webContent,
        tags,
        item: {
          ...item,
          tags,
          metadata,
        },
      });
    }

    return NextResponse.json({
      success: true,
      ...webContent,
      tags,
    });
  } catch (error: any) {
    // For web capture errors, preserve the specific error message
    const errorMessage = error?.message || 'Failed to capture web page';

    // Determine appropriate status code
    let status = 500;
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      status = 404;
    } else if (errorMessage.includes('Cannot access') || errorMessage.includes('certificate')) {
      status = 400;
    } else if (errorMessage.includes('Server error')) {
      status = 502;
    } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      status = 504;
    }

    return apiError(errorMessage, status, {
      logPrefix: '[POST /api/capture/webpage]',
      error,
    });
  }
}
