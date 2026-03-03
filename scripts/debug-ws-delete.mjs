#!/usr/bin/env bun
// Debug script to check WebSocket deletion events

import { WebSocket } from 'ws';

const API_BASE = 'http://127.0.0.1:3000';
const WS_URL = 'ws://127.0.0.1:3000/ws';

let receivedEvents = [];

async function main() {
  console.log('Setting up WebSocket connection...');

  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('WebSocket connected');
  });

  ws.on('message', (data) => {
    const msg = data.toString();
    console.log(`WS received: ${msg.substring(0, 200)}`);
    try {
      const event = JSON.parse(msg);
      receivedEvents.push(event);
    } catch (e) {
      console.log('(not JSON)');
    }
  });

  ws.on('error', (err) => {
    console.error('WS error:', err);
  });

  // Wait for connection
  await new Promise(r => setTimeout(r, 1000));

  console.log('\nCreating test item...');
  const createResponse = await fetch(`${API_BASE}/api/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'note',
      title: `DEBUG_DELETE_${Date.now()}`,
      content: 'This item will be deleted',
    }),
  });
  const createdItem = await createResponse.json();
  console.log(`Created item: ${createdItem.id}`);

  await new Promise(r => setTimeout(r, 500));
  receivedEvents = [];
  console.log('\nEvents cleared. About to delete...');

  console.log('\nDeleting item...');
  const deleteResponse = await fetch(`${API_BASE}/api/capture/${createdItem.id}`, {
    method: 'DELETE',
  });
  const deleteResult = await deleteResponse.json();
  console.log(`Delete result:`, deleteResult);

  console.log('\nWaiting for events...');
  await new Promise(r => setTimeout(r, 1000));

  console.log(`\nReceived ${receivedEvents.length} events after deletion:`);
  receivedEvents.forEach((e, i) => {
    console.log(`  ${i + 1}. type=${e.type}, data=`, JSON.stringify(e.data).substring(0, 100));
  });

  ws.close();
}

main().catch(console.error);
