'use client';

import { useEffect } from 'react';
import { useSharedWebSocket, type WebSocketContextValue } from '@/contexts/WebSocketContext';
import { WSEventType } from '@/lib/ws-events';

/**
 * Client-side WebSocket hook that uses the shared WebSocket connection.
 *
 * All components share a SINGLE WebSocket connection through the WebSocketProvider.
 * This prevents multiple connections, duplicate heartbeats, and memory leaks.
 *
 * Features:
 * - Shared single connection (via WebSocketProvider context)
 * - Automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s)
 * - Event listener registration with cleanup
 * - Connection status tracking
 * - Heartbeat/ping-pong for connection health
 * - Cleanup on unmount
 */
export type WebSocketHookReturn = WebSocketContextValue;

export function useWebSocket(): WebSocketHookReturn {
  return useSharedWebSocket();
}

/**
 * Hook for subscribing to specific WebSocket events
 * Automatically handles cleanup
 */
export function useWebSocketEvent(
  eventType: WSEventType | string,
  handler: (data: any) => void,
  deps: React.DependencyList = []
) {
  const { on } = useWebSocket();

  useEffect(() => {
    const cleanup = on(eventType, handler);
    return cleanup;
  }, [eventType, on, ...deps]);
}
