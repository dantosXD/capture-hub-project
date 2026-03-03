'use client';

/**
 * AI-Aware UI Hooks (Project Omni P5)
 *
 * React hooks that expose the P4 AI service to components.
 * Handles loading states, errors, caching, and graceful degradation.
 *
 * Usage:
 *   const { tags, isLoading } = useTagSuggestions({ title, content });
 *   const { summary, generate } = useSummary();
 *   const { results, search } = useSemanticSearch();
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

interface TagSuggestionInput {
  title: string;
  content?: string;
}

interface SummaryInput {
  content: string;
  maxSentences?: number;
}

interface SearchInput {
  query: string;
  limit?: number;
}

// ============================================================================
// useTagSuggestions
// ============================================================================

/**
 * Hook for AI-powered tag suggestions.
 * Debounces requests and caches results per content hash.
 */
export function useTagSuggestions(options?: { debounceMs?: number }): {
  suggest: (input: TagSuggestionInput) => void;
  tags: string[];
  confidence: number;
  isLoading: boolean;
  error: string | null;
  clear: () => void;
} {
  const debounceMs = options?.debounceMs ?? 500;
  const [state, setState] = useState<AsyncState<{ tags: string[]; confidence: number }>>({
    data: null,
    isLoading: false,
    error: null,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, { tags: string[]; confidence: number }>>(new Map());

  const suggest = useCallback((input: TagSuggestionInput) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const cacheKey = `${input.title}:${(input.content || '').substring(0, 200)}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setState({ data: cached, isLoading: false, error: null });
      return;
    }

    timerRef.current = setTimeout(async () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const response = await fetch('/api/ai/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-protection': '1' },
          body: JSON.stringify({ title: input.title, content: input.content }),
        });
        const data = await response.json();
        const result = {
          tags: data.suggestedTags || [],
          confidence: data.suggestedTags?.length > 0 ? 0.7 : 0,
        };
        cacheRef.current.set(cacheKey, result);
        setState({ data: result, isLoading: false, error: null });
      } catch (err: any) {
        setState({ data: null, isLoading: false, error: err?.message || 'Failed to get suggestions' });
      }
    }, debounceMs);
  }, [debounceMs]);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState({ data: null, isLoading: false, error: null });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    suggest,
    tags: state.data?.tags || [],
    confidence: state.data?.confidence || 0,
    isLoading: state.isLoading,
    error: state.error,
    clear,
  };
}

// ============================================================================
// useSummary
// ============================================================================

/**
 * Hook for AI-powered content summarization.
 */
export function useSummary(): {
  generate: (input: SummaryInput) => Promise<string | null>;
  summary: string | null;
  isLoading: boolean;
  error: string | null;
  clear: () => void;
} {
  const [state, setState] = useState<AsyncState<string>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const generate = useCallback(async (input: SummaryInput): Promise<string | null> => {
    setState({ data: null, isLoading: true, error: null });
    try {
      const response = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-protection': '1' },
        body: JSON.stringify({
          content: input.content,
          maxLength: input.maxSentences || 3,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to summarize');
      setState({ data: data.summary, isLoading: false, error: null });
      return data.summary;
    } catch (err: any) {
      setState({ data: null, isLoading: false, error: err?.message || 'Failed to summarize' });
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return {
    generate,
    summary: state.data,
    isLoading: state.isLoading,
    error: state.error,
    clear,
  };
}

// ============================================================================
// useSemanticSearch
// ============================================================================

/**
 * Hook for AI-powered semantic search.
 * Debounces search queries and returns ranked results.
 */
export function useSemanticSearch(options?: { debounceMs?: number }): {
  search: (input: SearchInput) => void;
  results: Array<{ id: string; title: string; score: number; snippet?: string }>;
  isSearching: boolean;
  error: string | null;
  clear: () => void;
} {
  const debounceMs = options?.debounceMs ?? 300;
  const [state, setState] = useState<AsyncState<Array<{ id: string; title: string; score: number; snippet?: string }>>>({
    data: null,
    isLoading: false,
    error: null,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((input: SearchInput) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!input.query || input.query.trim().length < 2) {
      setState({ data: [], isLoading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    timerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(input.query)}&limit=${input.limit || 10}`);
        const data = await response.json();
        const items = Array.isArray(data) ? data : (data.data || data.items || []);
        setState({
          data: items.map((item: any, i: number) => ({
            id: item.id,
            title: item.title || 'Untitled',
            score: item.score || (1 - i * 0.05),
            snippet: item.content?.substring(0, 150),
          })),
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        setState({ data: null, isLoading: false, error: err?.message || 'Search failed' });
      }
    }, debounceMs);
  }, [debounceMs]);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState({ data: null, isLoading: false, error: null });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    search,
    results: state.data || [],
    isSearching: state.isLoading,
    error: state.error,
    clear,
  };
}

// ============================================================================
// useAIInsights
// ============================================================================

/**
 * Hook for AI-powered dashboard insights.
 */
export function useAIInsights(): {
  fetch: () => Promise<void>;
  insight: string | null;
  suggestions: Array<{ text: string; action: string; target?: string }>;
  isLoading: boolean;
  error: string | null;
} {
  const [state, setState] = useState<AsyncState<{
    insight: string;
    suggestions: Array<{ text: string; action: string; target?: string }>;
  }>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const fetchInsights = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-protection': '1' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate insights');
      setState({
        data: { insight: data.insight || '', suggestions: data.suggestions || [] },
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      setState({ data: null, isLoading: false, error: err?.message || 'Failed to load insights' });
    }
  }, []);

  return {
    fetch: fetchInsights,
    insight: state.data?.insight || null,
    suggestions: state.data?.suggestions || [],
    isLoading: state.isLoading,
    error: state.error,
  };
}

// ============================================================================
// useAIStatus
// ============================================================================

/**
 * Hook that checks if AI features are available.
 * Components can use this to conditionally show AI-powered UI.
 */
export function useAIStatus(): {
  isAvailable: boolean;
  isChecking: boolean;
} {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(data => {
        setIsAvailable(data.ai?.configured === true || data.aiConfigured === true);
        setIsChecking(false);
      })
      .catch(() => {
        setIsAvailable(false);
        setIsChecking(false);
      });
  }, []);

  return { isAvailable, isChecking };
}
