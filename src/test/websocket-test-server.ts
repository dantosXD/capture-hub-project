/**
 * WebSocket Test Server
 *
 * A test WebSocket server for integration testing
 */

import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { AddressInfo } from 'net';

export interface TestWebSocketServer {
  server: ReturnType<typeof createServer>;
  wss: WebSocketServer;
  port: number;
  url: string;
  clients: WebSocket[];
  messages: Array<{ event: string; data: any }>;
}

/**
 * Creates a test WebSocket server
 */
export function createTestWebSocketServer(): TestWebSocketServer {
  const server = createServer();
  const wss = new WebSocketServer({ server });
  const clients: WebSocket[] = [];
  const messages: Array<{ event: string; data: any }> = [];

  wss.on('connection', (ws: WebSocket, req) => {
    clients.push(ws);

    // Send welcome message
    ws.send(
      JSON.stringify({
        event: 'connected',
        data: {
          deviceId: `test-device-${clients.length}`,
          timestamp: new Date().toISOString(),
        },
      })
    );

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        messages.push(message);

        // Echo back to all clients
        const response = JSON.stringify({
          event: 'echo',
          data: message,
        });
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(response);
          }
        });
      } catch (error) {
        // Ignore invalid JSON
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      const index = clients.indexOf(ws);
      if (index > -1) {
        clients.splice(index, 1);
      }

      // Notify other clients
      const disconnectMessage = JSON.stringify({
        event: 'device-disconnected',
        data: {
          deviceId: 'test-device',
          timestamp: new Date().toISOString(),
        },
      });
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(disconnectMessage);
        }
      });
    });
  });

  return {
    server,
    wss,
    port: 0, // Will be assigned on start
    url: '',
    clients,
    messages,
  };
}

/**
 * Starts the test WebSocket server
 */
export async function startTestWebSocketServer(
  testServer: TestWebSocketServer
): Promise<number> {
  return new Promise((resolve, reject) => {
    testServer.server.listen(0, () => {
      const address = testServer.server.address() as AddressInfo;
      testServer.port = address.port;
      testServer.url = `ws://localhost:${address.port}`;
      resolve(address.port);
    });

    testServer.server.on('error', reject);
  });
}

/**
 * Stops the test WebSocket server
 */
export async function stopTestWebSocketServer(
  testServer: TestWebSocketServer
): Promise<void> {
  return new Promise((resolve) => {
    // Close all client connections
    testServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    // Close the server
    testServer.wss.close(() => {
      testServer.server.close(() => {
        resolve();
      });
    });
  });
}

/**
 * Broadcasts a message to all connected clients
 */
export function broadcastMessage(
  testServer: TestWebSocketServer,
  event: string,
  data: any
): void {
  const message = JSON.stringify({ event, data });
  testServer.messages.push({ event, data });

  testServer.wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Creates a test WebSocket client
 */
export function createTestWebSocketClient(url: string): WebSocket {
  return new WebSocket(url);
}

/**
 * Sends a message through a WebSocket client
 */
export function sendWebSocketMessage(
  client: WebSocket,
  event: string,
  data: any
): void {
  const message = JSON.stringify({ event, data });
  if (client.readyState === WebSocket.OPEN) {
    client.send(message);
  }
}

/**
 * Waits for a WebSocket message
 */
export function waitForWebSocketMessage(
  client: WebSocket,
  timeout: number = 5000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.removeEventListener('message', onMessage);
      reject(new Error('WebSocket message timeout'));
    }, timeout);

    const onMessage = (event: MessageEvent) => {
      clearTimeout(timer);
      client.removeEventListener('message', onMessage);
      try {
        const data = JSON.parse(event.data.toString());
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };

    client.addEventListener('message', onMessage);
  });
}
