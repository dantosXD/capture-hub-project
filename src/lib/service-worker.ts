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
      // FORCE DISABLE SERVICE WORKER IN DEV
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach(reg => reg.unregister());
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
