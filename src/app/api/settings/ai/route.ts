import { NextRequest, NextResponse } from 'next/server';
import { getAISettings } from '@/lib/ai-config';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

export async function GET(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
  if (!security.success) {
    return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });
  }

  try {
    const settings = await getAISettings();
    return NextResponse.json(settings);
  } catch (error) {
    const { message, status, details } = classifyError(error);
    return apiError(
      message === 'Internal server error' ? 'Failed to load AI settings' : message,
      status,
      {
        details: process.env.NODE_ENV === 'production' ? undefined : details,
        logPrefix: '[GET /api/settings/ai]',
        error,
      },
    );
  }
}
