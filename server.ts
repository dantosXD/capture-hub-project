import { createServer } from 'http';
import next from 'next';
import { initializeWebSocketServer, shutdownWebSocketServer } from './src/lib/websocket';
import { db } from './src/lib/db';

async function main() {
  const dev = process.env.NODE_ENV !== 'production';
  const port = parseInt(process.env.PORT || '3000', 10);
  const hostname = dev ? 'localhost' : (process.env.HOSTNAME || '0.0.0.0');

  // Create Next.js app
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  // Prepare the Next.js app
  await app.prepare();
  console.log('> Next.js app prepared successfully');

  // Verify database connection (Prisma uses lazy connection)
  try {
    await db.$queryRaw`SELECT 1`;
    console.log('> Database connected successfully');
  } catch (err) {
    console.error('> Failed to connect to database:', err);
    throw err;
  }

  // Create HTTP server
  const server = createServer(async (req, res) => {
    console.log(`> Request: ${req.method} ${req.url}`);

    try {
      // Let Next.js handle the request
      await handle(req, res);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Initialize WebSocket server
  initializeWebSocketServer(server);

  // Handle WebSocket upgrade - let Next.js handle HMR upgrades in dev mode
  if (dev) {
    const upgradeHandler = app.getUpgradeHandler();
    server.on('upgrade', (req, socket, head) => {
      // Only let Next.js handle non-/ws upgrade requests (HMR)
      if (req.url && !req.url.startsWith('/ws')) {
        upgradeHandler(req, socket, head);
      }
    });
  }

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    console.log(`\n> Received ${signal}. Shutting down gracefully...`);

    // First shutdown WebSocket server to notify clients and clean up
    try {
      await shutdownWebSocketServer();
      console.log('> WebSocket server shutdown complete');
    } catch (err) {
      console.error('> Error shutting down WebSocket server:', err);
    }

    // Stop accepting new connections and close HTTP server
    server.close(async () => {
      console.log('> HTTP server closed');

      // Disconnect from database
      try {
        await db.$disconnect();
        console.log('> Database disconnected');
      } catch (err) {
        console.error('> Error disconnecting from database:', err);
      }

      console.log('> Shutdown complete');
      process.exit(0);
    });

    // Force shutdown after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('> Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('> Uncaught Exception:', err);
    shutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('> Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });

  // Start listening
  server
    .once('error', (err) => {
      console.error(err);
      shutdown('server-error');
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log('> WebSocket server running on ws path');
      console.log('> Press Ctrl+C to stop');
    });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
