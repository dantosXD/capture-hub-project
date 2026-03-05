'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Wifi,
  WifiOff,
  Monitor,
  Tablet,
  Smartphone,
  Clock,
  Loader2,
} from 'lucide-react';
import { safeFormatRelative } from '@/lib/safe-date';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { WSEventType } from '@/lib/ws-events';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface ConnectedDevice {
  socketId: string;
  deviceName: string;
  deviceType: string;
  connectedAt: string;
}

interface DeviceIndicatorProps {
  initialCount?: number;
}

export function DeviceIndicator({ initialCount = 0 }: DeviceIndicatorProps) {
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [connectedCount, setConnectedCount] = useState(initialCount);
  const [prevCount, setPrevCount] = useState(initialCount);
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const { isConnected: wsConnected, isReconnecting, status, on } = useWebSocket();
  const { isOnline } = useNetworkStatus();

  // Set mounted state after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch initial device list
  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch('/api/devices');
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
        setConnectedCount(data.connectedCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  }, []);

  // Fetch on mount and when popover opens
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Refresh when popover opens
  useEffect(() => {
    if (isOpen) {
      fetchDevices();
    }
  }, [isOpen, fetchDevices]);

  // Listen for device connection events
  useEffect(() => {
    if (!on) return;

    const cleanupConnected = on(WSEventType.DEVICE_CONNECTED, (data: ConnectedDevice) => {
      console.log('[DeviceIndicator] Device connected:', data);
      setDevices((prev) => {
        // Avoid duplicates
        if (prev.some((d) => d.socketId === data.socketId)) {
          return prev;
        }
        return [...prev, data];
      });
      setConnectedCount((prev) => {
        setPrevCount(prev);
        return prev + 1;
      });

      // Show toast notification for device connection
      toast.success(`New device connected: ${data.deviceName}`, {
        description: `${data.deviceType} device • Connected ${safeFormatRelative(data.connectedAt, { fallback: 'recently' })}`,
        duration: 3000,
      });
    });

    const cleanupDisconnected = on(WSEventType.DEVICE_DISCONNECTED, (data: { socketId: string }) => {
      console.log('[DeviceIndicator] Device disconnected:', data);

      // Find the device before removing it to get its name for the toast
      setDevices((prev) => {
        const disconnectedDevice = prev.find((d) => d.socketId === data.socketId);
        if (disconnectedDevice) {
          // Show toast notification for device disconnection
          toast.info(`Device disconnected: ${disconnectedDevice.deviceName}`, {
            description: `${disconnectedDevice.deviceType} device • No longer connected`,
            duration: 3000,
          });
        }
        return prev.filter((d) => d.socketId !== data.socketId);
      });
      setConnectedCount((prev) => {
        setPrevCount(prev);
        return Math.max(0, prev - 1);
      });
    });

    return () => {
      cleanupConnected();
      cleanupDisconnected();
    };
  }, [on]);

  // Get device type icon
  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />;
      case 'tablet':
        return <Tablet className="w-4 h-4" />;
      case 'desktop':
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  // Determine connection state for display
  // During SSR (before mount), always show disconnected state to match server render
  const getConnectionState = () => {
    if (!isMounted) return 'disconnected'; // Consistent with SSR
    if (!isOnline) return 'offline';
    if (isReconnecting) return 'reconnecting';
    if (wsConnected) return 'connected';
    return 'disconnected';
  };

  const connectionState = getConnectionState();

  // Get appropriate icon and color for connection state
  const getConnectionIcon = () => {
    switch (connectionState) {
      case 'offline':
        return <WifiOff className="w-3.5 h-3.5 text-red-500" />;
      case 'reconnecting':
        return <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />;
      case 'connected':
        return <Wifi className="w-3.5 h-3.5 text-green-500" />;
      case 'disconnected':
        return <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const getConnectionText = () => {
    switch (connectionState) {
      case 'offline':
        return 'Offline';
      case 'reconnecting':
        return 'Connecting...';
      case 'connected':
        return `${connectedCount}`;
      case 'disconnected':
        return `${connectedCount}`;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
          title={
            !isMounted
              ? `${connectedCount} device(s) connected - click to view`
              : connectionState === 'offline'
              ? 'Offline - Changes will be queued'
              : connectionState === 'reconnecting'
              ? 'Reconnecting...'
              : `${connectedCount} device(s) connected - click to view`
          }
        >
          {getConnectionIcon()}
          <AnimatePresence mode="wait">
            <motion.span
              key={connectedCount}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="font-medium inline-block"
            >
              {getConnectionText()}
            </motion.span>
          </AnimatePresence>
        </div>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              {connectionState === 'offline' ? (
                <WifiOff className="w-4 h-4 text-red-500" />
              ) : connectionState === 'reconnecting' ? (
                <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4 text-green-500" />
              )}
              {connectionState === 'offline'
                ? 'Offline'
                : connectionState === 'reconnecting'
                ? 'Reconnecting...'
                : 'Connected Devices'}
            </div>
            <Badge variant="secondary" className="text-xs">
              {connectedCount}
            </Badge>
          </div>

          {connectionState !== 'offline' && connectionState !== 'reconnecting' && (
            <>
              {devices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No devices connected
                </p>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2 p-1">
                    {devices.map((device) => (
                      <div
                        key={device.socketId}
                        className="flex items-start gap-3 p-2 rounded-md hover:bg-muted transition-colors"
                      >
                        <div className="mt-0.5 text-muted-foreground">
                          {getDeviceIcon(device.deviceType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {device.deviceName}
                            </p>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {device.deviceType}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>
                              Connected {safeFormatRelative(device.connectedAt, { fallback: 'recently' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </>
          )}

          {connectionState === 'offline' && (
            <p className="text-sm text-muted-foreground text-center py-4">
              You are offline. Changes will be queued and synced when you reconnect.
            </p>
          )}

          {connectionState === 'reconnecting' && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Attempting to reconnect...
            </p>
          )}

          <div className="pt-2 border-t text-xs text-center">
            {connectionState === 'offline' ? (
              <span className="text-red-600 dark:text-red-400">
                ● Offline - Changes will be queued
              </span>
            ) : connectionState === 'reconnecting' ? (
              <span className="text-amber-600 dark:text-amber-400">
                ● Reconnecting...
              </span>
            ) : wsConnected ? (
              <span className="text-green-600 dark:text-green-400">
                ● Real-time updates active
              </span>
            ) : (
              <span className="text-muted-foreground">
                Updates refresh on open
              </span>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
