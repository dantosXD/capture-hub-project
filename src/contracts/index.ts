/**
 * Contracts Module - Barrel Export
 * Single import point for all API contracts, event schemas, and gateway.
 */

// API contract registry
export { API_CONTRACTS, IdParamSchema, getContractsByDomain, getContractsByTag, isRegisteredRoute } from './api';
export type { RouteContract, ApiContractKey, ApiContract } from './api';

// Domain event contracts
export {
  EventType,
  EventTypeSchema,
  EventMetadataSchema,
  DomainEventSchema,
  EventPayloadMap,
  // Item payloads
  ItemCreatedPayloadSchema,
  ItemUpdatedPayloadSchema,
  ItemDeletedPayloadSchema,
  ItemBulkUpdatedPayloadSchema,
  // Project payloads
  ProjectCreatedPayloadSchema,
  ProjectUpdatedPayloadSchema,
  ProjectDeletedPayloadSchema,
  // Link payloads
  LinkCreatedPayloadSchema,
  LinkDeletedPayloadSchema,
  // Template payloads
  TemplateCreatedPayloadSchema,
  TemplateUpdatedPayloadSchema,
  TemplateDeletedPayloadSchema,
  // Device payloads
  DeviceConnectedPayloadSchema,
  DeviceDisconnectedPayloadSchema,
  // Stats/Sync payloads
  StatsUpdatedPayloadSchema,
  SyncRequestedPayloadSchema,
  SyncCompletedPayloadSchema,
  // AI payloads
  AIProcessingStartedPayloadSchema,
  AIProcessingCompletedPayloadSchema,
  AIProcessingFailedPayloadSchema,
} from './events';
export type {
  EventTypeValue,
  EventMetadata,
  DomainEvent,
  ItemCreatedPayload,
  ItemUpdatedPayload,
  ItemDeletedPayload,
  ItemBulkUpdatedPayload,
  ProjectCreatedPayload,
  ProjectUpdatedPayload,
  ProjectDeletedPayload,
  LinkCreatedPayload,
  LinkDeletedPayload,
  TemplateCreatedPayload,
  TemplateUpdatedPayload,
  TemplateDeletedPayload,
  DeviceConnectedPayload,
  DeviceDisconnectedPayload,
  StatsUpdatedPayload,
  SyncRequestedPayload,
  SyncCompletedPayload,
  AIProcessingStartedPayload,
  AIProcessingCompletedPayload,
  AIProcessingFailedPayload,
} from './events';

// Response contracts
export {
  PaginationSchema,
  ErrorResponseSchema,
  createSuccessSchema,
  CaptureItemResponseSchema,
  ProjectResponseSchema,
  TemplateResponseSchema,
  ItemLinkResponseSchema,
  DeviceResponseSchema,
  StatsResponseSchema,
  HealthResponseSchema,
  SearchResultSchema,
  ExportResponseSchema,
} from './responses';
export type {
  Pagination,
  ErrorResponse,
  CaptureItemResponse,
  ProjectResponse,
  TemplateResponse,
  ItemLinkResponse,
  DeviceResponse,
  StatsResponse,
  HealthResponse,
  SearchResult,
  ExportResponse,
} from './responses';

// Event bus
export { eventBus, createPublisher } from './event-bus';
export type { EventHandler, Subscription } from './event-bus';

// Edge gateway
export { gateway, gatewayOptions } from './gateway';
export type { GatewayContext } from './gateway';
