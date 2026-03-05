/**
 * Conflict Resolution - Last-Write-Wins with Timestamp Comparison
 * Handles concurrent edits from multiple devices
 */

import type { CaptureItem, Project, ItemLink } from '@prisma/client';
import { loggers } from './logger';

export interface ConflictResolutionOptions {
  localTimestamp: string | Date;
  remoteTimestamp: string | Date;
  localData: any;
  remoteData: any;
  entityType: 'item' | 'project' | 'link';
}

export interface ConflictResolutionResult<T> {
  winner: 'local' | 'remote';
  data: T;
  conflictDetected: boolean;
  timestamp: string | Date;
}

/**
 * Compare two ISO timestamps and determine which is more recent
 */
export function compareTimestamps(local: string | Date, remote: string | Date): number {
  const localDate = new Date(local);
  const remoteDate = new Date(remote);

  if (localDate < remoteDate) return -1; // Remote is newer
  if (localDate > remoteDate) return 1;  // Local is newer
  return 0; // Same time
}

/**
 * Resolve conflict using last-write-wins strategy
 * The version with the latest updatedAt timestamp wins
 */
export function resolveConflict<T extends { updatedAt: string | Date }>(
  options: ConflictResolutionOptions
): ConflictResolutionResult<T> {
  const { localTimestamp, remoteTimestamp, localData, remoteData } = options;

  const comparison = compareTimestamps(localTimestamp, remoteTimestamp);

  // Timestamps are the same - no conflict or simultaneous write
  if (comparison === 0) {
    return {
      winner: 'remote', // Prefer remote on exact tie
      data: remoteData as T,
      conflictDetected: false,
      timestamp: remoteTimestamp,
    };
  }

  // Remote is newer - use remote data
  if (comparison < 0) {
    loggers.server.debug('Conflict resolved', { strategy: 'last-write-wins', winner: 'remote' });

    return {
      winner: 'remote',
      data: remoteData as T,
      conflictDetected: true,
      timestamp: remoteTimestamp,
    };
  }

  // Local is newer - keep local data
  loggers.server.debug('Conflict resolved', { strategy: 'last-write-wins', winner: 'local' });

  return {
    winner: 'local',
    data: localData as T,
    conflictDetected: true,
    timestamp: localTimestamp,
  };
}

/**
 * Resolve conflict for CaptureItem
 * Compares updatedAt timestamps and returns the winning version
 */
export function resolveItemConflict(
  localItem: CaptureItem,
  remoteItem: CaptureItem
): ConflictResolutionResult<CaptureItem> {
  const result = resolveConflict<CaptureItem>({
    localTimestamp: localItem.updatedAt,
    remoteTimestamp: remoteItem.updatedAt,
    localData: localItem,
    remoteData: remoteItem,
    entityType: 'item',
  });

  if (result.conflictDetected) {
    logConflict('item', localItem.id, localItem.updatedAt, remoteItem.updatedAt, result.winner);
  }

  return result;
}

/**
 * Resolve conflict for Project
 */
export function resolveProjectConflict(
  localProject: Project,
  remoteProject: Project
): ConflictResolutionResult<Project> {
  const result = resolveConflict<Project>({
    localTimestamp: localProject.updatedAt,
    remoteTimestamp: remoteProject.updatedAt,
    localData: localProject,
    remoteData: remoteProject,
    entityType: 'project',
  });

  if (result.conflictDetected) {
    logConflict('project', localProject.id, localProject.updatedAt, remoteProject.updatedAt, result.winner);
  }

  return result;
}

/**
 * Resolve conflict for ItemLink
 */
export function resolveLinkConflict(
  localLink: ItemLink,
  remoteLink: ItemLink
): ConflictResolutionResult<ItemLink> {
  // For links, we compare createdAt since they don't have updatedAt
  // Cast to satisfy the generic constraint since links use createdAt instead
  const result = resolveConflict<ItemLink & { updatedAt: string }>({
    localTimestamp: localLink.createdAt,
    remoteTimestamp: remoteLink.createdAt,
    localData: localLink as ItemLink & { updatedAt: string },
    remoteData: remoteLink as ItemLink & { updatedAt: string },
    entityType: 'link',
  }) as ConflictResolutionResult<ItemLink>;

  if (result.conflictDetected) {
    logConflict('link', localLink.id, localLink.createdAt, remoteLink.createdAt, result.winner);
  }

  return result;
}

/**
 * Log conflict for debugging
 */
function logConflict(
  entityType: string,
  entityId: string,
  localTimestamp: string | Date,
  remoteTimestamp: string | Date,
  winner: 'local' | 'remote'
) {
  loggers.server.debug('Conflict detected', { entityId, strategy: 'last-write-wins' });

  // Send to analytics/logging service if needed
  if (typeof window !== 'undefined') {
    const conflictLog = {
      type: 'conflict',
      entityType,
      entityId,
      localTimestamp,
      remoteTimestamp,
      winner,
      timestamp: new Date().toISOString(),
    };

    // Could send to a logging endpoint
    // fetch('/api/log', { method: 'POST', body: JSON.stringify(conflictLog) });

    // Store in sessionStorage for debugging
    try {
      const logs = JSON.parse(sessionStorage.getItem('conflict_logs') || '[]');
      logs.push(conflictLog);
      // Keep only last 100 conflicts
      if (logs.length > 100) {
        logs.shift();
      }
      sessionStorage.setItem('conflict_logs', JSON.stringify(logs));
    } catch (error) {
      loggers.server.warn('[ConflictResolution] Failed to store conflict log', { error: String(error) });
    }
  }
}

/**
 * Merge conflicting data with custom merge strategy
 * Allows selective field merging instead of full replacement
 */
export interface MergeStrategy<T> {
  compare: (local: T, remote: T) => boolean;
  merge: (local: T, remote: T, winner: 'local' | 'remote') => T;
}

/**
 * Merge two items with a custom strategy
 */
export function mergeWithStrategy<T>(
  local: T,
  remote: T,
  strategy: MergeStrategy<T>
): T {
  const isConflict = !strategy.compare(local, remote);

  if (!isConflict) {
    // No conflict, versions match
    return local;
  }

  // Determine winner by timestamp if available
  const localTimestamp = (local as any).updatedAt || (local as any).createdAt;
  const remoteTimestamp = (remote as any).updatedAt || (remote as any).createdAt;

  const winner = compareTimestamps(localTimestamp, remoteTimestamp) > 0 ? 'local' : 'remote';

  return strategy.merge(local, remote, winner);
}

/**
 * Smart merge for items with arrays (like tags)
 * Combines arrays instead of replacing them
 */
export function mergeItemArrays(
  localItem: any,
  remoteItem: any,
  arrayFields: string[] = ['tags']
): any {
  const merged = { ...remoteItem };

  for (const field of arrayFields) {
    if (localItem[field] && remoteItem[field]) {
      const localArray = Array.isArray(localItem[field])
        ? localItem[field]
        : JSON.parse(localItem[field] || '[]');
      const remoteArray = Array.isArray(remoteItem[field])
        ? remoteItem[field]
        : JSON.parse(remoteItem[field] || '[]');

      // Combine arrays and remove duplicates
      const combined = Array.from(new Set([...localArray, ...remoteArray]));
      merged[field] = combined;
    }
  }

  return merged;
}

/**
 * Conflict resolution stats for monitoring
 */
export interface ConflictStats {
  totalConflicts: number;
  localWins: number;
  remoteWins: number;
  byEntityType: {
    items: number;
    projects: number;
    links: number;
  };
}

export class ConflictTracker {
  private stats: ConflictStats = {
    totalConflicts: 0,
    localWins: 0,
    remoteWins: 0,
    byEntityType: {
      items: 0,
      projects: 0,
      links: 0,
    },
  };

  recordConflict(
    entityType: 'item' | 'project' | 'link',
    winner: 'local' | 'remote'
  ) {
    this.stats.totalConflicts++;

    if (winner === 'local') {
      this.stats.localWins++;
    } else {
      this.stats.remoteWins++;
    }

    switch (entityType) {
      case 'item':
        this.stats.byEntityType.items++;
        break;
      case 'project':
        this.stats.byEntityType.projects++;
        break;
      case 'link':
        this.stats.byEntityType.links++;
        break;
    }
  }

  getStats(): ConflictStats {
    return { ...this.stats };
  }

  reset() {
    this.stats = {
      totalConflicts: 0,
      localWins: 0,
      remoteWins: 0,
      byEntityType: {
        items: 0,
        projects: 0,
        links: 0,
      },
    };
  }
}

// Global conflict tracker instance
export const conflictTracker = new ConflictTracker();
