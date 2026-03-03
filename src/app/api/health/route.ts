import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isWebSocketServerRunning, getConnectedDevicesCount } from "@/lib/websocket";
import { apiError, classifyError } from "@/lib/api-route-handler";
import { getProviderStatus } from "@/ai/provider-registry";
import { getEmbeddingStats } from "@/ai/embedding-pipeline";
import { getRAGStatus } from "@/ai/rag-engine";
import { detectDatabaseProvider } from "@/lib/db-config";
import { isAIConfigured } from "@/lib/ai";

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

    // AI provider status (Project Omni P4)
    const aiProvider = getProviderStatus();
    const embeddingStats = getEmbeddingStats();
    const ragStatus = getRAGStatus();

    // Database provider info (Project Omni P2)
    const dbProvider = detectDatabaseProvider();

    return NextResponse.json({
      status: "healthy",
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
    const classified = classifyError(error);
    return apiError('Health check failed', classified.status, {
      details: classified.details,
      logPrefix: '[GET /api/health]',
      error,
    });
  }
}
