/**
 * Event Mesh Bridge (Project Omni P2)
 *
 * Bridges the domain event bus (P1) to the WebSocket broadcast layer.
 * When a domain event is published via eventBus.publish(), this bridge
 * automatically broadcasts it to all connected WebSocket clients.
 *
 * Architecture:
 *   API Route → eventBus.publish() → EventMesh → WebSocket broadcast
 *
 * This replaces the need to manually call broadcastXxx() functions in routes.
 * Routes only need to publish typed domain events; the mesh handles delivery.
 *
 * Future: Swap the in-process bridge for Kafka/Redis Streams consumer
 * without changing any route code.
 */

import { eventBus } from '@/contracts/event-bus';
import { EventType, type EventTypeValue, type DomainEvent } from '@/contracts/events';
import { broadcast } from './websocket';
import { WSEventType } from './ws-events';

// ============================================================================
// Event Type Mapping (Domain Events → WebSocket Events)
// ============================================================================

/**
 * Maps domain event types to legacy WebSocket event types.
 * This allows the new event bus to coexist with existing WS clients
 * that expect the old event format.
 */
const DOMAIN_TO_WS_MAP: Partial<Record<EventTypeValue, string>> = {
  [EventType.ITEM_CREATED]: WSEventType.ITEM_CREATED,
  [EventType.ITEM_UPDATED]: WSEventType.ITEM_UPDATED,
  [EventType.ITEM_DELETED]: WSEventType.ITEM_DELETED,
  [EventType.ITEM_BULK_UPDATED]: WSEventType.ITEM_BULK_UPDATE,
  [EventType.PROJECT_CREATED]: WSEventType.PROJECT_CREATED,
  [EventType.PROJECT_UPDATED]: WSEventType.PROJECT_UPDATED,
  [EventType.PROJECT_DELETED]: WSEventType.PROJECT_DELETED,
  [EventType.LINK_CREATED]: WSEventType.LINK_CREATED,
  [EventType.LINK_DELETED]: WSEventType.LINK_DELETED,
  [EventType.STATS_UPDATED]: WSEventType.STATS_UPDATED,
  [EventType.DEVICE_CONNECTED]: WSEventType.DEVICE_CONNECTED,
  [EventType.DEVICE_DISCONNECTED]: WSEventType.DEVICE_DISCONNECTED,
  [EventType.SYNC_COMPLETED]: WSEventType.SYNC_RESPONSE,
};

// ============================================================================
// Mesh State
// ============================================================================

let meshInitialized = false;
let meshSubscriptionId: string | null = null;
let eventCount = 0;
let errorCount = 0;

// ============================================================================
// Event Mesh Bridge
// ============================================================================

/**
 * Initialize the event mesh bridge.
 * Call this once during server startup (after WebSocket server is initialized).
 *
 * Subscribes to ALL domain events and forwards them to WebSocket clients.
 */
export function initializeEventMesh(): void {
  if (meshInitialized) {
    console.log('[EventMesh] Already initialized');
    return;
  }

  // Subscribe to all domain events with error isolation
  const subscription = eventBus.onAll(handleDomainEvent, { isolated: true });
  meshSubscriptionId = subscription.id;
  meshInitialized = true;

  console.log('[EventMesh] Bridge initialized — domain events will broadcast to WebSocket clients');
}

/**
 * Handle a domain event by forwarding it to WebSocket clients.
 */
async function handleDomainEvent(event: DomainEvent): Promise<void> {
  try {
    const wsEventType = DOMAIN_TO_WS_MAP[event.type as EventTypeValue];

    if (wsEventType) {
      // Forward to legacy WebSocket format for backward compatibility
      broadcast(wsEventType, event.payload);
      eventCount++;

      console.log(
        `[EventMesh] ${event.type} → ${wsEventType} (event #${eventCount}, corr: ${event.metadata.correlationId || 'none'})`
      );
    } else {
      // New event types without legacy mapping — broadcast with domain event type directly
      broadcast(event.type, {
        ...event.payload,
        _metadata: {
          eventId: event.metadata.eventId,
          correlationId: event.metadata.correlationId,
          timestamp: event.metadata.timestamp,
        },
      });
      eventCount++;

      console.log(
        `[EventMesh] ${event.type} → direct broadcast (event #${eventCount})`
      );
    }
  } catch (error) {
    errorCount++;
    console.error(`[EventMesh] Failed to bridge event ${event.type}:`, error);
  }
}

/**
 * Shut down the event mesh bridge.
 */
export function shutdownEventMesh(): void {
  if (!meshInitialized || !meshSubscriptionId) {
    return;
  }

  eventBus.off(meshSubscriptionId);
  meshSubscriptionId = null;
  meshInitialized = false;

  console.log(`[EventMesh] Bridge shut down (${eventCount} events bridged, ${errorCount} errors)`);
}

/**
 * Get event mesh status for health checks.
 */
export function getEventMeshStatus(): {
  initialized: boolean;
  eventCount: number;
  errorCount: number;
  subscriberCount: number;
} {
  return {
    initialized: meshInitialized,
    eventCount,
    errorCount,
    subscriberCount: eventBus.subscriberCount(),
  };
}
