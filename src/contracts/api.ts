/**
 * API Contract Registry
 * Defines every API endpoint with its method, path, request schema,
 * response schema, rate limit preset, and auth requirements.
 *
 * This is the single source of truth for the API surface.
 * No route handler should exist without a corresponding contract here.
 */

import { z } from 'zod';
import {
  CreateCaptureItemSchema,
  UpdateCaptureItemSchema,
  CaptureItemQuerySchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  CreateTemplateSchema,
  CreateLinkSchema,
  DeleteLinkSchema,
  SearchQuerySchema,
  BulkAssignSchema,
  BookmarkletCaptureSchema,
} from '@/lib/validation-schemas';

// ============================================================================
// Route Contract Definition
// ============================================================================

export interface RouteContract<
  TBody extends z.ZodType = z.ZodType,
  TQuery extends z.ZodType = z.ZodType,
  TParams extends z.ZodType = z.ZodType,
> {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** URL path pattern (Next.js App Router style) */
  path: string;
  /** Human-readable description */
  description: string;
  /** Domain this route belongs to */
  domain: 'capture' | 'project' | 'template' | 'link' | 'search' | 'ai' | 'device' | 'export' | 'system' | 'bookmarklet' | 'inbox';
  /** Request body schema (POST/PUT/PATCH) */
  bodySchema?: TBody;
  /** Query parameter schema (GET) */
  querySchema?: TQuery;
  /** URL parameter schema */
  paramsSchema?: TParams;
  /** Rate limit preset key */
  rateLimit: 'auth' | 'write' | 'standard' | 'read' | 'search' | 'websocket' | 'bookmarklet';
  /** Whether authentication is required */
  requiresAuth: boolean;
  /** Whether CSRF validation is required */
  requiresCsrf: boolean;
  /** Tags for documentation/grouping */
  tags: string[];
}

// ============================================================================
// Common Parameter Schemas
// ============================================================================

export const IdParamSchema = z.object({
  id: z.string().min(1).max(100),
});

// ============================================================================
// API Contract Registry
// ============================================================================

export const API_CONTRACTS = {
  // --------------------------------------------------------------------------
  // Capture Items
  // --------------------------------------------------------------------------
  'capture.list': {
    method: 'GET',
    path: '/api/capture',
    description: 'List capture items with filtering and pagination',
    domain: 'capture',
    querySchema: CaptureItemQuerySchema,
    rateLimit: 'read',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['capture', 'list'],
  },
  'capture.create': {
    method: 'POST',
    path: '/api/capture',
    description: 'Create a new capture item',
    domain: 'capture',
    bodySchema: CreateCaptureItemSchema,
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['capture', 'create'],
  },
  'capture.get': {
    method: 'GET',
    path: '/api/capture/[id]',
    description: 'Get a single capture item by ID',
    domain: 'capture',
    paramsSchema: IdParamSchema,
    rateLimit: 'read',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['capture', 'read'],
  },
  'capture.update': {
    method: 'PUT',
    path: '/api/capture/[id]',
    description: 'Update a capture item',
    domain: 'capture',
    paramsSchema: IdParamSchema,
    bodySchema: UpdateCaptureItemSchema,
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['capture', 'update'],
  },
  'capture.delete': {
    method: 'DELETE',
    path: '/api/capture/[id]',
    description: 'Delete a capture item',
    domain: 'capture',
    paramsSchema: IdParamSchema,
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['capture', 'delete'],
  },
  'capture.ocr': {
    method: 'POST',
    path: '/api/capture/ocr',
    description: 'Process OCR on an image',
    domain: 'capture',
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['capture', 'ocr', 'ai'],
  },
  'capture.webpage': {
    method: 'POST',
    path: '/api/capture/webpage',
    description: 'Capture a webpage',
    domain: 'capture',
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['capture', 'webpage'],
  },

  // --------------------------------------------------------------------------
  // Projects
  // --------------------------------------------------------------------------
  'project.list': {
    method: 'GET',
    path: '/api/projects',
    description: 'List all projects',
    domain: 'project',
    rateLimit: 'read',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['project', 'list'],
  },
  'project.create': {
    method: 'POST',
    path: '/api/projects',
    description: 'Create a new project',
    domain: 'project',
    bodySchema: CreateProjectSchema,
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['project', 'create'],
  },
  'project.get': {
    method: 'GET',
    path: '/api/projects/[id]',
    description: 'Get a project by ID',
    domain: 'project',
    paramsSchema: IdParamSchema,
    rateLimit: 'read',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['project', 'read'],
  },
  'project.update': {
    method: 'PUT',
    path: '/api/projects/[id]',
    description: 'Update a project',
    domain: 'project',
    paramsSchema: IdParamSchema,
    bodySchema: UpdateProjectSchema,
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['project', 'update'],
  },
  'project.delete': {
    method: 'DELETE',
    path: '/api/projects/[id]',
    description: 'Delete a project',
    domain: 'project',
    paramsSchema: IdParamSchema,
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['project', 'delete'],
  },

  // --------------------------------------------------------------------------
  // Templates
  // --------------------------------------------------------------------------
  'template.list': {
    method: 'GET',
    path: '/api/templates',
    description: 'List all templates',
    domain: 'template',
    rateLimit: 'read',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['template', 'list'],
  },
  'template.create': {
    method: 'POST',
    path: '/api/templates',
    description: 'Create a new template',
    domain: 'template',
    bodySchema: CreateTemplateSchema,
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['template', 'create'],
  },
  'template.get': {
    method: 'GET',
    path: '/api/templates/[id]',
    description: 'Get a template by ID',
    domain: 'template',
    paramsSchema: IdParamSchema,
    rateLimit: 'read',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['template', 'read'],
  },
  'template.update': {
    method: 'PUT',
    path: '/api/templates/[id]',
    description: 'Update a template',
    domain: 'template',
    paramsSchema: IdParamSchema,
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['template', 'update'],
  },
  'template.delete': {
    method: 'DELETE',
    path: '/api/templates/[id]',
    description: 'Delete a template',
    domain: 'template',
    paramsSchema: IdParamSchema,
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['template', 'delete'],
  },
  'template.seed': {
    method: 'POST',
    path: '/api/templates/seed',
    description: 'Seed default templates',
    domain: 'template',
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['template', 'seed'],
  },

  // --------------------------------------------------------------------------
  // Links (Knowledge Graph)
  // --------------------------------------------------------------------------
  'link.list': {
    method: 'GET',
    path: '/api/links',
    description: 'List item links',
    domain: 'link',
    rateLimit: 'read',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['link', 'list'],
  },
  'link.create': {
    method: 'POST',
    path: '/api/links',
    description: 'Create a link between items',
    domain: 'link',
    bodySchema: CreateLinkSchema,
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['link', 'create'],
  },
  'link.delete': {
    method: 'DELETE',
    path: '/api/links',
    description: 'Delete a link between items',
    domain: 'link',
    bodySchema: DeleteLinkSchema,
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['link', 'delete'],
  },

  // --------------------------------------------------------------------------
  // Search
  // --------------------------------------------------------------------------
  'search.query': {
    method: 'GET',
    path: '/api/search',
    description: 'Search capture items',
    domain: 'search',
    querySchema: SearchQuerySchema,
    rateLimit: 'search',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['search'],
  },

  // --------------------------------------------------------------------------
  // Inbox / Bulk Operations
  // --------------------------------------------------------------------------
  'inbox.list': {
    method: 'GET',
    path: '/api/inbox',
    description: 'List inbox items',
    domain: 'inbox',
    rateLimit: 'read',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['inbox', 'list'],
  },
  'inbox.assign': {
    method: 'POST',
    path: '/api/inbox/assign',
    description: 'Bulk assign/update inbox items',
    domain: 'inbox',
    bodySchema: BulkAssignSchema,
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['inbox', 'bulk'],
  },

  // --------------------------------------------------------------------------
  // AI Endpoints
  // --------------------------------------------------------------------------
  'ai.summary': {
    method: 'POST',
    path: '/api/ai/summary',
    description: 'Generate AI summary for an item',
    domain: 'ai',
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['ai', 'summary'],
  },
  'ai.bulkSummary': {
    method: 'POST',
    path: '/api/ai/bulk-summary',
    description: 'Generate AI summaries for multiple items',
    domain: 'ai',
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['ai', 'summary', 'bulk'],
  },
  'ai.suggestions': {
    method: 'POST',
    path: '/api/ai/suggestions',
    description: 'Get AI suggestions for an item',
    domain: 'ai',
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['ai', 'suggestions'],
  },
  'ai.connections': {
    method: 'POST',
    path: '/api/ai/connections',
    description: 'Find AI-suggested connections between items',
    domain: 'ai',
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['ai', 'connections'],
  },
  'ai.insights': {
    method: 'POST',
    path: '/api/ai/insights',
    description: 'Generate AI insights across items',
    domain: 'ai',
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['ai', 'insights'],
  },
  'ai.processSuggestion': {
    method: 'POST',
    path: '/api/ai/process-suggestion',
    description: 'Process an AI suggestion (apply it)',
    domain: 'ai',
    rateLimit: 'write',
    requiresAuth: false,
    requiresCsrf: true,
    tags: ['ai', 'process'],
  },

  // --------------------------------------------------------------------------
  // Bookmarklet
  // --------------------------------------------------------------------------
  'bookmarklet.capture': {
    method: 'POST',
    path: '/api/bookmarklet',
    description: 'Capture from bookmarklet',
    domain: 'bookmarklet',
    bodySchema: BookmarkletCaptureSchema,
    rateLimit: 'bookmarklet',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['bookmarklet', 'capture'],
  },

  // --------------------------------------------------------------------------
  // System
  // --------------------------------------------------------------------------
  'system.health': {
    method: 'GET',
    path: '/api/health',
    description: 'Health check endpoint',
    domain: 'system',
    rateLimit: 'read',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['system', 'health'],
  },
  'system.stats': {
    method: 'GET',
    path: '/api/stats',
    description: 'Get system statistics',
    domain: 'system',
    rateLimit: 'read',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['system', 'stats'],
  },
  'system.tags': {
    method: 'GET',
    path: '/api/tags',
    description: 'List all tags',
    domain: 'system',
    rateLimit: 'read',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['system', 'tags'],
  },
  'system.devices': {
    method: 'GET',
    path: '/api/devices',
    description: 'List connected devices',
    domain: 'device',
    rateLimit: 'read',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['device', 'list'],
  },
  'system.export': {
    method: 'GET',
    path: '/api/export',
    description: 'Export data',
    domain: 'export',
    rateLimit: 'standard',
    requiresAuth: false,
    requiresCsrf: false,
    tags: ['export'],
  },
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type ApiContractKey = keyof typeof API_CONTRACTS;
export type ApiContract = (typeof API_CONTRACTS)[ApiContractKey];

/**
 * Get all contracts for a specific domain
 */
export function getContractsByDomain(domain: string) {
  return Object.entries(API_CONTRACTS).filter(
    ([, contract]) => contract.domain === domain
  );
}

/**
 * Get all contracts matching a tag
 */
export function getContractsByTag(tag: string) {
  return Object.entries(API_CONTRACTS).filter(
    ([, contract]) => (contract.tags as readonly string[]).includes(tag)
  );
}

/**
 * Validate that a route path + method combination exists in the registry
 */
export function isRegisteredRoute(path: string, method: string): boolean {
  return Object.values(API_CONTRACTS).some(
    (contract) => contract.path === path && contract.method === method
  );
}
