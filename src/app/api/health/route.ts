import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isWebSocketServerRunning, getConnectedDevicesCount } from "@/lib/websocket";
import { apiError, classifyError } from "@/lib/api-route-handler";

export async function GET() {
  try {
    let dbStatus = "disconnected";
    let tables: string[] = [];

    // Check database connection
    await db.$queryRaw`SELECT 1`;
    dbStatus = "connected";

    // Get list of tables
    const result = await db.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `;
    tables = result.map(row => row.name);

    // Check WebSocket server status
    const wsRunning = isWebSocketServerRunning();
    const wsStatus = wsRunning ? "running" : "not_running";
    const connectedDevices = getConnectedDevicesCount();

    return NextResponse.json({
      status: "healthy",
      database: {
        status: dbStatus,
        tables: tables
      },
      websocket: {
        status: wsStatus,
        connectedDevices: connectedDevices,
        path: "/ws"
      }
    });
  } catch (error) {
    const classified = classifyError(error);
    return apiError('Health check failed', classified.status, {
      details: classified.details,
      logPrefix: '[GET /api/health]',
      error,
    });
  }
}
