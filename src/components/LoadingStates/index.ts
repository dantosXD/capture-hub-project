/**
 * Loading States / Skeleton Components
 *
 * This module exports all skeleton loading components for use across the application.
 * These components provide visual feedback during data loading states.
 *
 * Usage:
 *   import { DashboardStatsSkeleton } from '@/components/LoadingStates';
 *
 *   if (loading) {
 *     return <DashboardStatsSkeleton />;
 *   }
 */

export { DashboardStatsSkeleton, DashboardContentSkeleton } from './DashboardStatsSkeleton';
export { InboxListSkeleton } from './InboxListSkeleton';
export { ItemPreviewSkeleton } from './ItemPreviewSkeleton';
export { SearchResultsSkeleton } from './SearchResultsSkeleton';
export { ProjectsListSkeleton } from './ProjectsListSkeleton';
export { GTDSkeleton } from './GTDSkeleton';
export { TagManagerSkeleton } from './TagManagerSkeleton';
export { TemplatesSkeleton } from './TemplatesSkeleton';
export { KnowledgeGraphSkeleton } from './KnowledgeGraphSkeleton';
