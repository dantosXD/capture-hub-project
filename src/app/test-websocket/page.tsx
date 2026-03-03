'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { WSEventType } from '@/lib/ws-events';
import { useState, useCallback, useEffect } from 'react';

export default function TestWebSocketPage() {
  const {
    status,
    isConnected,
    isReconnecting,
    socketId,
    deviceName,
    deviceType,
    lastConnectedAt,
    send,
    on,
    requestSync,
    reconnect,
    disconnect,
  } = useWebSocket();

  const [messages, setMessages] = useState<string[]>([]);
  const [syncData, setSyncData] = useState<any>(null);

  const addMessage = useCallback((msg: string) => {
    setMessages((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // Listen for device connections
  useEffect(() => {
    const cleanup = on(WSEventType.DEVICE_CONNECTED, (data) => {
      addMessage(`Device connected: ${data.deviceName} (${data.deviceType})`);
    });

    const cleanup2 = on(WSEventType.DEVICE_DISCONNECTED, (data) => {
      addMessage(`Device disconnected: ${data.socketId}`);
    });

    const cleanup3 = on('sync:response', (data) => {
      addMessage(`Sync response received`);
      setSyncData(data);
    });

    return () => {
      cleanup();
      cleanup2();
      cleanup3();
    };
  }, [on, addMessage]);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">WebSocket Test Page</h1>

        {/* Connection Status */}
        <div className="bg-card p-6 rounded-lg border space-y-4">
          <h2 className="text-xl font-semibold">Connection Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-muted-foreground">Status:</span>{' '}
              <span className={`font-semibold ${
                status === 'connected' ? 'text-green-500' :
                status === 'reconnecting' ? 'text-yellow-500' :
                'text-red-500'
              }`}>
                {status}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Is Connected:</span>{' '}
              <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
                {isConnected ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Is Reconnecting:</span>{' '}
              <span>{isReconnecting ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Socket ID:</span>{' '}
              <span className="font-mono text-sm">{socketId || 'N/A'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Device Name:</span>{' '}
              <span>{deviceName || 'N/A'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Device Type:</span>{' '}
              <span>{deviceType || 'N/A'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Connected At:</span>{' '}
              <span>{lastConnectedAt || 'N/A'}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              onClick={reconnect}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Reconnect
            </button>
            <button
              onClick={disconnect}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Disconnect
            </button>
            <button
              onClick={requestSync}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Request Sync
            </button>
          </div>
        </div>

        {/* Sync Data */}
        <div className="bg-card p-6 rounded-lg border space-y-4">
          <h2 className="text-xl font-semibold">Sync Data</h2>
          {syncData ? (
            <div className="space-y-2">
              <div><strong>Timestamp:</strong> {syncData.timestamp}</div>
              <div><strong>Has More:</strong> {syncData.hasMore ? 'Yes' : 'No'}</div>
              <div><strong>Items:</strong> {syncData.items?.length || 0}</div>
              <div><strong>Projects:</strong> {syncData.projects?.length || 0}</div>
              <div><strong>Links:</strong> {syncData.links?.length || 0}</div>
              <details className="mt-2">
                <summary className="cursor-pointer text-primary">View Full Data</summary>
                <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-auto max-h-64">
                  {JSON.stringify(syncData, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="text-muted-foreground">No sync data yet. Click "Request Sync" to test.</div>
          )}
        </div>

        {/* Event Log */}
        <div className="bg-card p-6 rounded-lg border space-y-4">
          <h2 className="text-xl font-semibold">Event Log</h2>
          <div className="bg-muted p-4 rounded min-h-[200px] max-h-[400px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-muted-foreground">No events yet.</div>
            ) : (
              <ul className="space-y-1 font-mono text-sm">
                {messages.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
