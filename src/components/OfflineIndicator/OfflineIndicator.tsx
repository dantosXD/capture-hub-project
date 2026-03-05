'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getQueueSize } from '@/lib/offline-queue';
import { toast } from 'sonner';

/**
 * OfflineIndicator Component
 *
 * Shows visual feedback for network connectivity state:
 * - Green when online and connected
 * - Yellow when reconnecting
 * - Red when offline
 * - Shows count of queued operations
 *
 * Also displays toast notifications when connection state changes.
 */
export function OfflineIndicator() {
  const [mounted, setMounted] = useState(false);
  const { isOnline, wasOffline } = useNetworkStatus();
  const { isConnected, isReconnecting } = useWebSocket();
  const queueSize = getQueueSize();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show toast when coming back online
  useEffect(() => {
    if (wasOffline && isOnline && isConnected) {
      // Process queued operations
      const processQueuedOperations = async () => {
        const { processQueue } = await import('@/lib/offline-queue');
        const processed = await processQueue();

        if (processed > 0) {
          toast.success(`Back online! Synced ${processed} pending update${processed > 1 ? 's' : ''}`, {
            description: 'Your changes have been saved',
            icon: <Wifi className="w-4 h-4 text-green-500" />,
            duration: 5000,
          });
        } else {
          toast.success('Back online!', {
            description: 'Connection restored',
            icon: <Wifi className="w-4 h-4 text-green-500" />,
            duration: 3000,
          });
        }
      };

      processQueuedOperations();
    }
  }, [isOnline, isConnected, wasOffline]);

  // Show toast when going offline
  useEffect(() => {
    if (!isOnline) {
      toast.error('You are offline', {
        description: 'Changes will be queued and synced when you reconnect',
        icon: <WifiOff className="w-4 h-4" />,
        duration: 5000,
      });
    }
  }, [isOnline]);

  // Determine connection state
  const getConnectionState = () => {
    if (!isOnline) return 'offline';
    if (isReconnecting) return 'reconnecting';
    if (isConnected) return 'connected';
    return 'disconnected';
  };

  const state = getConnectionState();

  // Don't render during SSR to avoid hydration mismatch (connection state is client-only)
  // Don't show indicator when connected and online (use DeviceIndicator instead)
  if (!mounted || state === 'connected' || state === 'disconnected') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border ${state === 'offline'
          ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
          : state === 'reconnecting'
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
            : 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400'
          }`}
      >
        {state === 'offline' && <WifiOff className="w-4 h-4 animate-pulse" />}
        {state === 'reconnecting' && <Loader2 className="w-4 h-4 animate-spin" />}

        <span className="text-sm font-medium">
          {state === 'offline' && 'Offline'}
          {state === 'reconnecting' && 'Reconnecting...'}
        </span>

        {queueSize > 0 && (
          <span className="ml-1 text-xs opacity-75">
            ({queueSize} pending)
          </span>
        )}
      </div>
    </div>
  );
}
