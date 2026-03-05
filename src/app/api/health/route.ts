import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isWebSocketServerRunning, getConnectedDevicesCount } from "@/lib/websocket";
import { apiError, classifyError } from "@/lib/api-route-handler";
import { getProviderStatus } from "@/ai/provider-registry";
import { getEmbeddingStats } from "@/ai/embedding-pipeline";
import { getRAGStatus } from "@/ai/rag-engine";
import { detectDatabaseProvider } from "@/lib/db-config";
import { isAIConfigured } from "@/lib/ai";
import { validateRequest } from "@/lib/api-security";

export async function GET(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

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

    const overallStatus = dbStatus === "connected" ? "healthy" : "degraded";

    // In production, strip sensitive infrastructure details from response
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ status: overallStatus, timestamp: new Date().toISOString() });
    }

    // In development, return full details
    // AI provider status (Project Omni P4)
    const aiProvider = getProviderStatus();
    const embeddingStats = getEmbeddingStats();
    const ragStatus = getRAGStatus();

    // Database provider info (Project Omni P2)
    const dbProvider = detectDatabaseProvider();

    return NextResponse.json({
      status: overallStatus,
      database: {
        status: dbStatus,
        provider: dbProvider,
        tables: tables
      },
      websocket: {
        status: wsStatus,
        connectedDevices: connectedDevices,
        path: "/ws"
      },
      ai: {
        configured: isAIConfigured(),
        provider: aiProvider.defaultProvider,
        availableProviders: aiProvider.availableProviders,
        embeddings: embeddingStats,
        rag: ragStatus,
      },
      omni: {
        version: "1.0.0",
        modules: ["contracts", "platform", "ai", "ux-hooks"],
      }
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError('Health check failed', status, { details: safeDetails, logPrefix: '[GET /api/health]', error });
  }
}
