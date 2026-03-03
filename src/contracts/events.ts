/**
 * Domain Event Contracts
 * Zod-validated schemas for all domain events.
 * Single source of truth for event payloads across the system.
 *
 * Every event emitted or consumed MUST conform to these schemas.
 * This replaces loose TypeScript interfaces with runtime-validated contracts.
 */

import { z } from 'zod';

// ============================================================================
// Event Metadata (common envelope for all events)
// ============================================================================

export const EventMetadataSchema = z.object({
  /** Unique event ID (cuid) */
  eventId: z.string().min(1),
  /** ISO-8601 timestamp when the event was produced */
  timestamp: z.string().datetime(),
  /** Source service or component that emitted the event */
  source: z.string().min(1),
  /** Correlation ID for distributed tracing */
  correlationId: z.string().optional(),
  /** Causation ID (the event that caused this event) */
  causationId: z.string().optional(),
});

// ============================================================================
// Event Type Registry
// ============================================================================

export const EventType = {
  // Item lifecycle
  ITEM_CREATED: 'item.created',
  ITEM_UPDATED: 'item.updated',
  ITEM_DELETED: 'item.deleted',
  ITEM_BULK_UPDATED: 'item.bulk_updated',

  // Project lifecycle
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',

  // Link (knowledge graph) lifecycle
  LINK_CREATED: 'link.created',
  LINK_DELETED: 'link.deleted',

  // Template lifecycle
  TEMPLATE_CREATED: 'template.created',
  TEMPLATE_UPDATED: 'template.updated',
  TEMPLATE_DELETED: 'template.deleted',

  // Device events
  DEVICE_CONNECTED: 'device.connected',
  DEVICE_DISCONNECTED: 'device.disconnected',

  // Stats events
  STATS_UPDATED: 'stats.updated',

  // Sync events
  SYNC_REQUESTED: 'sync.requested',
  SYNC_COMPLETED: 'sync.completed',

  // AI events
  AI_PROCESSING_STARTED: 'ai.processing_started',
  AI_PROCESSING_COMPLETED: 'ai.processing_completed',
  AI_PROCESSING_FAILED: 'ai.processing_failed',
} as const;

export const EventTypeSchema = z.enum([
  EventType.ITEM_CREATED,
  EventType.ITEM_UPDATED,
  EventType.ITEM_DELETED,
  EventType.ITEM_BULK_UPDATED,
  EventType.PROJECT_CREATED,
  EventType.PROJECT_UPDATED,
  EventType.PROJECT_DELETED,
  EventType.LINK_CREATED,
  EventType.LINK_DELETED,
  EventType.TEMPLATE_CREATED,
  EventType.TEMPLATE_UPDATED,
  EventType.TEMPLATE_DELETED,
  EventType.DEVICE_CONNECTED,
  EventType.DEVICE_DISCONNECTED,
  EventType.STATS_UPDATED,
  EventType.SYNC_REQUESTED,
  EventType.SYNC_COMPLETED,
  EventType.AI_PROCESSING_STARTED,
  EventType.AI_PROCESSING_COMPLETED,
  EventType.AI_PROCESSING_FAILED,
]);

// ============================================================================
// Item Event Payloads
// ============================================================================

export const ItemCreatedPayloadSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['note', 'scratchpad', 'ocr', 'screenshot', 'webpage']),
  title: z.string(),
  content: z.string().nullable().optional(),
  extractedText: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  tags: z.array(z.string()).default([]),
  priority: z.enum(['none', 'low', 'medium', 'high']).default('none'),
  status: z.enum(['inbox', 'assigned', 'archived', 'trash']).default('inbox'),
  assignedTo: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  pinned: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ItemUpdatedPayloadSchema = z.object({
  id: z.string().min(1),
  changes: z.record(z.string(), z.any()),
  previousValues: z.record(z.string(), z.any()).optional(),
  updatedAt: z.string().datetime(),
});

export const ItemDeletedPayloadSchema = z.object({
  id: z.string().min(1),
  deletedAt: z.string().datetime(),
});

export const ItemBulkUpdatedPayloadSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
  changes: z.record(z.string(), z.any()),
  updatedAt: z.string().datetime(),
});

// ============================================================================
// Project Event Payloads
// ============================================================================

export const ProjectCreatedPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().nullable().optional(),
  color: z.string().default('#6366f1'),
  icon: z.string().nullable().optional(),
  status: z.enum(['active', 'on-hold', 'completed', 'archived']).default('active'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  createdAt: z.string().datetime(),
});

export const ProjectUpdatedPayloadSchema = z.object({
  id: z.string().min(1),
  changes: z.record(z.string(), z.any()),
  previousValues: z.record(z.string(), z.any()).optional(),
  updatedAt: z.string().datetime(),
});

export const ProjectDeletedPayloadSchema = z.object({
  id: z.string().min(1),
  deletedAt: z.string().datetime(),
});

// ============================================================================
// Link Event Payloads
// ============================================================================

export const LinkCreatedPayloadSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  relationType: z.enum(['related', 'depends-on', 'blocks', 'references']).default('related'),
  note: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const LinkDeletedPayloadSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  deletedAt: z.string().datetime(),
});

// ============================================================================
// Template Event Payloads
// ============================================================================

export const TemplateCreatedPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  category: z.string(),
  projectId: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const TemplateUpdatedPayloadSchema = z.object({
  id: z.string().min(1),
  changes: z.record(z.string(), z.any()),
  updatedAt: z.string().datetime(),
});

export const TemplateDeletedPayloadSchema = z.object({
  id: z.string().min(1),
  deletedAt: z.string().datetime(),
});

// ============================================================================
// Device Event Payloads
// ============================================================================

export const DeviceConnectedPayloadSchema = z.object({
  socketId: z.string().min(1),
  deviceName: z.string().nullable().optional(),
  deviceType: z.enum(['desktop', 'tablet', 'mobile']).optional(),
  connectedAt: z.string().datetime(),
});

export const DeviceDisconnectedPayloadSchema = z.object({
  socketId: z.string().min(1),
  disconnectedAt: z.string().datetime(),
});

// ============================================================================
// Stats Event Payloads
// ============================================================================

export const StatsUpdatedPayloadSchema = z.object({
  scope: z.enum(['capture', 'inbox', 'processing', 'all']),
  timestamp: z.string().datetime(),
});

// ============================================================================
// Sync Event Payloads
// ============================================================================

export const SyncRequestedPayloadSchema = z.object({
  since: z.string().datetime().optional(),
  lastSyncAt: z.string().datetime().optional(),
  clientId: z.string().optional(),
});

export const SyncCompletedPayloadSchema = z.object({
  itemCount: z.number().int().min(0),
  projectCount: z.number().int().min(0),
  linkCount: z.number().int().min(0),
  timestamp: z.string().datetime(),
  hasMore: z.boolean(),
});

// ============================================================================
// AI Event Payloads
// ============================================================================

export const AIProcessingStartedPayloadSchema = z.object({
  taskId: z.string().min(1),
  taskType: z.enum(['summary', 'suggestions', 'connections', 'insights', 'bulk-summary', 'ocr']),
  itemIds: z.array(z.string()).optional(),
  startedAt: z.string().datetime(),
});

export const AIProcessingCompletedPayloadSchema = z.object({
  taskId: z.string().min(1),
  taskType: z.enum(['summary', 'suggestions', 'connections', 'insights', 'bulk-summary', 'ocr']),
  result: z.any(),
  durationMs: z.number().int().min(0),
  completedAt: z.string().datetime(),
});

export const AIProcessingFailedPayloadSchema = z.object({
  taskId: z.string().min(1),
  taskType: z.enum(['summary', 'suggestions', 'connections', 'insights', 'bulk-summary', 'ocr']),
  error: z.string(),
  failedAt: z.string().datetime(),
});

// ============================================================================
// Event-to-Payload Mapping
// ============================================================================

export const EventPayloadMap = {
  [EventType.ITEM_CREATED]: ItemCreatedPayloadSchema,
  [EventType.ITEM_UPDATED]: ItemUpdatedPayloadSchema,
  [EventType.ITEM_DELETED]: ItemDeletedPayloadSchema,
  [EventType.ITEM_BULK_UPDATED]: ItemBulkUpdatedPayloadSchema,
  [EventType.PROJECT_CREATED]: ProjectCreatedPayloadSchema,
  [EventType.PROJECT_UPDATED]: ProjectUpdatedPayloadSchema,
  [EventType.PROJECT_DELETED]: ProjectDeletedPayloadSchema,
  [EventType.LINK_CREATED]: LinkCreatedPayloadSchema,
  [EventType.LINK_DELETED]: LinkDeletedPayloadSchema,
  [EventType.TEMPLATE_CREATED]: TemplateCreatedPayloadSchema,
  [EventType.TEMPLATE_UPDATED]: TemplateUpdatedPayloadSchema,
  [EventType.TEMPLATE_DELETED]: TemplateDeletedPayloadSchema,
  [EventType.DEVICE_CONNECTED]: DeviceConnectedPayloadSchema,
  [EventType.DEVICE_DISCONNECTED]: DeviceDisconnectedPayloadSchema,
  [EventType.STATS_UPDATED]: StatsUpdatedPayloadSchema,
  [EventType.SYNC_REQUESTED]: SyncRequestedPayloadSchema,
  [EventType.SYNC_COMPLETED]: SyncCompletedPayloadSchema,
  [EventType.AI_PROCESSING_STARTED]: AIProcessingStartedPayloadSchema,
  [EventType.AI_PROCESSING_COMPLETED]: AIProcessingCompletedPayloadSchema,
  [EventType.AI_PROCESSING_FAILED]: AIProcessingFailedPayloadSchema,
} as const;

// ============================================================================
// Domain Event Envelope (wraps every event)
// ============================================================================

export const DomainEventSchema = z.object({
  type: EventTypeSchema,
  payload: z.any(),
  metadata: EventMetadataSchema,
});

// ============================================================================
// Type Exports
// ============================================================================

export type EventTypeValue = (typeof EventType)[keyof typeof EventType];
export type EventMetadata = z.infer<typeof EventMetadataSchema>;
export type DomainEvent = z.infer<typeof DomainEventSchema>;

export type ItemCreatedPayload = z.infer<typeof ItemCreatedPayloadSchema>;
export type ItemUpdatedPayload = z.infer<typeof ItemUpdatedPayloadSchema>;
export type ItemDeletedPayload = z.infer<typeof ItemDeletedPayloadSchema>;
export type ItemBulkUpdatedPayload = z.infer<typeof ItemBulkUpdatedPayloadSchema>;

export type ProjectCreatedPayload = z.infer<typeof ProjectCreatedPayloadSchema>;
export type ProjectUpdatedPayload = z.infer<typeof ProjectUpdatedPayloadSchema>;
export type ProjectDeletedPayload = z.infer<typeof ProjectDeletedPayloadSchema>;

export type LinkCreatedPayload = z.infer<typeof LinkCreatedPayloadSchema>;
export type LinkDeletedPayload = z.infer<typeof LinkDeletedPayloadSchema>;

export type TemplateCreatedPayload = z.infer<typeof TemplateCreatedPayloadSchema>;
export type TemplateUpdatedPayload = z.infer<typeof TemplateUpdatedPayloadSchema>;
export type TemplateDeletedPayload = z.infer<typeof TemplateDeletedPayloadSchema>;

export type DeviceConnectedPayload = z.infer<typeof DeviceConnectedPayloadSchema>;
export type DeviceDisconnectedPayload = z.infer<typeof DeviceDisconnectedPayloadSchema>;

export type StatsUpdatedPayload = z.infer<typeof StatsUpdatedPayloadSchema>;
export type SyncRequestedPayload = z.infer<typeof SyncRequestedPayloadSchema>;
export type SyncCompletedPayload = z.infer<typeof SyncCompletedPayloadSchema>;

export type AIProcessingStartedPayload = z.infer<typeof AIProcessingStartedPayloadSchema>;
export type AIProcessingCompletedPayload = z.infer<typeof AIProcessingCompletedPayloadSchema>;
export type AIProcessingFailedPayload = z.infer<typeof AIProcessingFailedPayloadSchema>;
