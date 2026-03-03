'use client';

import { useEffect, useState, useMemo } from 'react';

type ServiceWorkerRegistration = {
  update: () => Promise<void>;
  uninstall: () => Promise<void>;
};

export function useServiceWorker() {
  // Initialize online state from navigator
  const initialOnlineStatus = useMemo(
    () => typeof navigator !== 'undefined' ? navigator.onLine : true,
    []
  );
  const [isOnline, setIsOnline] = useState(initialOnlineStatus);
  const [waitingServiceWorker, setWaitingServiceWorker] = useState<ServiceWorkerRegistration | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    // Check online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.navigator === 'undefined') {
      return;
    }

    // Check if service workers are supported
    if ('serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Service worker registered:', registration);

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available
                  setHasUpdate(true);
                  setWaitingServiceWorker({
                    update: async () => {
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                    },
                    uninstall: async () => {
                      await registration.unregister();
                      window.location.reload();
                    },
                  });
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('[SW] Service worker registration failed:', error);
        });

      // Listen for controlling service worker changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Refresh the page when the new service worker takes control
        window.location.reload();
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
          setHasUpdate(true);
        }
      });
    }
  }, []);

  return {
    isOnline,
    hasUpdate,
    waitingServiceWorker,
    updateServiceWorker: () => {
      if (waitingServiceWorker) {
        waitingServiceWorker.update();
      }
    },
  };
}

export function unregisterServiceWorkers() {
  if (typeof window === 'undefined' || typeof window.navigator === 'undefined') {
    return Promise.resolve();
  }

  if ('serviceWorker' in navigator) {
    return navigator.serviceWorker.getRegistrations().then((registrations) => {
      return Promise.all(
        registrations.map((registration) => registration.unregister())
      );
    });
  }

  return Promise.resolve();
}
