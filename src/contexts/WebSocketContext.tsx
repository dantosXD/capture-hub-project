'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { WSEventType, type WSEvent, type SyncResponseEvent } from '@/lib/ws-events';
import { getSyncManager, type SyncData } from '@/lib/ws-sync';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface WebSocketContextValue {
  socket: WebSocket | null;
  status: ConnectionStatus;
  isConnected: boolean;
  isReconnecting: boolean;
  socketId: string | null;
  deviceName: string | null;
  deviceType: string | null;
  lastConnectedAt: string | null;
  send: (type: string, data?: any) => void;
  on: (eventType: WSEventType | string, handler: (data: any) => void) => () => void;
  requestSync: () => void;
  reconnect: () => void;
  disconnect: () => void;
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];
const MAX_RECONNECT_DELAY = 30000;

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

/**
 * WebSocket Provider - maintains a SINGLE shared WebSocket connection
 * for the entire application. All components share this connection
 * through the useWebSocket hook.
 */
export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [socketId, setSocketId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [deviceType, setDeviceType] = useState<string | null>(null);
  const [lastConnectedAt, setLastConnectedAt] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const eventListenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const syncManagerRef = useRef(getSyncManager());
  const isUnmountedRef = useRef(false);
  const connectCalledRef = useRef(false);

  // WebSocket URL - use NEXT_PUBLIC_WS_URL env var if set, otherwise auto-detect from window.location
  const wsUrl = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_WS_URL || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}/ws`)
    : '';

  const getReconnectDelay = useCallback((attempt: number): number => {
    if (attempt < RECONNECT_DELAYS.length) {
      return RECONNECT_DELAYS[attempt];
    }
    return MAX_RECONNECT_DELAY;
  }, []);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Send message to server
   */
  const send = useCallback((type: string, data?: any) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data }));
    }
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Close any existing connection in CONNECTING state
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      wsRef.current.close();
    }

    if (!wsUrl) return;

    setStatus('connecting');

    try {
      const deviceNameQuery = (() => {
        if (typeof window === 'undefined') return '';
        const savedDeviceName = window.localStorage.getItem('capture-hub-device-name')?.trim();
        return savedDeviceName ? `?deviceName=${encodeURIComponent(savedDeviceName)}` : '';
      })();

      const ws = new WebSocket(`${wsUrl}${deviceNameQuery}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        console.log('[WebSocket] Connected');
        setStatus('connected');
        reconnectAttemptRef.current = 0;
        clearReconnectTimeout();
        // Note: heartbeats are handled server-side via ping/pong — no client heartbeat needed
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const message: WSEvent = JSON.parse(event.data);
          const { type, data } = message;

          // Handle connection confirmation
          if (type === WSEventType.CONNECTED) {
            setSocketId(data.socketId || null);
            setDeviceName(data.deviceName || null);
            setDeviceType(data.deviceType || null);
            setLastConnectedAt(data.connectedAt || null);

            // Request sync after connection is confirmed
            syncManagerRef.current.requestSync(send);
          }

          // Handle sync response
          if (type === WSEventType.SYNC_RESPONSE) {
            syncManagerRef.current.handleSyncResponse(data as SyncData);

            // Check for any items with conflict metadata and notify listeners
            const syncData = data as SyncData;
            const conflictedItems = (syncData.items || []).filter(
              (item: any) => item._conflict === true || (item.metadata && item.metadata._conflict === true)
            );
            if (conflictedItems.length > 0) {
              const conflictListeners = eventListenersRef.current.get(WSEventType.ITEM_UPDATED);
              if (conflictListeners) {
                conflictListeners.forEach((handler) => {
                  try {
                    handler({ conflicts: conflictedItems, type: 'conflict', timestamp: syncData.timestamp });
                  } catch (error) {
                    console.error('[WebSocket] Error in conflict notification handler:', error);
                  }
                });
              }
            }

            // Don't return - allow event listeners to be notified
          }

          // Handle pong response (connection alive)
          if (type === WSEventType.PONG) {
            return;
          }

          // Notify all event listeners for this type
          const listeners = eventListenersRef.current.get(type);
          if (listeners) {
            listeners.forEach((handler) => {
              try {
                handler(data);
              } catch (error) {
                console.error(`[WebSocket] Error in event handler for ${type}:`, error);
              }
            });
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      ws.onclose = (event) => {
        if (isUnmountedRef.current) return;
        console.log(`[WebSocket] Disconnected (code: ${event.code})`);
        setStatus('disconnected');

        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000 && !isUnmountedRef.current) {
          const delay = getReconnectDelay(reconnectAttemptRef.current);
          reconnectAttemptRef.current++;

          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`);
          setStatus('reconnecting');

          // Clear any existing reconnect timeout BEFORE scheduling a new one (prevents stacking)
          clearReconnectTimeout();
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              connect();
            }
          }, delay);
        }
      };

      ws.onerror = () => {
        if (isUnmountedRef.current) return;
        setStatus('disconnected');
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create WebSocket:', error);
      setStatus('disconnected');
    }
  }, [wsUrl, getReconnectDelay, clearReconnectTimeout, send]);

  /**
   * Register event listener - returns cleanup function
   */
  const on = useCallback((eventType: WSEventType | string, handler: (data: any) => void): (() => void) => {
    if (!eventListenersRef.current.has(eventType)) {
      eventListenersRef.current.set(eventType, new Set());
    }
    eventListenersRef.current.get(eventType)!.add(handler);

    return () => {
      const listeners = eventListenersRef.current.get(eventType);
      if (listeners) {
        listeners.delete(handler);
        if (listeners.size === 0) {
          eventListenersRef.current.delete(eventType);
        }
      }
    };
  }, []);

  /**
   * Manually trigger reconnection
   */
  const reconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectAttemptRef.current = 0;

    const ws = wsRef.current;
    if (ws) {
      ws.close(1000, 'Manual reconnect');
    }

    connect();
  }, [clearReconnectTimeout, connect]);

  /**
   * Request sync from server
   */
  const requestSync = useCallback(() => {
    syncManagerRef.current.requestSync(send);
  }, [send]);

  /**
   * Manually disconnect
   */
  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectAttemptRef.current = 0;

    const ws = wsRef.current;
    if (ws) {
      ws.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setStatus('disconnected');
    setSocketId(null);
    setDeviceName(null);
    setDeviceType(null);
    setLastConnectedAt(null);
  }, [clearReconnectTimeout]);

  // Connect on mount, disconnect on unmount
  // Defer until page load is complete to avoid cold-start connection errors
  useEffect(() => {
    isUnmountedRef.current = false;
    if (!connectCalledRef.current) {
      connectCalledRef.current = true;
      const doConnect = () => {
        if (!isUnmountedRef.current) connect();
      };
      if (typeof document !== 'undefined' && document.readyState !== 'complete') {
        window.addEventListener('load', doConnect, { once: true });
      } else {
        doConnect();
      }
    }

    return () => {
      isUnmountedRef.current = true;
      connectCalledRef.current = false;
      disconnect();
    };
  }, []);

  useEffect(() => {
    const handleDeviceNameUpdate = () => {
      reconnect();
    };

    window.addEventListener('capture-hub:device-name-updated', handleDeviceNameUpdate);
    return () => {
      window.removeEventListener('capture-hub:device-name-updated', handleDeviceNameUpdate);
    };
  }, [reconnect]);

  const value = useMemo<WebSocketContextValue>(() => ({
    socket: wsRef.current,
    status,
    isConnected: status === 'connected',
    isReconnecting: status === 'reconnecting',
    socketId,
    deviceName,
    deviceType,
    lastConnectedAt,
    send,
    on,
    requestSync,
    reconnect,
    disconnect,
  }), [status, socketId, deviceName, deviceType, lastConnectedAt, send, on, requestSync, reconnect, disconnect]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * Hook to use the shared WebSocket connection.
 * Must be used within a WebSocketProvider.
 */
export function useSharedWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    // Return a no-op version for components outside the provider (SSR etc.)
    return {
      socket: null,
      status: 'disconnected',
      isConnected: false,
      isReconnecting: false,
      socketId: null,
      deviceName: null,
      deviceType: null,
      lastConnectedAt: null,
      send: () => {},
      on: () => () => {},
      requestSync: () => {},
      reconnect: () => {},
      disconnect: () => {},
    };
  }
  return context;
}
