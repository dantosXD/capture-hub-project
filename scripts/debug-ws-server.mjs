#!/usr/bin/env bun
/**
 * Debug WebSocket server by creating a simple one
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const PORT = 3999;

// Create HTTP server
const server = createServer((req, res) => {
  res.writeHead(200);
  res.end('WebSocket server running');
});

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

console.log(`🧪 Debug server starting on port ${PORT}...`);

wss.on('listening', () => {
  console.log('✅ WebSocket server is listening');
});

wss.on('connection', (ws, req) => {
  console.log('✅ New WebSocket connection!');
  console.log('   - URL:', req.url);
  console.log('   - Headers:', req.headers);

  ws.on('message', (data) => {
    console.log('📩 Received:', data.toString());
  });

  ws.send(JSON.stringify({ type: 'connected', data: { message: 'Hello!' } }));
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`   WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log('\nTry connecting with another terminal:');
  console.log(`  bun run -e "import WebSocket from 'ws'; const ws = new WebSocket('ws://localhost:${PORT}/ws'); ws.on('message', d => console.log(d.toString()));"`);
});
