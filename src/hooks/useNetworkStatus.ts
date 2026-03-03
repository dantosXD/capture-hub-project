'use client';

import { useState, useEffect } from 'react';

export type NetworkStatus = 'online' | 'offline' | 'unknown';

export interface NetworkStatusReturn {
  isOnline: boolean;
  isOffline: boolean;
  status: NetworkStatus;
  wasOffline: boolean; // Track if user was previously offline (for showing reconnected message)
}

/**
 * Hook to detect network connectivity changes
 * Uses browser's navigator.onLine and online/offline events
 *
 * Features:
 * - Detects when browser goes offline (no network connection)
 * - Detects when browser comes back online
 * - Tracks if user was previously offline (for showing reconnected messages)
 */
export function useNetworkStatus(): NetworkStatusReturn {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    // Initialize from navigator if available
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true; // Assume online if can't detect
  });

  const [wasOffline, setWasOffline] = useState<boolean>(false);

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    // Handle going online
    const handleOnline = () => {
      console.log('[useNetworkStatus] Network connection restored');
      setIsOnline(() => true);
    };

    // Handle going offline
    const handleOffline = () => {
      console.log('[useNetworkStatus] Network connection lost');
      setIsOnline(() => false);
      setWasOffline(() => true);
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // Empty dependency array since we use functional setState

  return {
    isOnline,
    isOffline: !isOnline,
    status: isOnline ? 'online' : 'offline',
    wasOffline,
  };
}
