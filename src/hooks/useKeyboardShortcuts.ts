'use client';

import { useEffect, useCallback, useRef } from 'react';

interface ShortcutConfig {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: (e: KeyboardEvent) => void;
  description: string;
  preventDefault?: boolean;
}

interface KeyboardShortcutsOptions {
  disableInInputs?: boolean;
  disabled?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options: KeyboardShortcutsOptions = {}
) {
  const { disableInInputs = true, disabled = false } = options;
  const handlersRef = useRef<Map<string, ShortcutConfig[]>>(new Map());

  // Update handlers map when shortcuts change
  useEffect(() => {
    const map = new Map<string, ShortcutConfig[]>();

    shortcuts.forEach((shortcut) => {
      const key = shortcut.key.toLowerCase();
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(shortcut);
    });

    handlersRef.current = map;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;

      const key = e.key.toLowerCase();

      // Check if we should ignore shortcuts in input fields
      if (disableInInputs) {
        const activeElement = document.activeElement;
        const tagName = activeElement?.tagName.toLowerCase();
        const isInput =
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          (activeElement as HTMLElement)?.isContentEditable;

        if (isInput) {
          // Allow Escape and Cmd/Ctrl+Enter in inputs
          if (key === 'escape' || (e.metaKey || e.ctrlKey)) {
            // Continue processing these keys
          } else {
            return; // Skip all other shortcuts in inputs
          }
        }
      }

      // Find matching shortcuts
      const matchingShortcuts = handlersRef.current.get(key);

      if (matchingShortcuts) {
        for (const shortcut of matchingShortcuts) {
          // Support OR pattern for metaKey/ctrlKey: when both are true, accept either one
          const modifierMatch = (() => {
            const metaMatches = shortcut.metaKey === undefined || shortcut.metaKey === e.metaKey;
            const ctrlMatches = shortcut.ctrlKey === undefined || shortcut.ctrlKey === e.ctrlKey;

            // If both metaKey and ctrlKey are explicitly set to true, treat it as OR (accept either)
            if (shortcut.metaKey === true && shortcut.ctrlKey === true) {
              return e.metaKey || e.ctrlKey;
            }

            // Otherwise, both must match
            return metaMatches && ctrlMatches;
          })();

          const shiftMatch = shortcut.shiftKey === undefined || shortcut.shiftKey === e.shiftKey;
          const altMatch = shortcut.altKey === undefined || shortcut.altKey === e.altKey;

          if (modifierMatch && shiftMatch && altMatch) {
            if (shortcut.preventDefault !== false) {
              e.preventDefault();
            }
            shortcut.handler(e);
            return; // Only execute the first match
          }
        }
      }
    },
    [disabled, disableInInputs]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    shortcuts: shortcuts.map((s) => ({
      keys: getShortcutDisplay(s),
      description: s.description,
    })),
  };
}

function getShortcutDisplay(shortcut: ShortcutConfig): string {
  const parts: string[] = [];

  if (shortcut.metaKey) parts.push('⌘');
  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.shiftKey) parts.push('Shift');
  if (shortcut.altKey) parts.push('Alt');

  // Format special keys
  const keyDisplay: Record<string, string> = {
    ' ': 'Space',
    'escape': 'Esc',
    'arrowup': '↑',
    'arrowdown': '↓',
    'arrowleft': '←',
    'arrowright': '→',
    'enter': 'Enter',
    'tab': 'Tab',
    'backspace': 'Backspace',
    'delete': 'Delete',
  };

  const key = keyDisplay[shortcut.key.toLowerCase()] || shortcut.key;
  parts.push(key);

  return parts.join(isMac() ? '' : '+');
}

function isMac(): boolean {
  if (typeof window === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);
}

// Helper hook to check if we're in an input field
export function useIsInInput() {
  const getIsInInput = useCallback(() => {
    const activeElement = document.activeElement;
    const tagName = activeElement?.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      (activeElement as HTMLElement)?.isContentEditable
    );
  }, []);

  return getIsInInput;
}
