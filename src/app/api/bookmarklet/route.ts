import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { suggestTags, captureWebPage } from '@/lib/ai';
import { broadcastItemCreated, broadcastStatsUpdated } from '@/lib/ws-broadcast';
import { apiError, classifyError } from '@/lib/api-route-handler';

// CORS headers for bookmarklet requests from any origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// GET - Return bookmarklet status and configuration
export async function GET(request: NextRequest) {
  // Build API URL from request
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host') || 'localhost:3000';
  const apiUrl = `${protocol}://${host}/api`;

  return NextResponse.json({
    status: 'ok',
    version: '1.0.0',
    message: 'Capture Hub Bookmarklet API',
    apiUrl,
  }, { headers: corsHeaders });
}

// POST - Capture content from bookmarklet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type = 'note',
      title,
      content,
      sourceUrl,
      selectedText,
      pageTitle,
      pageDescription,
      favicon,
      screenshot,
    } = body;

    // Determine the title
    let finalTitle = title || pageTitle || 'Untitled Capture';
    
    // Build content based on type
    let finalContent = content || '';
    
    // If there's selected text, include it
    if (selectedText) {
      finalContent = selectedText + (finalContent ? '\n\n' + finalContent : '');
    }

    // Build metadata object
    const metadata: Record<string, unknown> = {
      capturedAt: new Date().toISOString(),
      source: 'bookmarklet',
    };

    // For webpage captures, fetch the full content
    if (type === 'webpage' && sourceUrl) {
      try {
        const webData = await captureWebPage(sourceUrl);
        finalContent = webData.content || finalContent;
        finalTitle = title || webData.title || finalTitle;
        metadata.description = webData.description;
        metadata.favicon = webData.favicon;
      } catch (e) {
        console.error('Failed to capture webpage:', e);
      }
    }

    // Add page metadata
    if (pageTitle) metadata.pageTitle = pageTitle;
    if (pageDescription) metadata.pageDescription = pageDescription;
    if (favicon) metadata.favicon = favicon;

    // Handle screenshot type - store the base64 image
    let imageUrl: string | null = null;
    if (type === 'screenshot' && screenshot) {
      imageUrl = screenshot;
      // Add screenshot-specific metadata
      metadata.captureMethod = 'screenshot';
      
      // If no content, add a default description for screenshots
      if (!finalContent) {
        finalContent = 'Screenshot capture';
      }
    }

    // Build text for tag suggestion
    let tagText = finalContent || finalTitle;
    if (type === 'screenshot') {
      // For screenshots, include type hint for better tag suggestions
      tagText = `screenshot image ${finalContent || ''} ${finalTitle}`;
    }

    // Auto-suggest tags
    const tags = await suggestTags(tagText, finalTitle);

    const item = await db.captureItem.create({
      data: {
        type,
        title: finalTitle,
        content: finalContent || null,
        extractedText: null,
        imageUrl,
        sourceUrl: sourceUrl || null,
        metadata: JSON.stringify(metadata),
        tags: JSON.stringify(tags),
        priority: 'none',
        status: 'inbox',
        assignedTo: null,
        dueDate: null,
      },
    });

    // Broadcast full item to all connected clients (non-blocking)
    try {
      broadcastItemCreated({
        id: item.id,
        type: item.type,
        title: item.title,
        content: item.content,
        extractedText: item.extractedText,
        imageUrl: item.imageUrl,
        sourceUrl: item.sourceUrl,
        metadata: metadata || null,
        tags: tags,
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
      console.error('[POST /api/bookmarklet] Broadcast failed (non-fatal):', broadcastError);
    }

    // Broadcast stats update (non-blocking)
    try {
      broadcastStatsUpdated({
        type: 'capture',
        timestamp: now,
      });
    } catch (broadcastError) {
      console.error('[POST /api/bookmarklet] Stats broadcast failed (non-fatal):', broadcastError);
    }

    return NextResponse.json({
      success: true,
      item: {
        ...item,
        tags,
        metadata,
      },
    }, { status: 201, headers: corsHeaders });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to capture content' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[POST /api/bookmarklet]',
      error,
      headers: corsHeaders,
    });
  }
}
