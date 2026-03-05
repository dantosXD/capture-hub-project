'use client';

import { WSEventType } from './ws-events';

export interface SyncState {
  lastSyncAt: string | null;
  isSyncing: boolean;
  syncError: string | null;
}

export interface SyncData {
  items?: any[];
  projects?: any[];
  links?: any[];
  timestamp: string;
  hasMore: boolean;
}

/**
 * Client-side sync state manager
 * Handles reconciliation of data from server after reconnection
 */
export class WSSyncManager {
  private lastSyncAt: string | null = null;
  private syncCallbacks: Set<(data: SyncData) => void> = new Set();
  private activeSendFunction: ((type: string, data?: any) => void) | null = null;

  /**
   * Get last sync timestamp
   */
  getLastSyncAt(): string | null {
    return this.lastSyncAt;
  }

  /**
   * Update last sync timestamp
   */
  updateLastSyncAt(timestamp: string): void {
    this.lastSyncAt = timestamp;
    // Persist to localStorage for resilience across page reloads
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ws_lastSyncAt', timestamp);
      } catch (error) {
        console.warn('[WSSyncManager] Failed to persist lastSyncAt:', error);
      }
    }
  }

  /**
   * Load last sync timestamp from localStorage
   */
  loadLastSyncAt(): string | null {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ws_lastSyncAt');
        if (stored) {
          this.lastSyncAt = stored;
          return stored;
        }
      } catch (error) {
        console.warn('[WSSyncManager] Failed to load lastSyncAt:', error);
      }
    }
    return null;
  }

  /**
   * Request sync from server
   */
  requestSync(sendFunction: (type: string, data?: any) => void): void {
    // Store send function so requestSyncFrom can use it for pagination
    this.activeSendFunction = sendFunction;

    const since = this.getLastSyncAt() || this.loadLastSyncAt();

    console.log(`[WSSyncManager] Requesting sync since: ${since || 'beginning'}`);

    sendFunction(WSEventType.SYNC_REQUEST, {
      since,
      lastSyncAt: since,
    });
  }

  /**
   * Handle sync response from server
   */
  handleSyncResponse(data: SyncData, onMerge?: (data: SyncData) => void): void {
    const { timestamp, hasMore } = data;

    console.log('[WSSyncManager] Received sync response:', {
      itemCount: data.items?.length || 0,
      projectCount: data.projects?.length || 0,
      linkCount: data.links?.length || 0,
      hasMore,
    });

    // Update last sync timestamp
    this.updateLastSyncAt(timestamp);

    // Notify callbacks
    this.syncCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error('[WSSyncManager] Error in sync callback:', error);
      }
    });

    // Call merge callback if provided
    if (onMerge) {
      onMerge(data);
    }

    // If there are more changes, request next batch
    if (hasMore) {
      console.log('[WSSyncManager] More data available, requesting next batch...');
      // Use timestamp from response for next batch
      this.requestSyncFrom(timestamp);
    }
  }

  /**
   * Request sync from a specific timestamp (used for pagination when hasMore === true)
   */
  private requestSyncFrom(timestamp: string): void {
    console.log(`[WSSyncManager] Requesting next page of sync from ${timestamp}`);

    if (!this.activeSendFunction) {
      console.warn('[WSSyncManager] requestSyncFrom called but no active send function available');
      return;
    }

    this.activeSendFunction(WSEventType.SYNC_REQUEST, {
      since: timestamp,
      lastSyncAt: timestamp,
    });
  }

  /**
   * Register callback for sync data
   */
  onSync(callback: (data: SyncData) => void): () => void {
    this.syncCallbacks.add(callback);
    return () => {
      this.syncCallbacks.delete(callback);
    };
  }

  /**
   * Clear last sync timestamp (for testing or forced full sync)
   */
  clearLastSync(): void {
    this.lastSyncAt = null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('ws_lastSyncAt');
      } catch (error) {
        console.warn('[WSSyncManager] Failed to clear lastSyncAt:', error);
      }
    }
  }

  /**
   * Reset state (for testing or logout)
   */
  reset(): void {
    this.clearLastSync();
    this.syncCallbacks.clear();
  }
}

// Global singleton instance
let syncManagerInstance: WSSyncManager | null = null;

export function getSyncManager(): WSSyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new WSSyncManager();
  }
  return syncManagerInstance;
}

/**
 * Merge items from sync response into local state
 * Handles updates, additions, and deletions with conflict resolution
 */
export function mergeSyncItems(
  localItems: any[],
  remoteItems: any[],
  timestamp: string
): any[] {
  if (!remoteItems || remoteItems.length === 0) {
    return localItems;
  }

  const mergedMap = new Map<string, any>();
  const conflictsResolved: string[] = [];

  // Add all local items first
  localItems.forEach((item) => {
    if (item.id) {
      mergedMap.set(item.id, item);
    }
  });

  // Merge remote items with conflict resolution
  remoteItems.forEach((remoteItem) => {
    if (remoteItem.id) {
      const localItem = mergedMap.get(remoteItem.id);

      if (!localItem) {
        // New item from server - add it
        mergedMap.set(remoteItem.id, remoteItem);
      } else {
        // Potential conflict - compare timestamps
        const localTime = new Date(localItem.updatedAt);
        const remoteTime = new Date(remoteItem.updatedAt);

        if (remoteTime >= localTime) {
          // Remote is newer or same - use remote
          mergedMap.set(remoteItem.id, remoteItem);
          if (remoteTime > localTime) {
            conflictsResolved.push(remoteItem.id);
          }
        }
        // If local is newer, keep local (last-write-wins)
      }
    }
  });

  if (conflictsResolved.length > 0) {
    console.log(`[WSSyncManager] Resolved ${conflictsResolved.length} conflicts using last-write-wins`);
  }

  return Array.from(mergedMap.values());
}

/**
 * Merge projects from sync response
 */
export function mergeSyncProjects(
  localProjects: any[],
  remoteProjects: any[]
): any[] {
  if (!remoteProjects || remoteProjects.length === 0) {
    return localProjects;
  }

  const mergedMap = new Map<string, any>();

  // Add all local projects
  localProjects.forEach((project) => {
    if (project.id) {
      mergedMap.set(project.id, project);
    }
  });

  // Merge remote projects
  remoteProjects.forEach((remoteProject) => {
    if (remoteProject.id) {
      mergedMap.set(remoteProject.id, remoteProject);
    }
  });

  return Array.from(mergedMap.values());
}

/**
 * Merge links from sync response
 */
export function mergeSyncLinks(
  localLinks: any[],
  remoteLinks: any[]
): any[] {
  if (!remoteLinks || remoteLinks.length === 0) {
    return localLinks;
  }

  const mergedMap = new Map<string, any>();
  const linkKey = (link: any) => `${link.sourceId}-${link.targetId}`;

  // Add all local links
  localLinks.forEach((link) => {
    mergedMap.set(linkKey(link), link);
  });

  // Merge remote links
  remoteLinks.forEach((remoteLink) => {
    mergedMap.set(linkKey(remoteLink), remoteLink);
  });

  return Array.from(mergedMap.values());
}
