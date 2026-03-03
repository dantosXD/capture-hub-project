/**
 * Tests for useNetworkStatus hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkStatus } from './useNetworkStatus';

describe('useNetworkStatus', () => {
  // Store original navigator.onLine
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    // Reset navigator.onLine to true before each test
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    // Restore original value
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: originalOnLine,
    });
  });

  it('should initialize with online status from navigator.onLine', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.status).toBe('online');
    expect(result.current.wasOffline).toBe(false);
  });

  it('should initialize with offline status when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);
    expect(result.current.status).toBe('offline');
    expect(result.current.wasOffline).toBe(false);
  });

  it('should handle going offline', () => {
    const { result } = renderHook(() => useNetworkStatus());

    // Dispatch offline event
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);
    expect(result.current.status).toBe('offline');
    expect(result.current.wasOffline).toBe(true);
  });

  it('should handle going online', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const { result } = renderHook(() => useNetworkStatus());

    // Dispatch online event
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.status).toBe('online');
  });

  it('should track wasOffline flag when going offline', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.wasOffline).toBe(false);

    // Go offline
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.wasOffline).toBe(true);

    // Go back online - wasOffline should remain true
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.wasOffline).toBe(true);
  });

  it('should handle multiple offline/online transitions', () => {
    const { result } = renderHook(() => useNetworkStatus());

    // Go offline
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);

    // Go online
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOnline).toBe(true);

    // Go offline again
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);

    // Go online again
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('should not cause re-renders on unmount', () => {
    const { result, unmount } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(true);

    // Unmount the hook
    unmount();

    // Dispatch events after unmount - should not throw or cause issues
    expect(() => {
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
    }).not.toThrow();
  });

  it('should use functional setState to avoid stale closures', () => {
    const { result } = renderHook(() => useNetworkStatus());

    // Rapidly toggle online/offline status
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Should correctly reflect the final offline state
    expect(result.current.isOnline).toBe(false);
    expect(result.current.wasOffline).toBe(true);
  });
});
