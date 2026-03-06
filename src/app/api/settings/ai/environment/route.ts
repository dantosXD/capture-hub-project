import { NextRequest, NextResponse } from 'next/server';
import {
  isAIEnvironmentKey,
  type UpdateAIEnvironmentVariableInput,
  updateAIEnvironmentVariables,
} from '@/lib/ai-config';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

export async function PATCH(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) {
    return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });
  }

  try {
    const body = await request.json();
    const variables = Array.isArray(body?.variables) ? body.variables : null;

    if (!variables) {
      return NextResponse.json({ error: 'variables array is required' }, { status: 400 });
    }

    const updates: UpdateAIEnvironmentVariableInput[] = variables.map((entry) => {
      if (!entry || typeof entry !== 'object' || !isAIEnvironmentKey(entry.key)) {
        throw new Error('Invalid AI environment variable entry');
      }

      return {
        key: entry.key,
        value: typeof entry.value === 'string' ? entry.value : null,
        clearOverride: entry.clearOverride === true,
      };
    });

    const environment = await updateAIEnvironmentVariables(updates);
    return NextResponse.json({ environment });
  } catch (error) {
    if (error instanceof Error && error.message.includes('APP_ENCRYPTION_KEY')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { message, status, details } = classifyError(error);
    return apiError(
      message === 'Internal server error' ? 'Failed to update AI environment settings' : message,
      status,
      {
        details: process.env.NODE_ENV === 'production' ? undefined : details,
        logPrefix: '[PATCH /api/settings/ai/environment]',
        error,
      },
    );
  }
}
