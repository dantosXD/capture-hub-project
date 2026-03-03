/**
 * WebSocket Event Types
 * All supported event types for real-time broadcasting
 */

export enum WSEventType {
  // Item events
  ITEM_CREATED = 'item:created',
  ITEM_UPDATED = 'item:updated',
  ITEM_DELETED = 'item:deleted',
  ITEM_BULK_UPDATE = 'item:bulk-update',

  // Project events
  PROJECT_CREATED = 'project:created',
  PROJECT_UPDATED = 'project:updated',
  PROJECT_DELETED = 'project:deleted',

  // Link (knowledge graph) events
  LINK_CREATED = 'link:created',
  LINK_DELETED = 'link:deleted',

  // Stats events
  STATS_UPDATED = 'stats:updated',

  // Device events
  DEVICE_CONNECTED = 'device:connected',
  DEVICE_DISCONNECTED = 'device:disconnected',

  // Sync events
  SYNC_REQUEST = 'sync:request',
  SYNC_RESPONSE = 'sync:response',

  // Internal connection events (client-server only)
  CONNECTED = 'connected',
  PING = 'ping',
  PONG = 'pong',
}

/**
 * Sync event payloads
 */
export interface SyncRequestEvent {
  since?: string; // ISO timestamp - only get changes since this time
  lastSyncAt?: string; // ISO timestamp - when client last synced
}

export interface SyncResponseEvent {
  items?: Array<any>; // Capture items changed since timestamp
  projects?: Array<any>; // Projects changed since timestamp
  links?: Array<any>; // Links changed since timestamp
  stats?: any; // Current stats
  timestamp: string; // Server time when response was generated
  hasMore: boolean; // Whether there are more changes
}

/**
 * Base event payload structure
 */
export interface WSEvent {
  type: WSEventType;
  data: any;
  timestamp?: string;
}

/**
 * Item event payloads
 */
export interface ItemCreatedEvent {
  id: string;
  type: string;
  title: string;
  content?: string | null;
  extractedText?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  metadata?: any;
  tags?: string[];
  priority?: string;
  status: string;
  assignedTo?: string | null;
  projectId?: string | null;
  dueDate?: string | null;
  reminder?: string | null;
  reminderSent?: boolean;
  pinned?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ItemUpdatedEvent {
  id: string;
  changes: Record<string, any>;
  updatedAt: string;
}

export interface ItemDeletedEvent {
  id: string;
  deletedAt: string;
}

export interface ItemBulkUpdateEvent {
  itemIds: string[];
  changes: Record<string, any>;
  updatedAt: string;
}

/**
 * Project event payloads
 */
export interface ProjectCreatedEvent {
  id: string;
  name: string;
  color: string;
  status: string;
  createdAt: string;
}

export interface ProjectUpdatedEvent {
  id: string;
  changes: Record<string, any>;
  updatedAt: string;
}

export interface ProjectDeletedEvent {
  id: string;
  deletedAt: string;
}

/**
 * Link event payloads
 */
export interface LinkCreatedEvent {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  createdAt: string;
}

export interface LinkDeletedEvent {
  sourceId: string;
  targetId: string;
  deletedAt: string;
}

/**
 * Stats event payloads
 */
export interface StatsUpdatedEvent {
  type: 'capture' | 'inbox' | 'processing' | 'all';
  timestamp: string;
}

/**
 * Device event payloads
 */
export interface DeviceConnectedEvent {
  socketId: string;
  deviceName: string;
  deviceType?: string;
  connectedAt: string;
}

export interface DeviceDisconnectedEvent {
  socketId: string;
  disconnectedAt: string;
}
