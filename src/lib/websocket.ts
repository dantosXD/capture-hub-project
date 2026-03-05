import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { WSEventType } from './ws-events';
import { loggers } from './logger';

type WSMessage = {
  type: string;
  data?: any;
  socketId?: string;
};

type WSServerWithClients = WebSocketServer & {
  clientMap: Map<string, WebSocket>;
  broadcast: (type: string, data: any, excludeSocket?: WebSocket) => void;
};

function sanitizeDeviceName(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 60);
}

// Use globalThis to make the WebSocket server accessible across the entire process
const globalForWebSocket = globalThis as unknown as {
  wsServer: WSServerWithClients | null | undefined;
};

// Per-socket heartbeat interval storage (WeakMap so GC can collect closed sockets)
const heartbeatMap = new WeakMap<WebSocket, NodeJS.Timeout>();

// Module-level shutdown flag — set to true before iterating clients during shutdown
let isShuttingDown = false;

/**
 * Initialize WebSocket server
 * Should be called when the HTTP server is created
 */
export function initializeWebSocketServer(httpServer: Server): WSServerWithClients {
  // Dev hot reload: if a server already exists, shut it down cleanly before creating a new one
  if (globalForWebSocket.wsServer) {
    loggers.server.debug('[WebSocket] Existing server found — shutting down before reinitializing (hot reload)');
    shutdownWebSocketServer().catch((err) => {
      loggers.server.error('[WebSocket] Error during hot-reload shutdown:', err instanceof Error ? err : new Error(String(err)));
    });
  }

  // Create WebSocket server in noServer mode so we can handle upgrade routing
  // in server.ts (allowing Next.js HMR websocket to work alongside our WS)
  const wss = new WebSocketServer({
    noServer: true,
  }) as WSServerWithClients;

  // Handle upgrade events - only accept connections to /ws path
  httpServer.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // Non-/ws upgrades are NOT handled here - they fall through to other listeners
  });

  // Initialize clients map (using clientMap to avoid conflict with ws.clients property)
  wss.clientMap = new Map<string, WebSocket>();

  // Add broadcast helper
  wss.broadcast = (type: string, data: any, excludeSocket?: WebSocket) => {
    if (isShuttingDown) return;

    const message = JSON.stringify({ type, data });

    wss.clientMap.forEach((ws) => {
      if (ws !== excludeSocket && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (err) {
          loggers.server.warn('[WebSocket] Broadcast send failed for client', { error: (err as Error).message });
        }
      }
    });

    loggers.server.debug(`[WebSocket] Broadcast: ${type} to ${wss.clientMap.size} clients`);
  };

  // Handle new connections
  wss.on('connection', async (ws: WebSocket, req) => {
    // Reject new connections if server is shutting down
    if ((wss as any).isShuttingDown === true) {
      loggers.server.debug('[WebSocket] Rejecting new connection during shutdown');
      ws.close(1001, 'Server is shutting down');
      return;
    }

    // Generate socket ID
    const socketId = `socket_${randomUUID()}`;

    const requestUrl = new URL(req.url || '', `http://${req.headers.host}`);

    // Get user agent for device name
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const deviceName = sanitizeDeviceName(requestUrl.searchParams.get('deviceName')) || parseDeviceName(userAgent);
    const deviceType = parseDeviceType(userAgent);
    const connectedAt = new Date().toISOString();

    // Store client in memory map
    wss.clientMap.set(socketId, ws);

    loggers.server.debug(`[WebSocket] Client connected: ${socketId} (${deviceName})`);

    // Attach metadata to ws instance
    (ws as any).socketId = socketId;
    (ws as any).deviceName = deviceName;
    (ws as any).deviceType = deviceType;
    (ws as any).connectedAt = connectedAt;
    (ws as any).isAlive = true;
    (ws as any).dbDeviceId = null; // Will store DB record ID

    try {
      // Register device in database
      const device = await db.connectedDevice.create({
        data: {
          socketId,
          deviceName,
          deviceType,
          lastSeen: connectedAt,
          connectedAt: connectedAt,
        }
      });

      // Store DB record ID for cleanup
      (ws as any).dbDeviceId = device.id;

      loggers.server.debug(`[WebSocket] Device registered in DB: ${device.id}`);
    } catch (error) {
      loggers.server.error('[WebSocket] Failed to register device in DB:', error instanceof Error ? error : new Error(String(error)));
    }

    // Send connection confirmation to client
    sendToClient(ws, {
      type: 'connected',
      data: {
        socketId,
        deviceName,
        deviceType,
        connectedAt
      }
    });

    // Broadcast device connection to other clients
    wss.broadcast(WSEventType.DEVICE_CONNECTED, {
      socketId,
      deviceName,
      deviceType,
      connectedAt
    }, ws);

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        handleMessage(ws, socketId, message, wss);
      } catch (error) {
        loggers.server.error('[WebSocket] Error parsing message:', error instanceof Error ? error : new Error(String(error)));
      }
    });

    // Handle pong responses (for heartbeat) - update lastSeen
    ws.on('pong', async () => {
      (ws as any).isAlive = true;

      // Update lastSeen in database
      const dbDeviceId = (ws as any).dbDeviceId;
      if (dbDeviceId) {
        try {
          await db.connectedDevice.update({
            where: { id: dbDeviceId },
            data: { lastSeen: new Date().toISOString() }
          });
        } catch (error) {
          loggers.server.error('[WebSocket] Failed to update lastSeen:', error instanceof Error ? error : new Error(String(error)));
        }
      }
    });

    // Handle disconnection
    ws.on('close', async () => {
      // Clear any per-socket heartbeat interval on close
      const socketHeartbeat = heartbeatMap.get(ws);
      if (socketHeartbeat !== undefined) {
        clearInterval(socketHeartbeat);
        heartbeatMap.delete(ws);
      }

      wss.clientMap.delete(socketId);
      loggers.server.debug(`[WebSocket] Client disconnected: ${socketId}`);

      // Remove device from database
      const dbDeviceId = (ws as any).dbDeviceId;
      if (dbDeviceId) {
        try {
          await db.connectedDevice.delete({
            where: { id: dbDeviceId }
          });
          loggers.server.debug(`[WebSocket] Device removed from DB: ${dbDeviceId}`);
        } catch (error) {
          loggers.server.error('[WebSocket] Failed to remove device from DB:', error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Broadcast device disconnection to other clients
      wss.broadcast(WSEventType.DEVICE_DISCONNECTED, {
        socketId,
        disconnectedAt: new Date().toISOString()
      });
    });

    // Handle errors
    ws.on('error', async (error) => {
      // Clear any per-socket heartbeat interval on error
      const socketHeartbeat = heartbeatMap.get(ws);
      if (socketHeartbeat !== undefined) {
        clearInterval(socketHeartbeat);
        heartbeatMap.delete(ws);
      }

      loggers.server.error(`[WebSocket] Error for client ${socketId}:`, error instanceof Error ? error : new Error(String(error)));
      wss.clientMap.delete(socketId);

      // Clean up device from database on error
      const dbDeviceId = (ws as any).dbDeviceId;
      if (dbDeviceId) {
        try {
          await db.connectedDevice.delete({
            where: { id: dbDeviceId }
          });
        } catch (deleteError) {
          loggers.server.error('[WebSocket] Failed to cleanup device from DB:', deleteError instanceof Error ? deleteError : new Error(String(deleteError)));
        }
      }
    });
  });

  // Start heartbeat interval to detect dead connections
  const heartbeatInterval = setInterval(async () => {
    for (const [socketId, ws] of wss.clientMap.entries()) {
      if ((ws as any).isAlive === false) {
        loggers.server.debug(`[WebSocket] Terminating dead connection: ${socketId}`);

        // Clean up from database
        const dbDeviceId = (ws as any).dbDeviceId;
        if (dbDeviceId) {
          try {
            await db.connectedDevice.delete({
              where: { id: dbDeviceId }
            });
            loggers.server.debug(`[WebSocket] Cleaned up stale device from DB: ${dbDeviceId}`);
          } catch (error) {
            loggers.server.error('[WebSocket] Failed to cleanup stale device from DB:', error instanceof Error ? error : new Error(String(error)));
          }
        }

        ws.terminate();
        wss.clientMap.delete(socketId);
        return;
      }

      (ws as any).isAlive = false;
      ws.ping();
    }
  }, 30000); // 30 seconds

  // Clean up interval on server close
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  globalForWebSocket.wsServer = wss;
  loggers.server.debug('[WebSocket] Server initialized on path /ws');

  return wss;
}

/**
 * Get WebSocket server instance
 */
export function getWebSocketServer(): WSServerWithClients | null {
  return globalForWebSocket.wsServer || null;
}

/**
 * Check if WebSocket server is running
 */
export function isWebSocketServerRunning(): boolean {
  const server = globalForWebSocket.wsServer;
  return server !== null && server !== undefined && server.clientMap !== undefined;
}

/**
 * Get connected devices count
 */
export function getConnectedDevicesCount(): number {
  const server = globalForWebSocket.wsServer;
  if (!server) return 0;
  return server.clientMap.size;
}

/**
 * Get connected devices list
 */
export function getConnectedDevices(): Array<{
  socketId: string;
  deviceName?: string;
  deviceType?: string;
  connectedAt?: string;
}> {
  const server = globalForWebSocket.wsServer;
  if (!server) return [];

  return Array.from(server.clientMap.entries()).map(([socketId, ws]) => ({
    socketId,
    deviceName: (ws as any).deviceName,
    deviceType: (ws as any).deviceType,
    connectedAt: (ws as any).connectedAt
  }));
}

/**
 * Broadcast data to all connected clients
 * If server is not initialized, this is a no-op (for development without WebSocket)
 */
export function broadcast(type: string, data: any, excludeSocket?: WebSocket): void {
  if (isShuttingDown) return;

  const server = globalForWebSocket.wsServer;
  if (server && server.clientMap) {
    const message = JSON.stringify({ type, data });

    server.clientMap.forEach((ws) => {
      if (ws !== excludeSocket && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (err) {
          loggers.server.warn('[WebSocket] Broadcast send failed for client', { error: (err as Error).message });
        }
      }
    });

    loggers.server.debug(`[WebSocket] Broadcast: ${type} to ${server.clientMap.size} clients`);
  } else {
    // Silent no-op for development without WebSocket server
    // This allows the app to work in dev mode without crashing
  }
}

/**
 * Send message to specific client
 */
function sendToClient(ws: WebSocket, message: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Handle incoming message from client
 */
async function handleMessage(ws: WebSocket, socketId: string, message: WSMessage, wss: WSServerWithClients): Promise<void> {
  const { type, data } = message;

  switch (type) {
    case 'ping':
      sendToClient(ws, { type: 'pong', data: { timestamp: new Date().toISOString() } });
      break;

    case 'sync:request':
      // Client requesting sync data - fetch changes since timestamp
      await handleSyncRequest(ws, data);
      break;

    // Scratchpad real-time collaboration — relay to all OTHER clients
    case 'scratchpad:content-update':
    case 'scratchpad:cursor-update':
    case 'scratchpad:join':
    case 'scratchpad:leave':
      wss.broadcast(type, { ...data, senderId: socketId }, ws);
      break;

    default:
      loggers.server.debug(`[WebSocket] Unhandled message type: ${type}`);
  }
}

/**
 * Handle sync request from client
 * Returns all changes (items, projects, links) since the given timestamp
 */
async function handleSyncRequest(ws: WebSocket, data: { since?: string; lastSyncAt?: string }): Promise<void> {
  const since = data.since || data.lastSyncAt;

  try {
    const response: any = {
      timestamp: new Date().toISOString(),
      hasMore: false,
    };

    if (since) {
      // Get changes since timestamp - use ISO string for SQLite/Prisma compatibility
      const sinceISO = new Date(since).toISOString();

      // Fetch items updated since timestamp
      const items = await db.captureItem.findMany({
        where: {
          updatedAt: { gte: sinceISO }
        },
        orderBy: { updatedAt: 'asc' },
        take: 100 // Limit to prevent overwhelming response
      });

      // Fetch projects updated since timestamp
      const projects = await db.project.findMany({
        where: {
          updatedAt: { gte: sinceISO }
        },
        orderBy: { updatedAt: 'asc' },
        take: 50
      });

      // Fetch links created since timestamp
      const links = await db.itemLink.findMany({
        where: {
          createdAt: { gte: sinceISO }
        },
        orderBy: { createdAt: 'asc' },
        take: 100
      });

      response.items = items;
      response.projects = projects;
      response.links = links;
      response.hasMore = items.length === 100 || projects.length === 50 || links.length === 100;

      loggers.server.debug(`[WebSocket] Sync response: ${items.length} items, ${projects.length} projects, ${links.length} links since ${since}`);
    } else {
      // First-time sync - get recent items and all active projects
      const items = await db.captureItem.findMany({
        where: {
          status: { not: 'trash' }
        },
        orderBy: { updatedAt: 'desc' },
        take: 50
      });

      const projects = await db.project.findMany({
        orderBy: { createdAt: 'desc' }
      });

      const links = await db.itemLink.findMany({
        take: 100
      });

      response.items = items;
      response.projects = projects;
      response.links = links;

      loggers.server.debug(`[WebSocket] Initial sync: ${items.length} items, ${projects.length} projects, ${links.length} links`);
    }

    sendToClient(ws, { type: 'sync:response', data: response });
  } catch (error) {
    loggers.server.error('[WebSocket] Error handling sync request:', error instanceof Error ? error : new Error(String(error)));
    sendToClient(ws, {
      type: 'sync:response',
      data: {
        error: 'Failed to fetch sync data',
        timestamp: new Date().toISOString(),
        hasMore: false
      }
    });
  }
}

/**
 * Parse device name from user agent
 */
function parseDeviceName(userAgent: string): string {
  // Simple parsing - could be enhanced
  if (userAgent.includes('Mobile')) return 'Mobile Device';
  if (userAgent.includes('Tablet')) return 'Tablet';
  if (userAgent.includes('Windows')) return 'Windows Desktop';
  if (userAgent.includes('Mac')) return 'Mac Desktop';
  if (userAgent.includes('Linux')) return 'Linux Desktop';
  return 'Unknown Device';
}

/**
 * Parse device type from user agent
 */
function parseDeviceType(userAgent: string): string {
  if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
    return 'mobile';
  }
  if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * Shutdown WebSocket server gracefully
 * 1. Notify all clients of impending shutdown
 * 2. Close all WebSocket connections gracefully
 * 3. Clean up all ConnectedDevice records from database
 * 4. Prevent new connections during shutdown
 */
export async function shutdownWebSocketServer(): Promise<void> {
  const server = globalForWebSocket.wsServer;
  if (!server) {
    loggers.server.debug('[WebSocket] No server to shutdown');
    return;
  }

  loggers.server.debug(`[WebSocket] Starting graceful shutdown (${server.clientMap.size} clients)`);

  // Step 1: Set shutdown flags to prevent new connections and broadcasts
  isShuttingDown = true;
  (server as any).isShuttingDown = true;
  loggers.server.debug('[WebSocket] Rejecting new connections during shutdown');

  // Step 2: Notify all connected clients of impending shutdown
  const shutdownMessage = JSON.stringify({
    type: 'server:shutdown',
    data: {
      message: 'Server is shutting down',
      timestamp: new Date().toISOString(),
      reconnect: true
    }
  });

  server.clientMap.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(shutdownMessage);
      } catch (err) {
        loggers.server.error('[WebSocket] Error sending shutdown notification:', err instanceof Error ? err : new Error(String(err)));
      }
    }
  });

  loggers.server.debug(`[WebSocket] Notified ${server.clientMap.size} clients of shutdown`);

  // Step 3: Clean up all ConnectedDevice records from database
  const deviceIdsToDelete: string[] = [];
  for (const [socketId, ws] of server.clientMap.entries()) {
    const dbDeviceId = (ws as any).dbDeviceId;
    if (dbDeviceId) {
      deviceIdsToDelete.push(dbDeviceId);
    }
  }

  if (deviceIdsToDelete.length > 0) {
    try {
      // Delete all device records in a single transaction
      await db.connectedDevice.deleteMany({
        where: {
          id: { in: deviceIdsToDelete }
        }
      });
      loggers.server.debug(`[WebSocket] Cleaned up ${deviceIdsToDelete.length} device records from database`);
    } catch (error) {
      loggers.server.error('[WebSocket] Error cleaning up device records:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Step 4: Give clients a brief moment to receive the shutdown message
  await new Promise(resolve => setTimeout(resolve, 100));

  // Step 5: Close all WebSocket connections gracefully
  let closedCount = 0;
  server.clientMap.forEach((ws, socketId) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Server shutting down');
        closedCount++;
      } else {
        // Already closed or closing, just remove from map
        server.clientMap.delete(socketId);
      }
    } catch (err) {
      loggers.server.error(`[WebSocket] Error closing connection ${socketId}:`, err instanceof Error ? err : new Error(String(err)));
    }
  });

  loggers.server.debug(`[WebSocket] Closed ${closedCount} WebSocket connections`);

  // Step 6: Clear the client map
  server.clientMap.clear();

  // Step 7: Close the WebSocket server
  return new Promise<void>((resolve) => {
    server.close((err) => {
      if (err) {
        loggers.server.error('[WebSocket] Error closing WebSocket server:', err instanceof Error ? err : new Error(String(err)));
      } else {
        loggers.server.debug('[WebSocket] WebSocket server closed successfully');
      }
      globalForWebSocket.wsServer = null;
      isShuttingDown = false; // Reset so a new server can be initialized
      resolve();
    });
  });
}

/**
 * Check if WebSocket server is shutting down
 */
export function isWebSocketServerShuttingDown(): boolean {
  const server = globalForWebSocket.wsServer;
  return server ? (server as any).isShuttingDown === true : false;
}
