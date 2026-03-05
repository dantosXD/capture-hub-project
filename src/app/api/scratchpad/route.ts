import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';
import { validateId, sanitizeTitle } from '@/lib/sanitization';
import { safeParseTags } from '@/lib/parse-utils';
import { broadcastStatsUpdated } from '@/lib/ws-broadcast';

/**
 * Scratchpad API
 * GET /api/scratchpad — load the active scratchpad document (read-only, returns 404 if none)
 * PUT /api/scratchpad — save/update scratchpad content
 */

export async function GET(request: NextRequest) {
    const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
    if (!security.success) {
        return NextResponse.json({ error: security.error }, { status: security.status });
    }

    try {
        // Pure read — no create side-effect. Return 404 if no scratchpad exists.
        const scratchpad = await db.captureItem.findFirst({
            where: { type: 'scratchpad' },
            orderBy: { updatedAt: 'desc' },
        });

        if (!scratchpad) {
            return NextResponse.json({ error: 'No scratchpad found' }, { status: 404 });
        }

        return NextResponse.json({
            id: scratchpad.id,
            title: scratchpad.title,
            content: scratchpad.content || '',
            tags: safeParseTags(scratchpad.tags),
            updatedAt: scratchpad.updatedAt.toISOString(),
        });
    } catch (error) {
        const { message, status } = classifyError(error);
        const safeDetails = process.env.NODE_ENV === 'production' ? undefined : classifyError(error).details;
        return apiError(message, status, {
            details: safeDetails,
            logPrefix: '[GET /api/scratchpad]',
            error,
        });
    }
}

export async function PUT(request: NextRequest) {
    const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
    if (!security.success) {
        return NextResponse.json({ error: security.error }, { status: security.status });
    }

    try {
        const body = await request.json();
        const { id, title, content, tags } = body;

        // Validate id from request body
        let validatedId: string;
        try {
            validatedId = validateId(id);
        } catch {
            return NextResponse.json({ error: 'Invalid or missing scratchpad ID' }, { status: 400 });
        }

        // Fetch the item and verify it is actually a scratchpad (IDOR fix)
        const existing = await db.captureItem.findUnique({
            where: { id: validatedId },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Scratchpad not found' }, { status: 404 });
        }

        if (existing.type !== 'scratchpad') {
            return NextResponse.json({ error: 'Forbidden: item is not a scratchpad' }, { status: 403 });
        }

        // Sanitize inputs
        let sanitizedTitle: string;
        try {
            sanitizedTitle = sanitizeTitle(title || 'Scratchpad');
        } catch {
            sanitizedTitle = 'Scratchpad';
        }

        // Validate tags as an array before JSON.stringify
        const sanitizedTags = Array.isArray(tags) ? tags : [];

        const updated = await db.captureItem.update({
            where: { id: validatedId },
            data: {
                title: sanitizedTitle,
                content: content || '',
                tags: JSON.stringify(sanitizedTags),
            },
        });

        // Broadcast stats update after successful save
        broadcastStatsUpdated({ type: 'capture', timestamp: updated.updatedAt.toISOString() });

        return NextResponse.json({
            id: updated.id,
            title: updated.title,
            content: updated.content || '',
            updatedAt: updated.updatedAt.toISOString(),
        });
    } catch (error) {
        const { message, status } = classifyError(error);
        const safeDetails = process.env.NODE_ENV === 'production' ? undefined : classifyError(error).details;
        return apiError(message, status, {
            details: safeDetails,
            logPrefix: '[PUT /api/scratchpad]',
            error,
        });
    }
}
