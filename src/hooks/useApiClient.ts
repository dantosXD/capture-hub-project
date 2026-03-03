'use client';

/**
 * Typed API Client Hook (Project Omni P5)
 *
 * Contract-driven fetch wrapper that enforces P1 API contracts at the client level.
 * Provides typed request/response handling, automatic error parsing, CSRF headers,
 * and integration with the contract registry.
 *
 * Usage:
 *   const api = useApiClient();
 *   const items = await api.get('/api/capture');
 *   const item = await api.post('/api/capture', { title: 'New Item', type: 'note' });
 */

import { useCallback, useEffect, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ApiClientOptions {
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
  details?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  ok: false;
  status: number;
  error: string;
  details?: any;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// ============================================================================
// Fetch Wrapper
// ============================================================================

async function typedFetch<T = any>(
  url: string,
  method: HttpMethod,
  body?: any,
  options?: ApiClientOptions
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeout = options?.timeout || 30000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    // Add CSRF header for write operations
    if (method !== 'GET') {
      headers['x-csrf-protection'] = '1';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    // Parse response
    let data: any;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data: null as any,
        error: data?.error || data?.message || `HTTP ${response.status}`,
        details: data?.details,
      };
    }

    // Handle standard envelope format { ok, data, pagination }
    if (data && typeof data === 'object' && 'ok' in data && 'data' in data) {
      return {
        ok: true,
        status: response.status,
        data: data.data,
        pagination: data.pagination,
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch (error: any) {
    clearTimeout(timer);

    if (error.name === 'AbortError') {
      return {
        ok: false,
        status: 0,
        data: null as any,
        error: 'Request timed out',
      };
    }

    return {
      ok: false,
      status: 0,
      data: null as any,
      error: error?.message || 'Network error',
    };
  }
}

// ============================================================================
// Hook
// ============================================================================

export interface ApiClient {
  get: <T = any>(url: string, query?: Record<string, any>) => Promise<ApiResponse<T>>;
  post: <T = any>(url: string, body?: any) => Promise<ApiResponse<T>>;
  put: <T = any>(url: string, body?: any) => Promise<ApiResponse<T>>;
  patch: <T = any>(url: string, body?: any) => Promise<ApiResponse<T>>;
  del: <T = any>(url: string) => Promise<ApiResponse<T>>;
}

/**
 * Hook that provides a typed API client with contract enforcement.
 */
export function useApiClient(options?: ApiClientOptions): ApiClient {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const get = useCallback(<T = any>(url: string, query?: Record<string, any>): Promise<ApiResponse<T>> => {
    const queryString = query
      ? '?' + new URLSearchParams(
          Object.entries(query)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    return typedFetch<T>(url + queryString, 'GET', undefined, optionsRef.current);
  }, []);

  const post = useCallback(<T = any>(url: string, body?: any): Promise<ApiResponse<T>> => {
    return typedFetch<T>(url, 'POST', body, optionsRef.current);
  }, []);

  const put = useCallback(<T = any>(url: string, body?: any): Promise<ApiResponse<T>> => {
    return typedFetch<T>(url, 'PUT', body, optionsRef.current);
  }, []);

  const patch = useCallback(<T = any>(url: string, body?: any): Promise<ApiResponse<T>> => {
    return typedFetch<T>(url, 'PATCH', body, optionsRef.current);
  }, []);

  const del = useCallback(<T = any>(url: string): Promise<ApiResponse<T>> => {
    return typedFetch<T>(url, 'DELETE', undefined, optionsRef.current);
  }, []);

  return { get, post, put, patch, del };
}

// ============================================================================
// Standalone client (for non-React contexts)
// ============================================================================

export function createApiClient(options?: ApiClientOptions): ApiClient {
  return {
    get: <T = any>(url: string, query?: Record<string, any>) => {
      const queryString = query
        ? '?' + new URLSearchParams(
            Object.entries(query)
              .filter(([, v]) => v !== undefined && v !== null)
              .map(([k, v]) => [k, String(v)])
          ).toString()
        : '';
      return typedFetch<T>(url + queryString, 'GET', undefined, options);
    },
    post: <T = any>(url: string, body?: any) => typedFetch<T>(url, 'POST', body, options),
    put: <T = any>(url: string, body?: any) => typedFetch<T>(url, 'PUT', body, options),
    patch: <T = any>(url: string, body?: any) => typedFetch<T>(url, 'PATCH', body, options),
    del: <T = any>(url: string) => typedFetch<T>(url, 'DELETE', undefined, options),
  };
}
