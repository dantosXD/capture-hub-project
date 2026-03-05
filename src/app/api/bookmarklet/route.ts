import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { suggestTags, captureWebPage } from '@/lib/ai';
import { broadcastItemCreated, broadcastStatsUpdated } from '@/lib/ws-broadcast';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { downloadImage } from '@/lib/storage';

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
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host') || 'localhost:3000';
  const apiUrl = `${protocol}://${host}/api`;

  return NextResponse.json({
    status: 'ok',
    version: '2.0.0',
    message: 'Capture Hub Bookmarklet API',
    apiUrl,
  }, { headers: corsHeaders });
}

// POST - Capture content from bookmarklet
export async function POST(request: NextRequest) {
  try {
    const now = new Date().toISOString();
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
      ogImage,
      bodyText,
      isCode = false,
      // User-provided metadata
      tags: userTags,
      priority: userPriority,
      projectId: userProjectId,
    } = body;

    // Determine the title
    let finalTitle = title || pageTitle || 'Untitled Capture';

    // Build content based on type
    let finalContent = content || '';

    // If there's selected text and no explicit content, use it
    const formattedSelection = isCode ? `\`\`\`\n${selectedText}\n\`\`\`` : selectedText;
    if (selectedText && !content) {
      finalContent = formattedSelection;
    } else if (selectedText && content) {
      finalContent = formattedSelection + '\n\n' + content;
    }

    // Build metadata object
    const metadata: Record<string, unknown> = {
      capturedAt: now,
      source: 'bookmarklet',
    };

    // For webpage captures, fetch the full content
    if (type === 'webpage' && sourceUrl) {
      try {
        const webData = await captureWebPage(sourceUrl);
        finalContent = webData.content || bodyText || finalContent;
        finalTitle = title || webData.title || finalTitle;
        metadata.description = webData.description;
        if (!favicon) metadata.favicon = webData.favicon;
      } catch (e) {
        // Fallback to scraped body text if AI extraction fails
        if (bodyText) finalContent = bodyText;
        console.error('Failed to capture webpage:', e);
      }
    }

    // Add page metadata
    if (pageTitle) metadata.pageTitle = pageTitle;
    if (pageDescription) metadata.pageDescription = pageDescription;
    if (favicon) metadata.favicon = favicon;
    if (ogImage) metadata.ogImage = ogImage;
    if (bodyText && type !== 'webpage') metadata.bodyText = bodyText.slice(0, 1000);

    // Handle screenshot / image types
    let imageUrl: string | null = null;
    if ((type === 'screenshot' || type === 'image') && screenshot) {
      // Download the image natively to prevent link rot
      const downloadedPath = await downloadImage(screenshot, 'bk');
      imageUrl = downloadedPath || screenshot;
      metadata.captureMethod = type === 'image' ? 'page-image' : 'screenshot';
      if (!finalContent) finalContent = type === 'image' ? 'Image from page' : 'Screenshot capture';
    } else if (ogImage && type !== 'webpage') { // We also grab OG images for generic captures if needed
      metadata.ogImage = await downloadImage(ogImage, 'og') || ogImage;
    }

    // Build text for AI tag suggestion
    let tagText = finalContent || finalTitle;
    if (type === 'screenshot' || type === 'image') {
      tagText = `${type} ${finalContent || ''} ${finalTitle}`;
    }

    // Auto-suggest tags via AI, then merge with user-provided tags
    const aiTags = await suggestTags(tagText, finalTitle);

    // Add smart metadata tags from structured data or code detection
    const smartTags: string[] = [];
    if (isCode) smartTags.push('code');
    if (metadata.structuredType === 'Product') smartTags.push('product');
    if (metadata.structuredType === 'Recipe') smartTags.push('recipe');

    const userTagsArray: string[] = Array.isArray(userTags)
      ? userTags
      : typeof userTags === 'string'
        ? userTags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [];
    const mergedTags = Array.from(new Set([...userTagsArray, ...aiTags, ...smartTags]));

    // Validate priority
    const validPriorities = ['none', 'low', 'medium', 'high'];
    const priority = validPriorities.includes(userPriority) ? userPriority : 'none';

    // Use raw INSERT to bypass Prisma's DateTime coercion on return value (P2023 on existing bad rows)
    const itemId = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nowStr = now;

    await db.$executeRawUnsafe(
      `INSERT INTO CaptureItem (id, type, title, content, extractedText, imageUrl, sourceUrl, metadata, tags, priority, status, assignedTo, dueDate, reminder, reminderSent, pinned, projectId, processedAt, processedBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 'inbox', NULL, NULL, NULL, 0, 0, ?, NULL, NULL, ?, ?)`,
      itemId,
      type,
      finalTitle,
      finalContent || null,
      imageUrl,
      sourceUrl || null,
      JSON.stringify(metadata),
      JSON.stringify(mergedTags),
      priority,
      userProjectId || null,
      nowStr,
      nowStr,
    );

    // Synthetic item object for broadcast (avoids reading back the row)
    const item = {
      id: itemId,
      type,
      title: finalTitle,
      content: finalContent || null,
      extractedText: null,
      imageUrl,
      sourceUrl: sourceUrl || null,
      metadata: JSON.stringify(metadata),
      tags: JSON.stringify(mergedTags),
      priority,
      status: 'inbox',
      assignedTo: null,
      projectId: userProjectId || null,
      dueDate: null,
      reminder: null,
      reminderSent: false,
      pinned: false,
      processedAt: null,
      processedBy: null,
      createdAt: nowStr,
      updatedAt: nowStr,
    };


    // Broadcast to all connected clients (non-blocking)
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
        tags: mergedTags,
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
      broadcastStatsUpdated({ type: 'capture', timestamp: now });
    } catch (broadcastError) {
      console.error('[POST /api/bookmarklet] Stats broadcast failed (non-fatal):', broadcastError);
    }

    return NextResponse.json({
      success: true,
      item: { ...item, tags: mergedTags, metadata },
    }, { status: 201, headers: corsHeaders });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(
      classified.message === 'Internal server error' ? 'Failed to capture content' : classified.message,
      classified.status,
      { details: classified.details, logPrefix: '[POST /api/bookmarklet]', error, headers: corsHeaders }
    );
  }
}

