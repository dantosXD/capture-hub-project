import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getConnectedDevices } from '@/lib/websocket';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

/**
 * GET /api/devices
 * Get list of currently connected devices
 */
export async function GET(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    // Get devices from in-memory WebSocket connections (currently connected)
    const memDevices = getConnectedDevices();
    const connectedSocketIds = new Set(memDevices.map(d => d.socketId));

    // Get devices from database (includes all devices, including recently disconnected)
    const dbDevices = await db.connectedDevice.findMany({
      orderBy: { connectedAt: 'desc' }
    });

    // Consolidate: single devices array with connected: boolean per device
    const devices = dbDevices.map(device => ({
      ...device,
      connected: connectedSocketIds.has(device.socketId),
    }));

    return NextResponse.json({ devices });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[GET /api/devices]', error });
  }
}
