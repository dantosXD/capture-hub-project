import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromImage, suggestTags } from '@/lib/ai';
import { db } from '@/lib/db';
import { broadcastItemCreated, broadcastStatsUpdated } from '@/lib/ws-broadcast';
import { apiError, classifyError } from '@/lib/api-route-handler';

// POST - Process image and extract text using OCR
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, title, saveToInbox = true } = body;

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    // Extract text from image using VLM
    const extractedText = await extractTextFromImage(image);

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
          imageUrl: image,
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
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
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
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to process image' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[POST /api/capture/ocr]',
      error,
    });
  }
}
