import { type AIProviderType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { createAIConnection } from '@/lib/ai-config';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

function isProviderType(value: unknown): value is AIProviderType {
  return value === 'OPENAI_COMPATIBLE' || value === 'ZAI';
}

export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) {
    return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label) {
      return NextResponse.json({ error: 'Connection label is required' }, { status: 400 });
    }

    if (!isProviderType(body.providerType)) {
      return NextResponse.json({ error: 'Invalid provider type' }, { status: 400 });
    }

    const connection = await createAIConnection({
      label,
      providerType: body.providerType,
      baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : null,
      apiKey: typeof body.apiKey === 'string' ? body.apiKey : null,
      isLocal: typeof body.isLocal === 'boolean' ? body.isLocal : undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
      chatModel: typeof body.chatModel === 'string' ? body.chatModel : null,
      visionModel: typeof body.visionModel === 'string' ? body.visionModel : null,
      embeddingModel: typeof body.embeddingModel === 'string' ? body.embeddingModel : null,
    });

    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('APP_ENCRYPTION_KEY')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const { message, status, details } = classifyError(error);
    return apiError(
      message === 'Internal server error' ? 'Failed to create AI connection' : message,
      status,
      {
        details: process.env.NODE_ENV === 'production' ? undefined : details,
        logPrefix: '[POST /api/settings/ai/connections]',
        error,
      },
    );
  }
}
