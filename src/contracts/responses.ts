/**
 * Standard API Response Contracts
 * Defines the canonical response envelope for all API endpoints.
 * Every API response MUST conform to these schemas.
 */

import { z } from 'zod';

// ============================================================================
// Standard Response Envelope
// ============================================================================

/**
 * Pagination metadata included in list responses
 */
export const PaginationSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

/**
 * Standard success response envelope
 * All successful API responses wrap data in this structure.
 */
export function createSuccessSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    pagination: PaginationSchema.optional(),
    meta: z.object({
      requestId: z.string().optional(),
      timestamp: z.string().datetime(),
      durationMs: z.number().int().min(0).optional(),
    }).optional(),
  });
}

/**
 * Standard error response envelope
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({
      path: z.string().optional(),
      message: z.string(),
    })).optional(),
  }),
  meta: z.object({
    requestId: z.string().optional(),
    timestamp: z.string().datetime(),
  }).optional(),
});

// ============================================================================
// Domain Response Schemas
// ============================================================================

/**
 * CaptureItem as returned by the API
 */
export const CaptureItemResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  content: z.string().nullable(),
  extractedText: z.string().nullable(),
  imageUrl: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  metadata: z.any().nullable(),
  tags: z.union([z.string(), z.array(z.string())]),
  priority: z.string(),
  status: z.string(),
  assignedTo: z.string().nullable(),
  dueDate: z.string().nullable(),
  reminder: z.string().nullable(),
  reminderSent: z.boolean(),
  pinned: z.boolean(),
  projectId: z.string().nullable(),
  processedAt: z.string().nullable(),
  processedBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  project: z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
  }).nullable().optional(),
});

/**
 * Project as returned by the API
 */
export const ProjectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  icon: z.string().nullable(),
  status: z.string(),
  priority: z.string(),
  dueDate: z.string().nullable(),
  metadata: z.any().nullable(),
  order: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  _count: z.object({
    items: z.number().int(),
  }).optional(),
});

/**
 * Template as returned by the API
 */
export const TemplateResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  content: z.string(),
  category: z.string(),
  icon: z.string().nullable(),
  variables: z.any().nullable(),
  isDefault: z.boolean(),
  projectId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * ItemLink as returned by the API
 */
export const ItemLinkResponseSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  relationType: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});

/**
 * ConnectedDevice as returned by the API
 */
export const DeviceResponseSchema = z.object({
  id: z.string(),
  socketId: z.string(),
  deviceName: z.string().nullable(),
  deviceType: z.string().nullable(),
  lastSeen: z.string(),
  connectedAt: z.string(),
});

/**
 * Stats response
 */
export const StatsResponseSchema = z.object({
  totalItems: z.number().int().min(0),
  byStatus: z.record(z.string(), z.number().int()),
  byType: z.record(z.string(), z.number().int()),
  byPriority: z.record(z.string(), z.number().int()),
  recentActivity: z.number().int().min(0).optional(),
  projectCount: z.number().int().min(0).optional(),
});

/**
 * Health check response
 */
export const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string().optional(),
  uptime: z.number().optional(),
  checks: z.record(z.string(), z.object({
    status: z.enum(['pass', 'fail', 'warn']),
    message: z.string().optional(),
    durationMs: z.number().optional(),
  })).optional(),
});

/**
 * Search response
 */
export const SearchResultSchema = z.object({
  items: z.array(CaptureItemResponseSchema),
  total: z.number().int().min(0),
  query: z.string().optional(),
  aiEnhanced: z.boolean().default(false),
});

/**
 * Export response
 */
export const ExportResponseSchema = z.object({
  format: z.enum(['json', 'csv', 'markdown']),
  data: z.any(),
  count: z.number().int().min(0),
  exportedAt: z.string().datetime(),
});

// ============================================================================
// Composed Success Responses
// ============================================================================

export const CaptureItemSuccessSchema = createSuccessSchema(CaptureItemResponseSchema);
export const CaptureItemListSuccessSchema = createSuccessSchema(z.array(CaptureItemResponseSchema));
export const ProjectSuccessSchema = createSuccessSchema(ProjectResponseSchema);
export const ProjectListSuccessSchema = createSuccessSchema(z.array(ProjectResponseSchema));
export const TemplateSuccessSchema = createSuccessSchema(TemplateResponseSchema);
export const TemplateListSuccessSchema = createSuccessSchema(z.array(TemplateResponseSchema));
export const StatsSuccessSchema = createSuccessSchema(StatsResponseSchema);
export const HealthSuccessSchema = createSuccessSchema(HealthResponseSchema);
export const SearchSuccessSchema = createSuccessSchema(SearchResultSchema);

// ============================================================================
// Type Exports
// ============================================================================

export type Pagination = z.infer<typeof PaginationSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type CaptureItemResponse = z.infer<typeof CaptureItemResponseSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type TemplateResponse = z.infer<typeof TemplateResponseSchema>;
export type ItemLinkResponse = z.infer<typeof ItemLinkResponseSchema>;
export type DeviceResponse = z.infer<typeof DeviceResponseSchema>;
export type StatsResponse = z.infer<typeof StatsResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type ExportResponse = z.infer<typeof ExportResponseSchema>;
