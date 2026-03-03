/**
 * WebSocket Broadcast Helpers
 * Typed convenience functions for broadcasting events
 */

import { broadcast } from './websocket';
import {
  WSEventType,
  type ItemCreatedEvent,
  type ItemUpdatedEvent,
  type ItemDeletedEvent,
  type ItemBulkUpdateEvent,
  type ProjectCreatedEvent,
  type ProjectUpdatedEvent,
  type ProjectDeletedEvent,
  type LinkCreatedEvent,
  type LinkDeletedEvent,
  type StatsUpdatedEvent,
  type DeviceConnectedEvent,
  type DeviceDisconnectedEvent,
} from './ws-events';
import type { WebSocket } from 'ws';

/**
 * Item Event Broadcasters
 */
export function broadcastItemCreated(data: ItemCreatedEvent, excludeSocket?: WebSocket): void {
  broadcast(WSEventType.ITEM_CREATED, data, excludeSocket);
}

export function broadcastItemUpdated(data: ItemUpdatedEvent, excludeSocket?: WebSocket): void {
  broadcast(WSEventType.ITEM_UPDATED, data, excludeSocket);
}

export function broadcastItemDeleted(data: ItemDeletedEvent, excludeSocket?: WebSocket): void {
  broadcast(WSEventType.ITEM_DELETED, data, excludeSocket);
}

export function broadcastItemBulkUpdate(data: ItemBulkUpdateEvent, excludeSocket?: WebSocket): void {
  broadcast(WSEventType.ITEM_BULK_UPDATE, data, excludeSocket);
}

/**
 * Project Event Broadcasters
 */
export function broadcastProjectCreated(data: ProjectCreatedEvent, excludeSocket?: WebSocket): void {
  broadcast(WSEventType.PROJECT_CREATED, data, excludeSocket);
}

export function broadcastProjectUpdated(data: ProjectUpdatedEvent, excludeSocket?: WebSocket): void {
  broadcast(WSEventType.PROJECT_UPDATED, data, excludeSocket);
}

export function broadcastProjectDeleted(data: ProjectDeletedEvent, excludeSocket?: WebSocket): void {
  broadcast(WSEventType.PROJECT_DELETED, data, excludeSocket);
}

/**
 * Link Event Broadcasters
 */
export function broadcastLinkCreated(data: LinkCreatedEvent, excludeSocket?: WebSocket): void {
  broadcast(WSEventType.LINK_CREATED, data, excludeSocket);
}

export function broadcastLinkDeleted(data: LinkDeletedEvent, excludeSocket?: WebSocket): void {
  broadcast(WSEventType.LINK_DELETED, data, excludeSocket);
}

/**
 * Stats Event Broadcasters
 */
export function broadcastStatsUpdated(data: StatsUpdatedEvent, excludeSocket?: WebSocket): void {
  broadcast(WSEventType.STATS_UPDATED, data, excludeSocket);
}

/**
 * Device Event Broadcasters
 */
export function broadcastDeviceConnected(data: DeviceConnectedEvent, excludeSocket?: WebSocket): void {
  broadcast(WSEventType.DEVICE_CONNECTED, data, excludeSocket);
}

export function broadcastDeviceDisconnected(data: DeviceDisconnectedEvent, excludeSocket?: WebSocket): void {
  broadcast(WSEventType.DEVICE_DISCONNECTED, data, excludeSocket);
}

/**
 * Generic event broadcaster (for custom events)
 */
export function broadcastEvent(type: WSEventType, data: any, excludeSocket?: WebSocket): void {
  broadcast(type, data, excludeSocket);
}
