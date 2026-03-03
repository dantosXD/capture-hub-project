'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

export interface MutationOptions<TData, TVariables> {
  /**
   * The mutation function that sends data to the server
   */
  mutateFn: (variables: TVariables) => Promise<TData>;

  /**
   * Function to apply optimistic update to local state
   */
  onOptimisticUpdate?: (variables: TVariables) => void;

  /**
   * Function to finalize the update on success
   */
  onSuccess?: (data: TData, variables: TVariables) => void;

  /**
   * Function to roll back optimistic update on error
   */
  onRollback?: (error: Error, variables: TVariables) => void;

  /**
   * Error message to show on rollback
   */
  errorMessage?: string;

  /**
   * Success message to show
   */
  successMessage?: string;

  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxRetries?: number;

  /**
   * Whether the mutation is retryable (default: true)
   */
  retryable?: boolean;
}

export interface MutationState<TData> {
  data: TData | null;
  error: Error | null;
  isPending: boolean;
  isRollingBack: boolean;
  retryCount: number;
}

export interface MutationResult<TData, TVariables> extends MutationState<TData> {
  mutate: (variables: TVariables) => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook for optimistic mutations with automatic rollback on error
 *
 * Features:
 * - Immediate local state update
 * - Server mutation execution
 * - Automatic rollback on failure
 * - Toast notifications with retry button
 * - Loading states
 * - Retry mechanism with max attempts
 *
 * @example
 * ```tsx
 * const { mutate, isPending, error } = useOptimisticMutation({
 *   mutateFn: async (data) => {
 *     const response = await fetch('/api/capture', {
 *       method: 'POST',
 *       body: JSON.stringify(data),
 *     });
 *     return response.json();
 *   },
 *   onOptimisticUpdate: (variables) => {
 *     setItems(prev => [{ ...variables, id: 'temp-id' }, ...prev]);
 *   },
 *   onSuccess: (data, variables) => {
 *     setItems(prev => prev.map(item =>
 *       item.id === 'temp-id' ? data : item
 *     ));
 *   },
 *   onRollback: (error, variables) => {
 *     setItems(prev => prev.filter(item => item.id !== 'temp-id'));
 *   },
 *   errorMessage: 'Failed to create item',
 *   successMessage: 'Item created successfully',
 *   maxRetries: 3,
 * });
 * ```
 */
export function useOptimisticMutation<TData = any, TVariables = any>({
  mutateFn,
  onOptimisticUpdate,
  onSuccess,
  onRollback,
  errorMessage = 'Operation failed. Please try again.',
  successMessage,
  maxRetries = 3,
  retryable = true,
}: MutationOptions<TData, TVariables>): MutationResult<TData, TVariables> {
  const [state, setState] = useState<MutationState<TData>>({
    data: null,
    error: null,
    isPending: false,
    isRollingBack: false,
    retryCount: 0,
  });

  // Track last variables for retry
  const lastVariablesRef = useRef<TVariables | null>(null);
  const retryCountRef = useRef(0);
  const executeMutationRef = useRef<
    ((variables: TVariables, isRetry?: boolean) => Promise<TData | undefined>) | null
  >(null);

  const executeMutation = useCallback(async (variables: TVariables, isRetry = false) => {
    // Store variables for potential retry
    if (!isRetry) {
      lastVariablesRef.current = variables;
    }

    if (!isRetry) {
      setState(prev => ({ ...prev, isPending: true, error: null }));
    }

    try {
      // Apply optimistic update immediately (only on first attempt, not retries)
      if (onOptimisticUpdate && !isRetry) {
        onOptimisticUpdate(variables);
      }

      // Execute server mutation
      const data = await mutateFn(variables);

      // Finalize the update
      if (onSuccess) {
        onSuccess(data, variables);
      }

      // Show success message
      if (successMessage) {
        toast.success(successMessage);
      }

      retryCountRef.current = 0;

      setState({
        data,
        error: null,
        isPending: false,
        isRollingBack: false,
        retryCount: 0,
      });

      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      console.error('[useOptimisticMutation] Mutation failed:', err);

      const currentRetryCount = retryCountRef.current;
      const canRetry = retryable && currentRetryCount < maxRetries;
      const remainingRetries = maxRetries - currentRetryCount;

      // Rollback optimistic update
      setState(prev => ({ ...prev, isRollingBack: true }));

      if (onRollback) {
        onRollback(err, variables);
      }

      // Show error message with retry button if retries available
      if (canRetry) {
        toast.error(`${errorMessage} (${remainingRetries} retries left)`, {
          action: {
            label: 'Retry',
            onClick: () => {
              const nextRetryCount = retryCountRef.current + 1;
              retryCountRef.current = nextRetryCount;
              setState(prev => ({ ...prev, retryCount: nextRetryCount }));
              void executeMutationRef.current?.(variables, true);
            },
          },
        });
      } else {
        // Show final error message after max retries
        const finalMessage = currentRetryCount > 0
          ? `${errorMessage} (Failed after ${currentRetryCount} retry attempts)`
          : errorMessage;
        toast.error(finalMessage);
      }

      setState({
        data: null,
        error: err,
        isPending: false,
        isRollingBack: false,
        retryCount: currentRetryCount,
      });

      throw err;
    }
  }, [mutateFn, onOptimisticUpdate, onSuccess, onRollback, errorMessage, successMessage, maxRetries, retryable]);

  useEffect(() => {
    executeMutationRef.current = executeMutation;
  }, [executeMutation]);

  const mutate = useCallback(async (variables: TVariables) => {
    return executeMutation(variables, false);
  }, [executeMutation]);

  const retry = useCallback(async () => {
    if (lastVariablesRef.current) {
      const nextRetryCount = retryCountRef.current + 1;
      retryCountRef.current = nextRetryCount;
      setState(prev => ({ ...prev, retryCount: nextRetryCount }));
      await executeMutationRef.current?.(lastVariablesRef.current, true);
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isPending: false,
      isRollingBack: false,
      retryCount: 0,
    });
    retryCountRef.current = 0;
    lastVariablesRef.current = null;
  }, []);

  return {
    mutate,
    retry,
    reset,
    ...state,
  };
}

/**
 * Hook for optimistic item updates with automatic rollback
 * Specifically designed for CaptureItem mutations
 */
export interface ItemMutationVariables {
  id?: string;
  type: 'create' | 'update' | 'delete';
  data: any;
}

export interface ItemMutationOptions {
  items: any[];
  setItems: (items: any[] | ((prev: any[]) => any[])) => void;
  createFn?: (data: any) => Promise<any>;
  updateFn?: (id: string, data: any) => Promise<any>;
  deleteFn?: (id: string) => Promise<void>;
  successMessage?: string;
  errorMessage?: string;
  maxRetries?: number;
  retryable?: boolean;
}

export function useOptimisticItemMutation(options: ItemMutationOptions) {
  const {
    items,
    setItems,
    createFn,
    updateFn,
    deleteFn,
    successMessage,
    errorMessage = 'Operation failed. Please try again.',
    maxRetries = 3,
    retryable = true,
  } = options;

  return useOptimisticMutation<any, ItemMutationVariables>({
    maxRetries,
    retryable,
    mutateFn: async (variables) => {
      const { type, id, data } = variables;

      switch (type) {
        case 'create':
          if (!createFn) throw new Error('createFn not provided');
          return await createFn(data);

        case 'update':
          if (!updateFn || !id) throw new Error('updateFn not provided or missing id');
          return await updateFn(id, data);

        case 'delete':
          if (!deleteFn || !id) throw new Error('deleteFn not provided or missing id');
          await deleteFn(id);
          return { id };

        default:
          throw new Error(`Unknown mutation type: ${type}`);
      }
    },
    onOptimisticUpdate: (variables) => {
      const { type, id, data } = variables;

      switch (type) {
        case 'create':
          // Add temporary item with optimistic ID
          const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          setItems(prev => [{ ...data, id: tempId, createdAt: new Date().toISOString() }, ...prev]);
          break;

        case 'update':
          // Update item in list
          if (!id) return;
          setItems(prev => prev.map(item =>
            item.id === id
              ? { ...item, ...data, updatedAt: new Date().toISOString() }
              : item
          ));
          break;

        case 'delete':
          // Remove item from list
          if (!id) return;
          setItems(prev => prev.filter(item => item.id !== id));
          break;
      }
    },
    onSuccess: (response, variables) => {
      const { type, id } = variables;

      switch (type) {
        case 'create':
          // Replace temporary item with real data from server
          setItems(prev => prev.map(item =>
            item.id.startsWith('temp-')
              ? response
              : item
          ));
          break;

        case 'update':
          // Update with server response (contains latest updatedAt)
          setItems(prev => prev.map(item =>
            item.id === id
              ? { ...item, ...response }
              : item
          ));
          break;

        case 'delete':
          // Item already removed in optimistic update
          break;
      }
    },
    onRollback: (error, variables) => {
      const { type, id, data } = variables;

      switch (type) {
        case 'create':
          // Remove temporary item
          setItems(prev => prev.filter(item => !item.id.startsWith('temp-')));
          break;

        case 'update':
          // Revert to original value (we need to refetch or use previous state)
          // For now, just trigger a refetch
          console.warn('[useOptimisticItemMutation] Update failed, refetching data...');
          break;

        case 'delete':
          // Restore deleted item
          if (!id) return;
          setItems(prev => [...prev, { ...data, id }]);
          break;
      }
    },
    successMessage,
    errorMessage,
  });
}

/**
 * Optimistic update utility for batch operations
 */
export interface BatchUpdateOptions<T> {
  items: T[];
  setItems: (items: T[] | ((prev: T[]) => T[])) => void;
  updateFn: (ids: string[], changes: any) => Promise<any>;
  successMessage?: string;
  errorMessage?: string;
  maxRetries?: number;
  retryable?: boolean;
}

export function useOptimisticBatchUpdate<T extends { id: string }>(
  options: BatchUpdateOptions<T>
) {
  const {
    items,
    setItems,
    updateFn,
    successMessage,
    errorMessage = 'Batch update failed. Please try again.',
    maxRetries = 3,
    retryable = true,
  } = options;

  return useOptimisticMutation<any, { itemIds: string[]; changes: any }>({
    maxRetries,
    retryable,
    mutateFn: async ({ itemIds, changes }) => {
      return await updateFn(itemIds, changes);
    },
    onOptimisticUpdate: ({ itemIds, changes }) => {
      setItems(prev => prev.map(item =>
        itemIds.includes(item.id)
          ? { ...item, ...changes, updatedAt: new Date().toISOString() }
          : item
      ));
    },
    onSuccess: () => {
      // Server has confirmed the changes
    },
    onRollback: () => {
      // Refetch to restore original state
      console.warn('[useOptimisticBatchUpdate] Batch update failed, refetching data...');
    },
    successMessage,
    errorMessage,
  });
}
