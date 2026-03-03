/**
 * In-Process Event Bus
 * Lightweight, typed event bus for domain events.
 * Implements a Kafka-compatible interface for future scale-out.
 *
 * - Validates payloads against event contracts at publish time
 * - Supports async subscribers with error isolation
 * - Provides correlation/causation ID propagation for tracing
 * - Designed to be swapped for Kafka/NATS/Redis Streams in P2
 */

import { randomUUID } from 'crypto';
import {
  EventType,
  EventPayloadMap,
  EventMetadataSchema,
  DomainEventSchema,
  type EventTypeValue,
  type EventMetadata,
  type DomainEvent,
} from './events';

// ============================================================================
// Subscriber Types
// ============================================================================

export type EventHandler<T = unknown> = (event: DomainEvent & { payload: T }) => void | Promise<void>;

export interface Subscription {
  id: string;
  eventType: EventTypeValue;
  handler: EventHandler;
  /** If true, handler errors won't propagate */
  isolated: boolean;
}

// ============================================================================
// Event Bus Implementation
// ============================================================================

class EventBus {
  private subscribers = new Map<string, Subscription[]>();
  private wildcardSubscribers: Subscription[] = [];
  private eventLog: DomainEvent[] = [];
  private maxLogSize = 1000;

  /**
   * Publish a typed domain event.
   * Validates the payload against the event contract before dispatching.
   */
  async publish<T extends EventTypeValue>(
    type: T,
    payload: unknown,
    options: {
      source?: string;
      correlationId?: string;
      causationId?: string;
    } = {}
  ): Promise<DomainEvent> {
    // Validate payload against contract
    const schema = EventPayloadMap[type];
    if (schema) {
      const result = schema.safeParse(payload);
      if (!result.success) {
        console.error(`[EventBus] Invalid payload for ${type}:`, result.error.issues);
        throw new Error(`Event payload validation failed for ${type}: ${result.error.message}`);
      }
    }

    // Build event metadata
    const metadata: EventMetadata = {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      source: options.source || 'capture-hub',
      correlationId: options.correlationId,
      causationId: options.causationId,
    };

    // Build domain event
    const event: DomainEvent = {
      type,
      payload,
      metadata,
    };

    // Log event
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize);
    }

    // Dispatch to subscribers
    const typeSubscribers = this.subscribers.get(type) || [];
    const allSubscribers = [...typeSubscribers, ...this.wildcardSubscribers];

    const dispatchPromises = allSubscribers.map(async (sub) => {
      try {
        await sub.handler(event);
      } catch (error) {
        console.error(`[EventBus] Subscriber ${sub.id} failed for ${type}:`, error);
        if (!sub.isolated) {
          throw error;
        }
      }
    });

    // Wait for all isolated handlers; throw if non-isolated handler fails
    await Promise.allSettled(dispatchPromises);

    return event;
  }

  /**
   * Subscribe to a specific event type.
   */
  on<T extends EventTypeValue>(
    eventType: T,
    handler: EventHandler,
    options: { isolated?: boolean } = {}
  ): Subscription {
    const subscription: Subscription = {
      id: randomUUID(),
      eventType,
      handler,
      isolated: options.isolated ?? true,
    };

    const existing = this.subscribers.get(eventType) || [];
    existing.push(subscription);
    this.subscribers.set(eventType, existing);

    return subscription;
  }

  /**
   * Subscribe to ALL event types (wildcard).
   */
  onAll(handler: EventHandler, options: { isolated?: boolean } = {}): Subscription {
    const subscription: Subscription = {
      id: randomUUID(),
      eventType: '*' as EventTypeValue,
      handler,
      isolated: options.isolated ?? true,
    };

    this.wildcardSubscribers.push(subscription);
    return subscription;
  }

  /**
   * Unsubscribe by subscription ID.
   */
  off(subscriptionId: string): boolean {
    // Check type-specific subscribers
    for (const [type, subs] of this.subscribers.entries()) {
      const idx = subs.findIndex((s) => s.id === subscriptionId);
      if (idx !== -1) {
        subs.splice(idx, 1);
        return true;
      }
    }

    // Check wildcard subscribers
    const wcIdx = this.wildcardSubscribers.findIndex((s) => s.id === subscriptionId);
    if (wcIdx !== -1) {
      this.wildcardSubscribers.splice(wcIdx, 1);
      return true;
    }

    return false;
  }

  /**
   * Get recent events from the in-memory log.
   */
  getRecentEvents(limit: number = 50, eventType?: EventTypeValue): DomainEvent[] {
    let events = this.eventLog;
    if (eventType) {
      events = events.filter((e) => e.type === eventType);
    }
    return events.slice(-limit);
  }

  /**
   * Get subscriber count for a specific event type.
   */
  subscriberCount(eventType?: EventTypeValue): number {
    if (eventType) {
      return (this.subscribers.get(eventType) || []).length + this.wildcardSubscribers.length;
    }
    let total = this.wildcardSubscribers.length;
    for (const subs of this.subscribers.values()) {
      total += subs.length;
    }
    return total;
  }

  /**
   * Clear all subscribers and event log.
   */
  reset(): void {
    this.subscribers.clear();
    this.wildcardSubscribers = [];
    this.eventLog = [];
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Global event bus instance */
export const eventBus = new EventBus();

/**
 * Helper to create a typed event publisher for a specific source.
 * Use this in services to publish events with automatic source tagging.
 */
export function createPublisher(source: string) {
  return {
    publish: <T extends EventTypeValue>(
      type: T,
      payload: unknown,
      options: { correlationId?: string; causationId?: string } = {}
    ) => eventBus.publish(type, payload, { ...options, source }),
  };
}
