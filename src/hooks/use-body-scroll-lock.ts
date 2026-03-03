'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook to lock body scroll when a modal is open
 * Handles nested modals correctly by tracking the lock count
 */
export function useBodyScrollLock(isLocked: boolean) {
  const lockCountRef = useRef(0);

  useEffect(() => {
    if (isLocked) {
      lockCountRef.current += 1;

      // Only lock body if this is the first lock
      if (lockCountRef.current === 1) {
        const originalOverflow = document.body.style.overflow;
        const originalPaddingRight = document.body.style.paddingRight;

        // Save original styles
        document.body.dataset.originalOverflow = originalOverflow;
        document.body.dataset.originalPaddingRight = document.body.style.paddingRight;

        // Calculate scrollbar width to prevent layout shift
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        // Lock body scroll
        document.body.style.overflow = 'hidden';

        // Add padding to prevent layout shift when scrollbar is hidden
        if (scrollbarWidth > 0) {
          document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
      }

      return () => {
        lockCountRef.current -= 1;

        // Only unlock if this was the last lock
        if (lockCountRef.current === 0) {
          // Restore original styles
          document.body.style.overflow = document.body.dataset.originalOverflow || '';
          document.body.style.paddingRight = document.body.dataset.originalPaddingRight || '';

          // Clean up dataset
          delete document.body.dataset.originalOverflow;
          delete document.body.dataset.originalPaddingRight;
        }
      };
    }
  }, [isLocked]);
}
