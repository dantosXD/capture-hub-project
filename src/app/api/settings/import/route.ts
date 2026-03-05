import { NextRequest, NextResponse } from 'next/server';
import { importSettingsData, previewImportData } from '@/lib/settings-data';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) {
    return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || !body.data || typeof body.data !== 'object') {
      return NextResponse.json({ error: 'Import payload is required' }, { status: 400 });
    }

    const dryRun = body.dryRun === true;
    const result = dryRun ? await previewImportData(body.data) : await importSettingsData(body.data);

    return NextResponse.json({
      dryRun,
      ...result,
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    return apiError(
      message === 'Internal server error' ? 'Failed to import settings data' : message,
      status,
      {
        details: process.env.NODE_ENV === 'production' ? undefined : details,
        logPrefix: '[POST /api/settings/import]',
        error,
      },
    );
  }
}
