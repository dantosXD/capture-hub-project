/**
 * Contract Validation Tests
 * Verifies all contracts compile, schemas validate correctly,
 * event bus dispatches typed events, and gateway context builds properly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // API contracts
  API_CONTRACTS,
  getContractsByDomain,
  getContractsByTag,
  isRegisteredRoute,

  // Event contracts
  EventType,
  EventTypeSchema,
  EventMetadataSchema,
  DomainEventSchema,
  EventPayloadMap,
  ItemCreatedPayloadSchema,
  ProjectCreatedPayloadSchema,
  LinkCreatedPayloadSchema,
  TemplateCreatedPayloadSchema,
  DeviceConnectedPayloadSchema,
  StatsUpdatedPayloadSchema,
  SyncRequestedPayloadSchema,
  AIProcessingStartedPayloadSchema,

  // Response contracts
  PaginationSchema,
  ErrorResponseSchema,
  CaptureItemResponseSchema,
  ProjectResponseSchema,
  TemplateResponseSchema,
  createSuccessSchema,

  // Event bus
  eventBus,
  createPublisher,
} from './index';

// ============================================================================
// API Contract Registry Tests
// ============================================================================

describe('API Contract Registry', () => {
  it('should have all expected route keys', () => {
    const keys = Object.keys(API_CONTRACTS);
    expect(keys.length).toBeGreaterThanOrEqual(30);

    // Spot-check critical routes
    expect(keys).toContain('capture.list');
    expect(keys).toContain('capture.create');
    expect(keys).toContain('capture.update');
    expect(keys).toContain('capture.delete');
    expect(keys).toContain('project.list');
    expect(keys).toContain('project.create');
    expect(keys).toContain('template.list');
    expect(keys).toContain('link.create');
    expect(keys).toContain('search.query');
    expect(keys).toContain('system.health');
    expect(keys).toContain('ai.summary');
    expect(keys).toContain('bookmarklet.capture');
  });

  it('every contract should have required fields', () => {
    for (const [key, contract] of Object.entries(API_CONTRACTS)) {
      expect(contract.method, `${key} missing method`).toBeDefined();
      expect(contract.path, `${key} missing path`).toBeDefined();
      expect(contract.description, `${key} missing description`).toBeDefined();
      expect(contract.domain, `${key} missing domain`).toBeDefined();
      expect(contract.rateLimit, `${key} missing rateLimit`).toBeDefined();
      expect(typeof contract.requiresAuth, `${key} missing requiresAuth`).toBe('boolean');
      expect(typeof contract.requiresCsrf, `${key} missing requiresCsrf`).toBe('boolean');
      expect(Array.isArray(contract.tags), `${key} tags not array`).toBe(true);
    }
  });

  it('write routes should require CSRF', () => {
    for (const [key, contract] of Object.entries(API_CONTRACTS)) {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(contract.method)) {
        // Bookmarklet is an exception (cross-origin by design)
        if (key === 'bookmarklet.capture') continue;
        expect(contract.requiresCsrf, `${key} should require CSRF`).toBe(true);
      }
    }
  });

  it('getContractsByDomain returns correct contracts', () => {
    const captureContracts = getContractsByDomain('capture');
    expect(captureContracts.length).toBeGreaterThanOrEqual(5);
    captureContracts.forEach(([, c]) => {
      expect(c.domain).toBe('capture');
    });
  });

  it('getContractsByTag returns correct contracts', () => {
    const aiContracts = getContractsByTag('ai');
    expect(aiContracts.length).toBeGreaterThanOrEqual(5);
  });

  it('isRegisteredRoute validates existing routes', () => {
    expect(isRegisteredRoute('/api/capture', 'GET')).toBe(true);
    expect(isRegisteredRoute('/api/capture', 'POST')).toBe(true);
    expect(isRegisteredRoute('/api/nonexistent', 'GET')).toBe(false);
  });
});

// ============================================================================
// Event Contract Tests
// ============================================================================

describe('Event Contracts', () => {
  it('EventType should have all expected types', () => {
    expect(EventType.ITEM_CREATED).toBe('item.created');
    expect(EventType.PROJECT_CREATED).toBe('project.created');
    expect(EventType.LINK_CREATED).toBe('link.created');
    expect(EventType.TEMPLATE_CREATED).toBe('template.created');
    expect(EventType.DEVICE_CONNECTED).toBe('device.connected');
    expect(EventType.AI_PROCESSING_STARTED).toBe('ai.processing_started');
  });

  it('EventTypeSchema should validate all registered types', () => {
    for (const type of Object.values(EventType)) {
      const result = EventTypeSchema.safeParse(type);
      expect(result.success, `${type} should be valid`).toBe(true);
    }
  });

  it('every EventType should have a payload schema in EventPayloadMap', () => {
    for (const type of Object.values(EventType)) {
      expect(EventPayloadMap[type], `Missing payload schema for ${type}`).toBeDefined();
    }
  });

  it('EventMetadataSchema validates correct metadata', () => {
    const valid = {
      eventId: 'test-123',
      timestamp: new Date().toISOString(),
      source: 'test',
    };
    expect(EventMetadataSchema.safeParse(valid).success).toBe(true);
  });

  it('EventMetadataSchema rejects invalid metadata', () => {
    expect(EventMetadataSchema.safeParse({}).success).toBe(false);
    expect(EventMetadataSchema.safeParse({ eventId: '' }).success).toBe(false);
  });

  it('ItemCreatedPayloadSchema validates a valid item payload', () => {
    const payload = {
      id: 'item-1',
      type: 'note',
      title: 'Test Note',
      status: 'inbox',
      tags: ['test'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(ItemCreatedPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('ProjectCreatedPayloadSchema validates a valid project payload', () => {
    const payload = {
      id: 'proj-1',
      name: 'Test Project',
      createdAt: new Date().toISOString(),
    };
    expect(ProjectCreatedPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('LinkCreatedPayloadSchema validates a valid link payload', () => {
    const payload = {
      id: 'link-1',
      sourceId: 'item-1',
      targetId: 'item-2',
      createdAt: new Date().toISOString(),
    };
    expect(LinkCreatedPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('AIProcessingStartedPayloadSchema validates correctly', () => {
    const payload = {
      taskId: 'task-1',
      taskType: 'summary',
      startedAt: new Date().toISOString(),
    };
    expect(AIProcessingStartedPayloadSchema.safeParse(payload).success).toBe(true);
  });
});

// ============================================================================
// Response Contract Tests
// ============================================================================

describe('Response Contracts', () => {
  it('PaginationSchema validates correct pagination', () => {
    const pagination = {
      page: 1,
      limit: 20,
      total: 100,
      totalPages: 5,
      hasNext: true,
      hasPrev: false,
    };
    expect(PaginationSchema.safeParse(pagination).success).toBe(true);
  });

  it('ErrorResponseSchema validates error responses', () => {
    const error = {
      success: false as const,
      error: {
        code: 'BAD_REQUEST',
        message: 'Validation failed',
        details: [{ path: 'title', message: 'Required' }],
      },
    };
    expect(ErrorResponseSchema.safeParse(error).success).toBe(true);
  });

  it('createSuccessSchema wraps data correctly', () => {
    const schema = createSuccessSchema(CaptureItemResponseSchema);
    const response = {
      success: true as const,
      data: {
        id: 'item-1',
        type: 'note',
        title: 'Test',
        content: null,
        extractedText: null,
        imageUrl: null,
        sourceUrl: null,
        metadata: null,
        tags: '[]',
        priority: 'none',
        status: 'inbox',
        assignedTo: null,
        dueDate: null,
        reminder: null,
        reminderSent: false,
        pinned: false,
        projectId: null,
        processedAt: null,
        processedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    expect(schema.safeParse(response).success).toBe(true);
  });

  it('CaptureItemResponseSchema validates item response', () => {
    const item = {
      id: 'item-1',
      type: 'note',
      title: 'Test',
      content: 'Content here',
      extractedText: null,
      imageUrl: null,
      sourceUrl: null,
      metadata: null,
      tags: ['tag1', 'tag2'],
      priority: 'high',
      status: 'inbox',
      assignedTo: null,
      dueDate: null,
      reminder: null,
      reminderSent: false,
      pinned: false,
      projectId: null,
      processedAt: null,
      processedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(CaptureItemResponseSchema.safeParse(item).success).toBe(true);
  });

  it('ProjectResponseSchema validates project response', () => {
    const project = {
      id: 'proj-1',
      name: 'Test',
      description: null,
      color: '#6366f1',
      icon: null,
      status: 'active',
      priority: 'medium',
      dueDate: null,
      metadata: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(ProjectResponseSchema.safeParse(project).success).toBe(true);
  });
});

// ============================================================================
// Event Bus Tests
// ============================================================================

describe('Event Bus', () => {
  beforeEach(() => {
    eventBus.reset();
  });

  it('should publish and receive typed events', async () => {
    const received: any[] = [];

    eventBus.on(EventType.ITEM_CREATED, (event) => {
      received.push(event);
    });

    await eventBus.publish(EventType.ITEM_CREATED, {
      id: 'item-1',
      type: 'note',
      title: 'Test',
      status: 'inbox',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('item.created');
    expect(received[0].payload.id).toBe('item-1');
    expect(received[0].metadata.eventId).toBeDefined();
    expect(received[0].metadata.timestamp).toBeDefined();
  });

  it('should reject invalid payloads', async () => {
    await expect(
      eventBus.publish(EventType.ITEM_CREATED, { invalid: true })
    ).rejects.toThrow('Event payload validation failed');
  });

  it('should support wildcard subscribers', async () => {
    const received: any[] = [];

    eventBus.onAll((event) => {
      received.push(event.type);
    });

    await eventBus.publish(EventType.ITEM_CREATED, {
      id: 'item-1',
      type: 'note',
      title: 'Test',
      status: 'inbox',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await eventBus.publish(EventType.PROJECT_CREATED, {
      id: 'proj-1',
      name: 'Test',
      createdAt: new Date().toISOString(),
    });

    expect(received).toHaveLength(2);
    expect(received).toContain('item.created');
    expect(received).toContain('project.created');
  });

  it('should unsubscribe by ID', async () => {
    let count = 0;
    const sub = eventBus.on(EventType.STATS_UPDATED, () => { count++; });

    await eventBus.publish(EventType.STATS_UPDATED, {
      scope: 'all',
      timestamp: new Date().toISOString(),
    });
    expect(count).toBe(1);

    eventBus.off(sub.id);

    await eventBus.publish(EventType.STATS_UPDATED, {
      scope: 'all',
      timestamp: new Date().toISOString(),
    });
    expect(count).toBe(1); // Not incremented
  });

  it('should track recent events', async () => {
    await eventBus.publish(EventType.STATS_UPDATED, {
      scope: 'all',
      timestamp: new Date().toISOString(),
    });

    const recent = eventBus.getRecentEvents(10);
    expect(recent).toHaveLength(1);
    expect(recent[0].type).toBe('stats.updated');
  });

  it('createPublisher should tag source correctly', async () => {
    const received: any[] = [];
    eventBus.onAll((event) => received.push(event));

    const publisher = createPublisher('test-service');
    await publisher.publish(EventType.STATS_UPDATED, {
      scope: 'all',
      timestamp: new Date().toISOString(),
    });

    expect(received[0].metadata.source).toBe('test-service');
  });

  it('isolated subscribers should not propagate errors', async () => {
    eventBus.on(EventType.STATS_UPDATED, () => {
      throw new Error('Subscriber error');
    }, { isolated: true });

    // Should not throw
    await eventBus.publish(EventType.STATS_UPDATED, {
      scope: 'all',
      timestamp: new Date().toISOString(),
    });
  });
});
