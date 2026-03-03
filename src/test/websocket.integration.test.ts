/**
 * Integration tests for WebSocket communication
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestWebSocketServer,
  startTestWebSocketServer,
  stopTestWebSocketServer,
  createTestWebSocketClient,
  sendWebSocketMessage,
  waitForWebSocketMessage,
  broadcastMessage,
} from './websocket-test-server';

describe('WebSocket Integration Tests', () => {
  let testServer: ReturnType<typeof createTestWebSocketServer>;

  beforeEach(async () => {
    testServer = createTestWebSocketServer();
    await startTestWebSocketServer(testServer);
  });

  afterEach(async () => {
    await stopTestWebSocketServer(testServer);
  });

  describe('Server Connection', () => {
    it('should start server on available port', async () => {
      expect(testServer.port).toBeGreaterThan(0);
      expect(testServer.url).toContain('ws://localhost:');
    });

    it('should accept client connections', async () => {
      const client = createTestWebSocketClient(testServer.url);

      await new Promise<void>((resolve) => {
        client.addEventListener('open', () => resolve());
      });

      expect(testServer.clients.length).toBeGreaterThan(0);
      client.close();
    });

    it('should send welcome message on connection', async () => {
      const client = createTestWebSocketClient(testServer.url);

      const message = await waitForWebSocketMessage(client);
      expect(message.event).toBe('connected');
      expect(message.data.deviceId).toBeDefined();

      client.close();
    });

    it('should handle multiple concurrent connections', async () => {
      const clients = [
        createTestWebSocketClient(testServer.url),
        createTestWebSocketClient(testServer.url),
        createTestWebSocketClient(testServer.url),
      ];

      await new Promise<void>((resolve) => {
        let connected = 0;
        clients.forEach((client) => {
          client.addEventListener('open', () => {
            connected++;
            if (connected === clients.length) resolve();
          });
        });
      });

      expect(testServer.clients.length).toBe(clients.length);

      clients.forEach((client) => client.close());
    });
  });

  describe('Message Broadcasting', () => {
    it('should broadcast message to all connected clients', async () => {
      const clients = [
        createTestWebSocketClient(testServer.url),
        createTestWebSocketClient(testServer.url),
      ];

      // Wait for both to connect
      await Promise.all(
        clients.map((c) =>
          new Promise<void>((resolve) => {
            c.addEventListener('open', () => resolve());
            // Consume welcome message
            c.addEventListener('message', () => {}, { once: true });
          })
        )
      );

      // Broadcast a message
      broadcastMessage(testServer, 'test-event', { message: 'Hello, clients!' });

      // Both clients should receive the message
      const messages = await Promise.all(
        clients.map((c) => waitForWebSocketMessage(c))
      );

      messages.forEach((msg) => {
        expect(msg.event).toBe('test-event');
        expect(msg.data.message).toBe('Hello, clients!');
      });

      clients.forEach((client) => client.close());
    });

    it('should track broadcasted messages', () => {
      broadcastMessage(testServer, 'event1', { data: 'test1' });
      broadcastMessage(testServer, 'event2', { data: 'test2' });

      expect(testServer.messages).toHaveLength(2);
      expect(testServer.messages[0].event).toBe('event1');
      expect(testServer.messages[1].event).toBe('event2');
    });
  });

  describe('Client-to-Server Communication', () => {
    it('should receive messages from clients', async () => {
      const client = createTestWebSocketClient(testServer.url);

      await new Promise<void>((resolve) => {
        client.addEventListener('open', () => resolve());
        client.addEventListener('message', () => {}, { once: true });
      });

      sendWebSocketMessage(client, 'client-message', { text: 'Hello, server!' });

      // Give server time to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(testServer.messages.length).toBeGreaterThan(0);
      const lastMessage = testServer.messages[testServer.messages.length - 1];
      expect(lastMessage.event).toBe('client-message');

      client.close();
    });

    it('should echo messages back to sender', async () => {
      const client = createTestWebSocketClient(testServer.url);

      // Consume welcome message
      await waitForWebSocketMessage(client);

      sendWebSocketMessage(client, 'echo-test', { data: 'test' });

      const response = await waitForWebSocketMessage(client);
      expect(response.event).toBe('echo');
      expect(response.data.event).toBe('echo-test');
      expect(response.data.data.data).toBe('test');

      client.close();
    });
  });

  describe('Disconnection Handling', () => {
    it('should handle client disconnection', async () => {
      const client1 = createTestWebSocketClient(testServer.url);
      const client2 = createTestWebSocketClient(testServer.url);

      // Wait for both to connect and consume welcome messages
      await Promise.all([
        waitForWebSocketMessage(client1),
        waitForWebSocketMessage(client2),
      ]);

      const initialClientCount = testServer.clients.length;
      expect(initialClientCount).toBe(2);

      // Close first client
      client1.close();

      // Give server time to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(testServer.clients.length).toBe(initialClientCount - 1);

      client2.close();
    });

    it('should notify other clients on disconnection', async () => {
      const client1 = createTestWebSocketClient(testServer.url);
      const client2 = createTestWebSocketClient(testServer.url);

      // Consume welcome messages
      await Promise.all([
        waitForWebSocketMessage(client1),
        waitForWebSocketMessage(client2),
      ]);

      // Close client1
      client1.close();

      // Client2 should receive disconnection notification
      const message = await waitForWebSocketMessage(client2);
      expect(message.event).toBe('device-disconnected');

      client2.close();
    });
  });

  describe('Real-Time Sync Scenarios', () => {
    it('should simulate item creation broadcast', async () => {
      const clients = [
        createTestWebSocketClient(testServer.url),
        createTestWebSocketClient(testServer.url),
        createTestWebSocketClient(testServer.url),
      ];

      // Wait for all to connect and consume welcome messages
      await Promise.all(
        clients.map((c) => waitForWebSocketMessage(c))
      );

      // Simulate item creation event
      const newItem = {
        id: 'test-item-1',
        type: 'note',
        title: 'Test Item',
        content: 'Test content',
        createdAt: new Date().toISOString(),
      };

      broadcastMessage(testServer, 'item:created', newItem);

      // All clients should receive the item
      const messages = await Promise.all(
        clients.map((c) => waitForWebSocketMessage(c))
      );

      messages.forEach((msg) => {
        expect(msg.event).toBe('item:created');
        expect(msg.data.id).toBe('test-item-1');
      });

      clients.forEach((client) => client.close());
    });

    it('should simulate item update broadcast', async () => {
      const client = createTestWebSocketClient(testServer.url);

      // Consume welcome message
      await waitForWebSocketMessage(client);

      // Simulate item update
      const updatedItem = {
        id: 'test-item-1',
        title: 'Updated Title',
        updatedAt: new Date().toISOString(),
      };

      broadcastMessage(testServer, 'item:updated', updatedItem);

      const message = await waitForWebSocketMessage(client);
      expect(message.event).toBe('item:updated');
      expect(message.data.title).toBe('Updated Title');

      client.close();
    });

    it('should simulate item deletion broadcast', async () => {
      const clients = [
        createTestWebSocketClient(testServer.url),
        createTestWebSocketClient(testServer.url),
      ];

      // Consume welcome messages
      await Promise.all(
        clients.map((c) => waitForWebSocketMessage(c))
      );

      // Simulate item deletion
      broadcastMessage(testServer, 'item:deleted', { id: 'test-item-1' });

      // Both clients should receive deletion event
      const messages = await Promise.all(
        clients.map((c) => waitForWebSocketMessage(c))
      );

      messages.forEach((msg) => {
        expect(msg.event).toBe('item:deleted');
        expect(msg.data.id).toBe('test-item-1');
      });

      clients.forEach((client) => client.close());
    });

    it('should simulate bulk update broadcast', async () => {
      const client = createTestWebSocketClient(testServer.url);

      // Consume welcome message
      await waitForWebSocketMessage(client);

      // Simulate bulk update
      const bulkUpdate = {
        itemIds: ['item-1', 'item-2', 'item-3'],
        updates: { status: 'archived' },
      };

      broadcastMessage(testServer, 'item:bulk-update', bulkUpdate);

      const message = await waitForWebSocketMessage(client);
      expect(message.event).toBe('item:bulk-update');
      expect(message.data.itemIds).toHaveLength(3);

      client.close();
    });
  });

  describe('Multi-Device Simulation', () => {
    it('should simulate multiple devices with different device IDs', async () => {
      const devices = ['device-1', 'device-2', 'device-3'];
      const clients = devices.map(() => createTestWebSocketClient(testServer.url));

      // Wait for all to connect and get their welcome messages
      const messages = await Promise.all(
        clients.map((c) => waitForWebSocketMessage(c))
      );

      // Each client should have unique device ID
      const deviceIds = messages.map((m) => m.data.deviceId);
      const uniqueIds = new Set(deviceIds);
      expect(uniqueIds.size).toBe(devices.length);

      clients.forEach((client) => client.close());
    });

    it('should maintain connection state across devices', async () => {
      const client1 = createTestWebSocketClient(testServer.url);
      const client2 = createTestWebSocketClient(testServer.url);

      // Consume welcome messages
      await Promise.all([
        waitForWebSocketMessage(client1),
        waitForWebSocketMessage(client2),
      ]);

      // Send message from client1
      sendWebSocketMessage(client1, 'device-1-action', { action: 'test' });

      // Client2 should receive it (echo)
      const message = await waitForWebSocketMessage(client2);
      expect(message.event).toBe('echo');
      expect(message.data.event).toBe('device-1-action');

      client1.close();
      client2.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const client = createTestWebSocketClient(testServer.url);

      // Consume welcome message
      await waitForWebSocketMessage(client);

      // Send invalid JSON
      if (client.readyState === WebSocket.OPEN) {
        client.send('invalid json {');
      }

      // Give server time to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Server should still be running
      expect(testServer.server.listening).toBe(true);

      client.close();
    });

    it('should handle client disconnection during message processing', async () => {
      const client = createTestWebSocketClient(testServer.url);

      // Consume welcome message
      await waitForWebSocketMessage(client);

      // Close client immediately after sending
      sendWebSocketMessage(client, 'quick-message', { data: 'test' });
      client.close();

      // Give server time to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Server should still be running
      expect(testServer.server.listening).toBe(true);
    });
  });
});
