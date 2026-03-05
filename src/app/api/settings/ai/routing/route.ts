import { NextRequest, NextResponse } from 'next/server';
import { updateAIRouting } from '@/lib/ai-config';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

export async function PATCH(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) {
    return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });
  }

  try {
    const body = await request.json();
    const routing = await updateAIRouting({
      defaultAIConnectionId: typeof body.defaultAIConnectionId === 'string' ? body.defaultAIConnectionId : null,
      visionAIConnectionId: typeof body.visionAIConnectionId === 'string' ? body.visionAIConnectionId : null,
      embeddingAIConnectionId: typeof body.embeddingAIConnectionId === 'string' ? body.embeddingAIConnectionId : null,
      aiFallbackEnabled: body.aiFallbackEnabled !== false,
    });

    return NextResponse.json({ routing });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    return apiError(
      message === 'Internal server error' ? 'Failed to update AI routing' : message,
      status,
      {
        details: process.env.NODE_ENV === 'production' ? undefined : details,
        logPrefix: '[PATCH /api/settings/ai/routing]',
        error,
      },
    );
  }
}
