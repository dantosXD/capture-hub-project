'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, X } from 'lucide-react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Compute initial install status and iOS status
  const initialInstallStatus = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches,
    []
  );

  const isIOS = useMemo(
    () => {
      if (typeof window === 'undefined') return false;
      return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    },
    []
  );

  // Sync initial install status to state
  useEffect(() => {
    setIsInstalled(initialInstallStatus);
  }, [initialInstallStatus]);

  useEffect(() => {
    // Don't show install prompt if already installed as PWA
    if (isInstalled) {
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show install dialog after a short delay (only once per session)
      const hasShownPrompt = sessionStorage.getItem('pwa-install-prompt-shown');
      if (!hasShownPrompt) {
        setTimeout(() => {
          setShowInstallDialog(true);
          sessionStorage.setItem('pwa-install-prompt-shown', 'true');
        }, 3000);
      }
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallDialog(false);
      toast.success('App installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for user to respond
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      toast.success('Installing app...');
    } else {
      toast.info('Install cancelled');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowInstallDialog(false);
  };

  const handleDismiss = () => {
    setShowInstallDialog(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if already installed or no prompt available
  if (isInstalled || (!deferredPrompt && !isIOS)) {
    return null;
  }

  // iOS install button (manual instructions)
  if (isIOS) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-20 right-4 z-50 shadow-lg md:hidden"
          onClick={() => setShowInstallDialog(true)}
        >
          <Download className="h-4 w-4 mr-2" />
          Install App
        </Button>

        <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
          <DialogContent className="sm:max-w-md">
            <button
              onClick={() => setShowInstallDialog(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
            <DialogHeader>
              <DialogTitle>Install Capture Hub</DialogTitle>
              <DialogDescription>
                Install Capture Hub on your iOS device for the best experience.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Tap the <strong>Share</strong> button
                  <span className="inline-block ml-1">
                    <svg className="inline w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                      <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </span>
                  in Safari&apos;s toolbar
                </li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                <li>Tap <strong>Add</strong> to confirm</li>
              </ol>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInstallDialog(false)}>
                Maybe Later
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Android/Desktop install button
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-20 right-4 z-50 shadow-lg md:hidden"
        onClick={() => setShowInstallDialog(true)}
      >
        <Download className="h-4 w-4 mr-2" />
        Install App
      </Button>

      <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
        <DialogContent className="sm:max-w-md">
          <button
            onClick={handleDismiss}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader>
            <DialogTitle>Install Capture Hub</DialogTitle>
            <DialogDescription>
              Install Capture Hub on your device for quick access and offline support.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Download className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Benefits of installing</h4>
                <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                  <li>• Faster load times</li>
                  <li>• Works offline</li>
                  <li>• Full-screen experience</li>
                  <li>• App icon on home screen</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleDismiss}>
              Not Now
            </Button>
            <Button onClick={handleInstallClick}>
              <Download className="h-4 w-4 mr-2" />
              Install App
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
