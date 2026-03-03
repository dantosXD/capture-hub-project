/**
 * Offline Operation Queue
 *
 * Queues failed API operations when offline and retries them when connection is restored.
 * Operations are persisted to localStorage so they survive page refreshes.
 *
 * Supported operations:
 * - POST /api/capture (create capture item)
 * - PUT /api/capture/[id] (update capture item)
 * - DELETE /api/capture/[id] (delete capture item)
 * - POST /api/projects (create project)
 * - PATCH /api/projects/[id] (update project)
 * - DELETE /api/projects/[id] (delete project)
 */

export interface QueuedOperation {
  id: string;
  method: string;
  url: string;
  body?: any;
  timestamp: string;
  retries: number;
  maxRetries: number;
}

const STORAGE_KEY = 'capture-hub-offline-queue';
const MAX_QUEUE_SIZE = 100; // Prevent unbounded growth
const MAX_RETRIES = 3; // Max retry attempts per operation

/**
 * Get all queued operations from localStorage
 */
export function getQueuedOperations(): QueuedOperation[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[OfflineQueue] Failed to read from localStorage:', error);
  }

  return [];
}

/**
 * Save queued operations to localStorage
 */
function saveQueuedOperations(operations: QueuedOperation[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(operations));
  } catch (error) {
    console.error('[OfflineQueue] Failed to save to localStorage:', error);
  }
}

/**
 * Add an operation to the queue
 */
export function queueOperation(
  method: string,
  url: string,
  body?: any
): QueuedOperation {
  const operations = getQueuedOperations();

  // Limit queue size
  if (operations.length >= MAX_QUEUE_SIZE) {
    console.warn('[OfflineQueue] Queue is full, removing oldest operation');
    operations.shift();
  }

  const operation: QueuedOperation = {
    id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    method,
    url,
    body,
    timestamp: new Date().toISOString(),
    retries: 0,
    maxRetries: MAX_RETRIES,
  };

  operations.push(operation);
  saveQueuedOperations(operations);

  console.log(`[OfflineQueue] Queued operation: ${method} ${url} (total: ${operations.length})`);
  return operation;
}

/**
 * Remove an operation from the queue
 */
export function removeOperation(operationId: string): void {
  const operations = getQueuedOperations();
  const filtered = operations.filter((op) => op.id !== operationId);
  saveQueuedOperations(filtered);
}

/**
 * Clear all queued operations
 */
export function clearQueue(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[OfflineQueue] Queue cleared');
  } catch (error) {
    console.error('[OfflineQueue] Failed to clear queue:', error);
  }
}

/**
 * Get queue size
 */
export function getQueueSize(): number {
  return getQueuedOperations().length;
}

/**
 * Retry a single operation
 */
async function retryOperation(operation: QueuedOperation): Promise<boolean> {
  const { method, url, body } = operation;

  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (response.ok) {
      console.log(`[OfflineQueue] Successfully retried: ${method} ${url}`);
      return true;
    } else {
      console.warn(`[OfflineQueue] Retry failed: ${method} ${url} - ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`[OfflineQueue] Retry error: ${method} ${url}`, error);
    return false;
  }
}

/**
 * Process all queued operations
 * Returns number of successfully processed operations
 */
export async function processQueue(): Promise<number> {
  const operations = getQueuedOperations();

  if (operations.length === 0) {
    console.log('[OfflineQueue] No operations to retry');
    return 0;
  }

  console.log(`[OfflineQueue] Processing ${operations.length} queued operations...`);

  let successCount = 0;
  const failedOps: QueuedOperation[] = [];

  for (const operation of operations) {
    // Skip if max retries reached
    if (operation.retries >= operation.maxRetries) {
      console.warn(`[OfflineQueue] Skipping operation (max retries): ${operation.url}`);
      failedOps.push(operation);
      continue;
    }

    // Increment retry count
    operation.retries++;

    // Retry the operation
    const success = await retryOperation(operation);

    if (success) {
      successCount++;
      // Remove successful operation from queue
      removeOperation(operation.id);
    } else {
      // Keep in queue for next time (if not max retries)
      if (operation.retries < operation.maxRetries) {
        failedOps.push(operation);
      } else {
        // Max retries reached - remove and log
        removeOperation(operation.id);
      }
    }
  }

  // Save updated operations with retry counts
  if (failedOps.length > 0) {
    const currentOps = getQueuedOperations();
    const updatedOps = currentOps.map((op) => {
      const failedOp = failedOps.find((f) => f.id === op.id);
      return failedOp || op;
    });
    saveQueuedOperations(updatedOps);
  }

  console.log(`[OfflineQueue] Processed ${operations.length} operations: ${successCount} succeeded`);

  return successCount;
}

/**
 * Enhanced fetch wrapper that automatically queues failed requests when offline
 */
export async function fetchWithOfflineQueue(
  url: string,
  options?: RequestInit
): Promise<Response> {
  try {
    const response = await fetch(url, options);

    // If offline detected, queue the operation
    if (!response.ok && response.status === 0) {
      throw new Error('Network offline');
    }

    return response;
  } catch (error: any) {
    // Check if error is due to being offline
    const isOffline = !navigator.onLine;

    if (isOffline && options?.method && options.method !== 'GET') {
      // Queue the operation for later retry
      let body: any;
      if (options.body) {
        try {
          body = JSON.parse(options.body as string);
        } catch {
          body = options.body;
        }
      }

      queueOperation(options.method, url, body);

      // Return a mock response that indicates offline
      throw new Error('OFFLINE: Operation queued for retry');
    }

    throw error;
  }
}
