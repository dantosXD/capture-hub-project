import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getConnectedDevices } from '@/lib/websocket';
import { apiError, classifyError } from '@/lib/api-route-handler';

/**
 * GET /api/devices
 * Get list of currently connected devices
 */
export async function GET(request: NextRequest) {
  try {
    // Get devices from in-memory WebSocket connections
    const memDevices = getConnectedDevices();

    // Get devices from database (includes all devices, including recently disconnected)
    const dbDevices = await db.connectedDevice.findMany({
      orderBy: { connectedAt: 'desc' }
    });

    return NextResponse.json({
      devices: memDevices,
      connected: memDevices,
      all: dbDevices,
      connectedCount: memDevices.length
    });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to fetch devices' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[GET /api/devices]',
      error,
    });
  }
}
