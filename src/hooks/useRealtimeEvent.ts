'use client';

/**
 * Real-time Event Hooks (Project Omni P5)
 *
 * Typed React hooks that subscribe to domain events via WebSocket.
 * Bridges the P1 event contracts to React component state.
 *
 * Usage:
 *   useRealtimeEvent('item:created', (data) => { ... });
 *   const items = useRealtimeList('/api/capture', 'item:created', 'item:deleted');
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useSharedWebSocket } from '@/contexts/WebSocketContext';
import { WSEventType } from '@/lib/ws-events';

// ============================================================================
// Core: Subscribe to a typed event
// ============================================================================

/**
 * Subscribe to a specific WebSocket event with automatic cleanup.
 * Handler is called whenever the event fires.
 */
export function useRealtimeEvent<T = any>(
  eventType: WSEventType | string,
  handler: (data: T) => void,
  options?: { enabled?: boolean }
): void {
  const { on, isConnected } = useSharedWebSocket();
  const handlerRef = useRef(handler);
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled || !isConnected) return;

    const cleanup = on(eventType, (data: T) => {
      handlerRef.current(data);
    });

    return cleanup;
  }, [eventType, on, isConnected, enabled]);
}

// ============================================================================
// Composite: Subscribe to multiple events
// ============================================================================

/**
 * Subscribe to multiple WebSocket events with a single handler.
 */
export function useRealtimeEvents<T = any>(
  eventTypes: (WSEventType | string)[],
  handler: (eventType: string, data: T) => void,
  options?: { enabled?: boolean }
): void {
  const { on, isConnected } = useSharedWebSocket();
  const handlerRef = useRef(handler);
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const eventTypesKey = eventTypes.join(',');

  useEffect(() => {
    if (!enabled || !isConnected) return;

    const cleanups = eventTypes.map(eventType =>
      on(eventType, (data: T) => {
        handlerRef.current(eventType, data);
      })
    );

    return () => cleanups.forEach(cleanup => cleanup());
  }, [eventTypesKey, on, isConnected, enabled]);
}

// ============================================================================
// Auto-refreshing data: Refetch on event
// ============================================================================

/**
 * Fetch data and auto-refetch when specified events occur.
 * Combines API fetching with real-time invalidation.
 */
export function useRealtimeQuery<T = any>(options: {
  url: string;
  invalidateOn: (WSEventType | string)[];
  enabled?: boolean;
  initialData?: T;
}): {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { url, invalidateOn, enabled = true, initialData = null } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchCountRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    const fetchId = ++fetchCountRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();

      // Only update if this is still the latest fetch
      if (fetchId === fetchCountRef.current) {
        // Handle envelope format
        setData(result.data !== undefined ? result.data : result);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (fetchId === fetchCountRef.current) {
        setError(err?.message || 'Failed to fetch');
        setIsLoading(false);
      }
    }
  }, [url, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refetch on events
  useRealtimeEvents(invalidateOn, () => {
    fetchData();
  }, { enabled });

  return { data, isLoading, error, refetch: fetchData };
}

// ============================================================================
// Connection Status Hook
// ============================================================================

/**
 * Hook that provides connection status with typed states.
 */
export function useConnectionStatus(): {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  isConnected: boolean;
  isReconnecting: boolean;
  socketId: string | null;
  reconnect: () => void;
} {
  const { status, isConnected, isReconnecting, socketId, reconnect } = useSharedWebSocket();
  return { status, isConnected, isReconnecting, socketId, reconnect };
}
