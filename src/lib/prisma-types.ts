/**
 * Re-exported Prisma types for use across API routes and services.
 * Provides type safety for all database operations.
 *
 * Import like: import { Prisma, type CaptureItem } from '@/lib/prisma-types';
 */

// Re-export Prisma namespace for accessing generated types like
// Prisma.CaptureItemWhereInput, Prisma.CaptureItemUpdateInput, etc.
export { Prisma } from '@prisma/client';

// Re-export model types for return value typing
export type {
  CaptureItem,
  Project,
  Template,
  ItemLink,
  ConnectedDevice,
  AIConnection,
  AppConfig,
  AIProviderType,
  AIHealthStatus,
} from '@prisma/client';

// Convenience type aliases for common use cases
import type { Prisma } from '@prisma/client';

// CaptureItem types
export type CaptureItemWhereInput = Prisma.CaptureItemWhereInput;
export type CaptureItemUpdateInput = Prisma.CaptureItemUncheckedUpdateInput;
export type CaptureItemCreateInput = Prisma.CaptureItemUncheckedCreateInput;
export type CaptureItemOrderByInput = Prisma.CaptureItemOrderByWithRelationInput;

// Project types
export type ProjectWhereInput = Prisma.ProjectWhereInput;
export type ProjectUpdateInput = Prisma.ProjectUncheckedUpdateInput;
export type ProjectCreateInput = Prisma.ProjectUncheckedCreateInput;
export type ProjectOrderByInput = Prisma.ProjectOrderByWithRelationInput;

// Template types
export type TemplateWhereInput = Prisma.TemplateWhereInput;
export type TemplateUpdateInput = Prisma.TemplateUncheckedUpdateInput;
export type TemplateCreateInput = Prisma.TemplateUncheckedCreateInput;
export type TemplateOrderByInput = Prisma.TemplateOrderByWithRelationInput;

// ItemLink types
export type ItemLinkWhereInput = Prisma.ItemLinkWhereInput;
export type ItemLinkCreateInput = Prisma.ItemLinkUncheckedCreateInput;

// ConnectedDevice types
export type ConnectedDeviceWhereInput = Prisma.ConnectedDeviceWhereInput;
export type ConnectedDeviceCreateInput = Prisma.ConnectedDeviceUncheckedCreateInput;

// AI connection types
export type AIConnectionWhereInput = Prisma.AIConnectionWhereInput;
export type AIConnectionCreateInput = Prisma.AIConnectionUncheckedCreateInput;
export type AIConnectionUpdateInput = Prisma.AIConnectionUncheckedUpdateInput;

// AppConfig types
export type AppConfigWhereInput = Prisma.AppConfigWhereInput;
export type AppConfigCreateInput = Prisma.AppConfigUncheckedCreateInput;
export type AppConfigUpdateInput = Prisma.AppConfigUncheckedUpdateInput;

// SortOrder re-export for convenience
export type SortOrder = Prisma.SortOrder;
