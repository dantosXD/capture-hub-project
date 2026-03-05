import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromImage, suggestTags } from '@/lib/ai';
import { db } from '@/lib/db';
import { broadcastItemCreated, broadcastStatsUpdated } from '@/lib/ws-broadcast';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';
import { sanitizeBase64Image } from '@/lib/sanitization';

// POST - Process image and extract text using OCR
export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });

  try {
    const body = await request.json();
    const { image, title, saveToInbox = true } = body;

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    // Sanitize base64 image before processing
    const sanitizedImage = sanitizeBase64Image(image);
    if (!sanitizedImage) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    // Extract text from image using VLM
    const extractedText = await extractTextFromImage(sanitizedImage);

    // Auto-suggest tags based on extracted text
    const tags = extractedText ? await suggestTags(extractedText, title || 'OCR Capture') : [];

    const now = new Date().toISOString();

    // Save to inbox if requested
    if (saveToInbox) {
      const item = await db.captureItem.create({
        data: {
          type: 'ocr',
          title: title || 'OCR Capture',
          content: null,
          extractedText,
          imageUrl: sanitizedImage,
          sourceUrl: null,
          metadata: null,
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
          metadata: null,
          tags,
          priority: item.priority,
          status: item.status,
          assignedTo: item.assignedTo,
          projectId: item.projectId,
          dueDate: item.dueDate,
          reminder: item.reminder,
          reminderSent: item.reminderSent ?? false,
          pinned: item.pinned ?? false,
          createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
          updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
        });
      } catch (broadcastError) {
        console.error('[POST /api/capture/ocr] Broadcast failed (non-fatal):', broadcastError);
      }

      // Broadcast stats update
      try {
        broadcastStatsUpdated({
          type: 'capture',
          timestamp: now,
        });
      } catch (broadcastError) {
        console.error('[POST /api/capture/ocr] Stats broadcast failed (non-fatal):', broadcastError);
      }

      return NextResponse.json({
        success: true,
        extractedText,
        tags,
        item: {
          ...item,
          tags,
        },
      });
    }

    return NextResponse.json({
      success: true,
      extractedText,
      tags,
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    return apiError(message, status, { details: process.env.NODE_ENV === 'production' ? undefined : details, logPrefix: '[POST /api/capture/ocr]', error });
  }
}
