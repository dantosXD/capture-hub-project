import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError, classifyError } from '@/lib/api-route-handler';

/**
 * Scratchpad API
 * GET /api/scratchpad — load the active scratchpad document
 * PUT /api/scratchpad — save/update scratchpad content
 */

export async function GET() {
    try {
        // Find the most recent scratchpad item, or create a default one
        let scratchpad = await db.captureItem.findFirst({
            where: { type: 'scratchpad' },
            orderBy: { updatedAt: 'desc' },
        });

        if (!scratchpad) {
            // Create a default scratchpad
            scratchpad = await db.captureItem.create({
                data: {
                    type: 'scratchpad',
                    title: 'Scratchpad',
                    content: '',
                    tags: '[]',
                    status: 'inbox',
                },
            });
        }

        return NextResponse.json({
            id: scratchpad.id,
            title: scratchpad.title,
            content: scratchpad.content || '',
            tags: (() => {
                try {
                    return JSON.parse(scratchpad!.tags || '[]');
                } catch {
                    return [];
                }
            })(),
            updatedAt: scratchpad.updatedAt.toISOString(),
        });
    } catch (error) {
        const classified = classifyError(error);
        return apiError(classified.message, classified.status, {
            logPrefix: '[GET /api/scratchpad]',
            error,
        });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, title, content, tags } = body;

        if (!id) {
            return NextResponse.json({ error: 'Scratchpad ID is required' }, { status: 400 });
        }

        const updated = await db.captureItem.update({
            where: { id },
            data: {
                title: title || 'Scratchpad',
                content: content || '',
                tags: JSON.stringify(tags || []),
            },
        });

        return NextResponse.json({
            id: updated.id,
            title: updated.title,
            content: updated.content || '',
            updatedAt: updated.updatedAt.toISOString(),
        });
    } catch (error) {
        const classified = classifyError(error);
        return apiError(classified.message, classified.status, {
            logPrefix: '[PUT /api/scratchpad]',
            error,
        });
    }
}
