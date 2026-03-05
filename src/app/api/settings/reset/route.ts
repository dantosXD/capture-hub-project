import { NextRequest, NextResponse } from 'next/server';
import { clearAllSettingsData, getResetPreview } from '@/lib/settings-data';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) {
    return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;
    const summary = dryRun ? await getResetPreview() : await clearAllSettingsData();

    return NextResponse.json({
      dryRun,
      summary,
      note: 'Built-in default templates may be re-created when the Templates screen is opened again.',
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    return apiError(
      message === 'Internal server error' ? 'Failed to clear data' : message,
      status,
      {
        details: process.env.NODE_ENV === 'production' ? undefined : details,
        logPrefix: '[POST /api/settings/reset]',
        error,
      },
    );
  }
}
