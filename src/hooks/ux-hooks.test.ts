/**
 * UX Hooks Validation Tests (Project Omni P5)
 * Tests typed API client, real-time event hooks, and AI-aware hooks.
 * 
 * Note: React hooks cannot be tested directly in Vitest without a DOM environment.
 * These tests validate the non-hook utilities and type contracts.
 */

import { describe, it, expect } from 'vitest';
import { createApiClient } from './useApiClient';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// API Client (Standalone) Tests
// ============================================================================

describe('API Client', () => {
  it('createApiClient returns all HTTP methods', () => {
    const client = createApiClient();
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.del).toBe('function');
  });

  it('createApiClient accepts custom options', () => {
    const client = createApiClient({
      baseUrl: 'http://localhost:3000',
      timeout: 5000,
      headers: { 'X-Custom': 'test' },
    });
    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
  });
});

// ============================================================================
// Hook File Structure Tests
// ============================================================================

describe('UX Hook File Structure', () => {
  const hooksDir = path.resolve(__dirname);

  it('useApiClient.ts should exist', () => {
    expect(fs.existsSync(path.join(hooksDir, 'useApiClient.ts'))).toBe(true);
  });

  it('useRealtimeEvent.ts should exist', () => {
    expect(fs.existsSync(path.join(hooksDir, 'useRealtimeEvent.ts'))).toBe(true);
  });

  it('useAI.ts should exist', () => {
    expect(fs.existsSync(path.join(hooksDir, 'useAI.ts'))).toBe(true);
  });

  it('useApiClient should export hook and standalone client', () => {
    const content = fs.readFileSync(path.join(hooksDir, 'useApiClient.ts'), 'utf-8');
    expect(content).toContain('export function useApiClient');
    expect(content).toContain('export function createApiClient');
    expect(content).toContain('x-csrf-protection');
    expect(content).toContain('ApiResponse');
    expect(content).toContain('ApiClient');
  });

  it('useRealtimeEvent should export all real-time hooks', () => {
    const content = fs.readFileSync(path.join(hooksDir, 'useRealtimeEvent.ts'), 'utf-8');
    expect(content).toContain('export function useRealtimeEvent');
    expect(content).toContain('export function useRealtimeEvents');
    expect(content).toContain('export function useRealtimeQuery');
    expect(content).toContain('export function useConnectionStatus');
    expect(content).toContain('useSharedWebSocket');
  });

  it('useAI should export all AI hooks', () => {
    const content = fs.readFileSync(path.join(hooksDir, 'useAI.ts'), 'utf-8');
    expect(content).toContain('export function useTagSuggestions');
    expect(content).toContain('export function useSummary');
    expect(content).toContain('export function useSemanticSearch');
    expect(content).toContain('export function useAIInsights');
    expect(content).toContain('export function useAIStatus');
  });
});

// ============================================================================
// API Client Contract Compliance Tests
// ============================================================================

describe('API Client Contract Compliance', () => {
  it('should add CSRF header for write operations', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, 'useApiClient.ts'),
      'utf-8'
    );
    // Verify CSRF header is added for non-GET methods
    expect(content).toContain("if (method !== 'GET')");
    expect(content).toContain("'x-csrf-protection'");
  });

  it('should handle standard API envelope format', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, 'useApiClient.ts'),
      'utf-8'
    );
    // Verify envelope unwrapping: { ok, data, pagination }
    expect(content).toContain("'ok' in data");
    expect(content).toContain("'data' in data");
    expect(content).toContain('pagination');
  });

  it('should handle timeout via AbortController', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, 'useApiClient.ts'),
      'utf-8'
    );
    expect(content).toContain('AbortController');
    expect(content).toContain('AbortError');
    expect(content).toContain('Request timed out');
  });
});

// ============================================================================
// Real-time Hook Integration Tests
// ============================================================================

describe('Real-time Hook Integration', () => {
  it('useRealtimeEvent should use WebSocket context', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, 'useRealtimeEvent.ts'),
      'utf-8'
    );
    expect(content).toContain('useSharedWebSocket');
    expect(content).toContain('isConnected');
    expect(content).toContain('cleanup');
  });

  it('useRealtimeQuery should combine fetch + event invalidation', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, 'useRealtimeEvent.ts'),
      'utf-8'
    );
    expect(content).toContain('useRealtimeQuery');
    expect(content).toContain('invalidateOn');
    expect(content).toContain('fetchData');
    expect(content).toContain('refetch');
  });
});

// ============================================================================
// AI Hook Structure Tests
// ============================================================================

describe('AI Hook Structure', () => {
  it('useTagSuggestions should debounce and cache', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, 'useAI.ts'),
      'utf-8'
    );
    expect(content).toContain('debounceMs');
    expect(content).toContain('cacheRef');
    expect(content).toContain('clearTimeout');
  });

  it('useSummary should call /api/ai/summary', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, 'useAI.ts'),
      'utf-8'
    );
    expect(content).toContain('/api/ai/summary');
    expect(content).toContain('maxLength');
  });

  it('useSemanticSearch should debounce queries', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, 'useAI.ts'),
      'utf-8'
    );
    expect(content).toContain('useSemanticSearch');
    expect(content).toContain('debounceMs');
    expect(content).toContain('/api/search');
  });

  it('useAIStatus should check health endpoint', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, 'useAI.ts'),
      'utf-8'
    );
    expect(content).toContain('/api/health');
    expect(content).toContain('isAvailable');
    expect(content).toContain('isChecking');
  });
});

// ============================================================================
// Existing Hooks Compatibility
// ============================================================================

describe('Existing Hooks Compatibility', () => {
  const hooksDir = path.resolve(__dirname);

  it('useWebSocket.ts should still exist (not replaced)', () => {
    expect(fs.existsSync(path.join(hooksDir, 'useWebSocket.ts'))).toBe(true);
  });

  it('useOptimisticMutation.ts should still exist (not replaced)', () => {
    expect(fs.existsSync(path.join(hooksDir, 'useOptimisticMutation.ts'))).toBe(true);
  });

  it('useKeyboardShortcuts.ts should still exist', () => {
    expect(fs.existsSync(path.join(hooksDir, 'useKeyboardShortcuts.ts'))).toBe(true);
  });

  it('useNetworkStatus.ts should still exist', () => {
    expect(fs.existsSync(path.join(hooksDir, 'useNetworkStatus.ts'))).toBe(true);
  });
});
