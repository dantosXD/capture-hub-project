/**
 * Zod validation schemas for API inputs
 * Provides runtime type checking and validation for all API endpoints
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Valid capture item types
 */
export const CaptureItemTypeSchema = z.enum([
  'note',
  'scratchpad',
  'ocr',
  'screenshot',
  'webpage',
]);

/**
 * Valid status values for capture items
 */
export const ItemStatusSchema = z.enum([
  'inbox',
  'assigned',
  'archived',
  'trash',
]);

/**
 * Valid priority levels
 */
export const PrioritySchema = z.enum([
  'none',
  'low',
  'medium',
  'high',
]);

/**
 * Valid project status values
 */
export const ProjectStatusSchema = z.enum([
  'active',
  'on-hold',
  'completed',
  'archived',
]);

/**
 * Valid project priority levels
 */
export const ProjectPrioritySchema = z.enum([
  'low',
  'medium',
  'high',
]);

/**
 * Valid template categories
 */
export const TemplateCategorySchema = z.enum([
  'general',
  'meeting',
  'task',
  'note',
  'review',
  'project',
]);

/**
 * Valid knowledge graph link relation types
 */
export const LinkRelationTypeSchema = z.enum([
  'related',
  'depends-on',
  'blocks',
  'references',
]);

/**
 * Valid device types
 */
export const DeviceTypeSchema = z.enum([
  'desktop',
  'tablet',
  'mobile',
]);

/**
 * Sanitized string - trims whitespace and enforces length limits
 */
export const SanitizedStringSchema = z.string().trim().max(10000);

/**
 * Short string (for titles, names)
 */
export const ShortStringSchema = z.string().trim().min(1).max(500);

/**
 * Medium string (for descriptions)
 */
export const MediumStringSchema = z.string().trim().max(5000);

/**
 * URL validation (allows http, https, and relative URLs)
 */
export const UrlSchema = z.string().url().max(2048).nullable().optional();

/**
 * ISO date string validation
 */
export const IsoDateSchema = z.string().datetime().nullable().optional();

/**
 * ID validation (cuid format)
 */
export const IdSchema = z.string().min(1).max(100);

/**
 * Tags array validation (each tag is trimmed and limited in length)
 */
export const TagsArraySchema = z.array(
  z.string().trim().min(1).max(100)
).max(50).optional(); // Max 50 tags

/**
 * Color hex code validation
 */
export const ColorHexSchema = z.string()
  .regex(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Invalid hex color format. Use #RRGGBB format.',
  })
  .optional();

// ============================================================================
// Capture Item Schemas
// ============================================================================

/**
 * Schema for creating a capture item
 */
export const CreateCaptureItemSchema = z.object({
  type: CaptureItemTypeSchema,
  title: ShortStringSchema,
  content: SanitizedStringSchema.nullable().optional(),
  extractedText: SanitizedStringSchema.nullable().optional(),
  imageUrl: z.string().max(1000000).nullable().optional(), // Base64 images can be large
  sourceUrl: UrlSchema,
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  tags: TagsArraySchema,
  priority: PrioritySchema,
  status: ItemStatusSchema,
  assignedTo: z.string().trim().max(200).nullable().optional(),
  dueDate: IsoDateSchema,
  projectId: IdSchema.nullable().optional(),
});

/**
 * Schema for updating a capture item
 */
export const UpdateCaptureItemSchema = z.object({
  title: ShortStringSchema.optional(),
  content: SanitizedStringSchema.nullable().optional(),
  extractedText: SanitizedStringSchema.nullable().optional(),
  imageUrl: z.string().max(1000000).nullable().optional(),
  sourceUrl: UrlSchema,
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  tags: TagsArraySchema,
  priority: PrioritySchema.optional(),
  status: ItemStatusSchema.optional(),
  assignedTo: z.string().trim().max(200).nullable().optional(),
  dueDate: IsoDateSchema,
  projectId: IdSchema.nullable().optional(),
  pinned: z.boolean().optional(),
  reminder: IsoDateSchema,
});

/**
 * Schema for capture item query parameters
 */
export const CaptureItemQuerySchema = z.object({
  type: CaptureItemTypeSchema.optional(),
  status: ItemStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  assignedTo: z.string().trim().max(200).optional(),
  tag: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'oldest', 'pinned-first']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ============================================================================
// Project Schemas
// ============================================================================

/**
 * Schema for creating a project
 */
export const CreateProjectSchema = z.object({
  name: ShortStringSchema,
  description: MediumStringSchema.nullable().optional(),
  color: ColorHexSchema,
  icon: z.string().trim().max(50).nullable().optional(),
  status: ProjectStatusSchema.default('active'),
  priority: ProjectPrioritySchema.optional(),
  dueDate: IsoDateSchema,
});

/**
 * Schema for updating a project
 */
export const UpdateProjectSchema = z.object({
  name: ShortStringSchema.optional(),
  description: MediumStringSchema.nullable().optional(),
  color: ColorHexSchema,
  icon: z.string().trim().max(50).nullable().optional(),
  status: ProjectStatusSchema.optional(),
  priority: ProjectPrioritySchema.optional(),
  dueDate: IsoDateSchema,
});

// ============================================================================
// Template Schemas
// ============================================================================

/**
 * Schema for creating a template
 */
export const CreateTemplateSchema = z.object({
  name: ShortStringSchema,
  description: MediumStringSchema.nullable().optional(),
  content: SanitizedStringSchema,
  category: TemplateCategorySchema.default('general'),
  icon: z.string().trim().max(50).nullable().optional(),
  variables: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    placeholder: z.string().max(200).optional(),
    type: z.enum(['text', 'textarea', 'date']).default('text'),
  })).nullable().optional(),
  isDefault: z.boolean().default(false),
  projectId: IdSchema.nullable().optional(),
});

// ============================================================================
// Link Schemas
// ============================================================================

/**
 * Schema for creating a link between items
 */
export const CreateLinkSchema = z.object({
  sourceId: IdSchema,
  targetId: IdSchema,
  relationType: LinkRelationTypeSchema.default('related'),
  note: z.string().trim().max(500).nullable().optional(),
});

/**
 * Schema for deleting a link
 */
export const DeleteLinkSchema = z.object({
  sourceId: IdSchema,
  targetId: IdSchema,
});

// ============================================================================
// Search Schemas
// ============================================================================

/**
 * Schema for search query parameters
 */
export const SearchQuerySchema = z.object({
  q: z.string().trim().max(1000).optional(),
  type: CaptureItemTypeSchema.optional(),
  status: ItemStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  aiEnhanced: z.coerce.boolean().default(false),
  ai: z.coerce.boolean().default(false),
});

// ============================================================================
// Bulk Operation Schemas
// ============================================================================

/**
 * Schema for bulk assign/update operations
 */
export const BulkAssignSchema = z.object({
  itemIds: z.array(IdSchema).min(1).max(100),
  status: ItemStatusSchema.optional(),
  assignedTo: z.string().trim().max(200).nullable().optional(),
  projectId: IdSchema.nullable().optional(),
  tags: TagsArraySchema,
  priority: PrioritySchema.optional(),
});

// ============================================================================
// Bookmarklet Schemas
// ============================================================================

/**
 * Schema for bookmarklet capture requests
 */
export const BookmarkletCaptureSchema = z.object({
  type: CaptureItemTypeSchema.default('note'),
  title: z.string().trim().max(500).optional(),
  content: SanitizedStringSchema.optional(),
  sourceUrl: UrlSchema,
  selectedText: z.string().max(10000).optional(),
  pageTitle: z.string().trim().max(500).optional(),
  pageDescription: z.string().trim().max(5000).optional(),
  favicon: z.string().max(1000).optional(),
  screenshot: z.string().max(1000000).optional(), // Base64
});

// ============================================================================
// WebSocket Schemas
// ============================================================================

/**
 * Schema for WebSocket device registration
 */
export const DeviceRegisterSchema = z.object({
  deviceName: z.string().trim().max(100).optional(),
  deviceType: DeviceTypeSchema.optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CaptureItemType = z.infer<typeof CaptureItemTypeSchema>;
export type ItemStatus = z.infer<typeof ItemStatusSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectPriority = z.infer<typeof ProjectPrioritySchema>;
export type LinkRelationType = z.infer<typeof LinkRelationTypeSchema>;
export type DeviceType = z.infer<typeof DeviceTypeSchema>;

export type CreateCaptureItemInput = z.infer<typeof CreateCaptureItemSchema>;
export type UpdateCaptureItemInput = z.infer<typeof UpdateCaptureItemSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export type CreateLinkInput = z.infer<typeof CreateLinkSchema>;
export type BulkAssignInput = z.infer<typeof BulkAssignSchema>;
export type BookmarkletCaptureInput = z.infer<typeof BookmarkletCaptureSchema>;
