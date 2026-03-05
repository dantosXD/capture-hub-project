'use client';

import { useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL_MS = 60_000; // Check every 60 seconds

/**
 * Polls for past-due reminders and fires browser Notification API alerts.
 * Marks each fired reminder as sent via PATCH /api/capture/:id.
 *
 * Requires Notification.requestPermission() — called on first mount.
 */
export function useReminderPoller() {
  const permissionRef = useRef<NotificationPermission>('default');
  const firedRef = useRef<Set<string>>(new Set());

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      permissionRef.current = 'granted';
      return;
    }
    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      permissionRef.current = result;
    } else {
      permissionRef.current = 'denied';
    }
  }, []);

  const checkReminders = useCallback(async () => {
    if (permissionRef.current !== 'granted') return;

    try {
      const now = new Date().toISOString();
      // Fetch items where reminder is past, not sent, and not archived/trash
      const res = await fetch(
        `/api/today`,
        { cache: 'no-store' }
      );
      if (!res.ok) return;

      const data = await res.json();
      const pastReminders: Array<{
        id: string;
        title: string;
        reminder: string | null;
        reminderSent: boolean;
      }> = data.pastReminders || [];

      for (const item of pastReminders) {
        if (firedRef.current.has(item.id)) continue;

        firedRef.current.add(item.id);

        // Fire browser notification
        try {
          new Notification('Capture Hub Reminder', {
            body: item.title,
            icon: '/icon.png',
            tag: `reminder-${item.id}`,
          });
        } catch {
          // Notification constructor can throw in some environments
        }

        // Mark as sent on server (fire-and-forget)
        fetch(`/api/capture/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reminderSent: true }),
        }).catch(() => {
          // Non-critical — will retry on next poll if still showing
          firedRef.current.delete(item.id);
        });
      }
    } catch {
      // Network errors are non-fatal for reminder polling
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Request permission on mount, then start polling
    requestPermission().then(() => {
      checkReminders(); // Immediate first check
    });

    const interval = setInterval(checkReminders, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [requestPermission, checkReminders]);
}
