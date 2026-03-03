/**
 * API Middleware for Conflict Resolution
 * Handles last-write-wins with timestamp comparison on update operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveItemConflict, resolveProjectConflict, resolveLinkConflict, conflictTracker } from '@/lib/conflict-resolution';
import { classifyError, apiError } from '@/lib/api-route-handler';

/**
 * Middleware to handle conflict resolution on item updates
 * Compares client-provided timestamp with server timestamp to detect conflicts
 *
 * Usage in PUT routes:
 * ```ts
 * const result = await withConflictResolution(request, params, async (item) => {
 *   // Apply updates to item
 *   return { ...item, ...updateData };
 * });
 * if (result.conflictDetected) {
 *   // Log or handle conflict
 * }
 * return NextResponse.json(result.data);
 * ```
 */
export async function withConflictResolution<T extends { id: string; updatedAt: string }>(
  request: NextRequest,
  params: { id: string },
  updateFn: (existingItem: any) => Promise<T> | T,
  entityType: 'item' | 'project' | 'link' = 'item'
): Promise<{
  data: T;
  conflictDetected: boolean;
  winner?: 'local' | 'remote';
}> {
  const { id } = params;

  try {
    // 1. Get the current server version
    const serverItem = await getEntityById(id, entityType);
    if (!serverItem) {
      throw new Error('Entity not found');
    }

    // 2. Get client-provided timestamp from headers
    const clientTimestamp = request.headers.get('x-client-timestamp');
    if (!clientTimestamp) {
      // No timestamp provided - proceed with update (legacy client)
      console.warn(`[ConflictResolution] No client timestamp provided for ${entityType} ${id}`);
      const updated = await updateFn(serverItem);
      return { data: updated, conflictDetected: false };
    }

    // 3. Compare timestamps
    const serverTimestamp = serverItem.updatedAt || serverItem.createdAt;

    if (clientTimestamp === serverTimestamp) {
      // No conflict - client has latest version
      const updated = await updateFn(serverItem);
      return { data: updated, conflictDetected: false };
    }

    // 4. Detect potential conflict
    const clientDate = new Date(clientTimestamp);
    const serverDate = new Date(serverTimestamp);

    // Client's version is older than server's version
    if (clientDate < serverDate) {
      console.warn(`[ConflictResolution] Stale update detected for ${entityType} ${id}:`, {
        clientTimestamp,
        serverTimestamp,
        diff: Math.abs(serverDate.getTime() - clientDate.getTime()) + 'ms',
      });

      // Fetch the actual current data to return
      const currentData = await getEntityById(id, entityType);

      // Resolve using last-write-wins (server wins in this case since it's newer)
      const resolution = resolveConflictByType(entityType, serverItem, currentData);

      // Track conflict
      conflictTracker.recordConflict(entityType, 'remote');

      return {
        data: resolution.data as T,
        conflictDetected: true,
        winner: resolution.winner,
      };
    }

    // Client's version is newer - proceed with update
    const updated = await updateFn(serverItem);
    return { data: updated, conflictDetected: false };

  } catch (error) {
    const classified = classifyError(error);
    throw apiError(classified.message, classified.status, {
      details: classified.details,
      logPrefix: `[ConflictResolution:${entityType}]`,
      error,
    });
  }
}

/**
 * Get entity by ID and type
 */
async function getEntityById(id: string, entityType: string): Promise<any> {
  switch (entityType) {
    case 'item':
      return await db.captureItem.findUnique({ where: { id } });
    case 'project':
      return await db.project.findUnique({ where: { id } });
    case 'link':
      return await db.itemLink.findUnique({ where: { id } });
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Resolve conflict using appropriate resolver
 */
function resolveConflictByType(entityType: string, serverItem: any, currentData: any) {
  switch (entityType) {
    case 'item':
      return resolveItemConflict(serverItem, currentData);
    case 'project':
      return resolveProjectConflict(serverItem, currentData);
    case 'link':
      return resolveLinkConflict(serverItem, currentData);
    default:
      // Default: server wins
      return {
        winner: 'remote' as const,
        data: currentData,
        conflictDetected: true,
      };
  }
}

/**
 * Middleware response wrapper that includes conflict information
 */
export function conflictResolutionResponse<T>(
  result: { data: T; conflictDetected: boolean; winner?: 'local' | 'remote' },
  additionalData: Record<string, any> = {}
): NextResponse {
  const responseBody = {
    ...result.data,
    ...additionalData,
    _conflict: result.conflictDetected ? {
      detected: true,
      winner: result.winner,
      resolved: true,
    } : undefined,
  };

  // Add warning header if conflict was detected
  const headers: Record<string, string> = {};
  if (result.conflictDetected) {
    headers['X-Conflict-Resolved'] = result.winner || 'remote';
    headers['X-Conflict-Resolved-At'] = new Date().toISOString();
  }

  return NextResponse.json(responseBody, { headers });
}

/**
 * Check for concurrent update conflicts using optimistic locking pattern
 * Returns true if the update should proceed
 */
export async function checkConcurrentUpdate(
  id: string,
  expectedTimestamp: string,
  entityType: 'item' | 'project' | 'link' = 'item'
): Promise<{ canProceed: boolean; currentData?: any; reason?: string }> {
  const currentData = await getEntityById(id, entityType);

  if (!currentData) {
    return { canProceed: false, reason: 'Entity not found' };
  }

  const currentTimestamp = currentData.updatedAt || currentData.createdAt;

  if (currentTimestamp !== expectedTimestamp) {
    return {
      canProceed: false,
      currentData,
      reason: `Concurrent modification detected. Expected ${expectedTimestamp}, found ${currentTimestamp}`,
    };
  }

  return { canProceed: true };
}

/**
 * Apply update with concurrent conflict check
 * Use this for critical operations that need strict consistency
 */
export async function updateWithConflictCheck<T>(
  id: string,
  expectedTimestamp: string,
  updateFn: () => Promise<T>,
  entityType: 'item' | 'project' | 'link' = 'item'
): Promise<{ success: boolean; data?: T; currentData?: any; conflict?: boolean }> {
  const check = await checkConcurrentUpdate(id, expectedTimestamp, entityType);

  if (!check.canProceed) {
    return {
      success: false,
      currentData: check.currentData,
      conflict: true,
    };
  }

  try {
    const data = await updateFn();
    return { success: true, data, conflict: false };
  } catch (error) {
    throw error;
  }
}

/**
 * Middleware for edge case handling: rapid consecutive updates
 * Debounces updates within a time window to prevent lost updates
 */
export class UpdateDebouncer {
  private pendingUpdates = new Map<string, Promise<any>>();
  private updateTimeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Debounce updates for a specific entity
   * If multiple updates are pending, only the latest one is applied
   */
  async debounce<T>(
    id: string,
    updateFn: () => Promise<T>,
    windowMs: number = 100
  ): Promise<T> {
    // Clear existing timeout for this entity
    const existingTimeout = this.updateTimeouts.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Create or get pending update promise
    let resolveUpdate: (value: T) => void;
    let rejectUpdate: (error: any) => void;

    const existingPromise = this.pendingUpdates.get(id);
    if (existingPromise) {
      // Wait for existing update to complete
      try {
        await existingPromise;
      } catch (error) {
        // Existing update failed, proceed with new one
      }
    }

    // Create new promise for this update
    const updatePromise = new Promise<T>((resolve, reject) => {
      resolveUpdate = resolve;
      rejectUpdate = reject;
    });

    this.pendingUpdates.set(id, updatePromise);

    // Set timeout to apply update
    const timeout = setTimeout(async () => {
      try {
        const result = await updateFn();
        resolveUpdate!(result);
      } catch (error) {
        rejectUpdate!(error);
      } finally {
        this.pendingUpdates.delete(id);
        this.updateTimeouts.delete(id);
      }
    }, windowMs);

    this.updateTimeouts.set(id, timeout);

    return updatePromise;
  }

  /**
   * Clear all pending updates (e.g., on shutdown)
   */
  clear() {
    for (const timeout of this.updateTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.updateTimeouts.clear();
    this.pendingUpdates.clear();
  }
}

// Global debouncer instance
export const updateDebouncer = new UpdateDebouncer();
