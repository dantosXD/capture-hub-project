import { NextRequest, NextResponse } from 'next/server';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';
import { getDashboardOverview } from '@/lib/dashboard-overview';

export async function GET(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
  if (!security.success) {
    return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });
  }

  try {
    const overview = await getDashboardOverview();
    return NextResponse.json(overview);
  } catch (error) {
    const { message, status, details } = classifyError(error);
    return apiError(
      message === 'Internal server error' ? 'Failed to load dashboard overview' : message,
      status,
      {
        details: process.env.NODE_ENV === 'production' ? undefined : details,
        logPrefix: '[GET /api/dashboard/overview]',
        error,
      },
    );
  }
}
