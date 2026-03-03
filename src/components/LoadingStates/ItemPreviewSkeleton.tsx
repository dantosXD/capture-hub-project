import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

export function ItemPreviewSkeleton() {
  return (
    <motion.div
      className="h-full flex flex-col bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Skeleton className="h-6 w-32 animate-pulse" />
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded animate-pulse" />
          <Skeleton className="w-8 h-8 rounded animate-pulse" />
        </div>
      </div>

      {/* Content */}
      <motion.div
        className="flex-1 overflow-y-auto p-6 space-y-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {/* Title */}
        <Skeleton className="h-8 w-3/4 animate-pulse" />

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-6 w-20 rounded-full animate-pulse" />
          <Skeleton className="h-6 w-24 rounded-full animate-pulse" />
          <Skeleton className="h-4 w-32 animate-pulse" />
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16 rounded-full animate-pulse" />
          <Skeleton className="h-6 w-20 rounded-full animate-pulse" />
          <Skeleton className="h-6 w-14 rounded-full animate-pulse" />
          <Skeleton className="h-6 w-18 rounded-full animate-pulse" />
        </div>

        {/* Content area */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-full animate-pulse" />
          <Skeleton className="h-4 w-full animate-pulse" />
          <Skeleton className="h-4 w-5/6 animate-pulse" />
          <Skeleton className="h-4 w-full animate-pulse" />
          <Skeleton className="h-4 w-4/5 animate-pulse" />
        </div>

        {/* Image placeholder (for OCR/screenshot) */}
        <Skeleton className="h-48 w-full rounded-lg animate-pulse" />

        {/* Source URL (for web captures) */}
        <div className="p-3 rounded-lg bg-muted">
          <Skeleton className="h-4 w-16 mb-2 animate-pulse" />
          <Skeleton className="h-4 w-full max-w-md animate-pulse" />
        </div>
      </motion.div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 p-4 border-t">
        <Skeleton className="h-10 w-24 rounded animate-pulse" />
        <Skeleton className="h-10 w-20 rounded animate-pulse" />
        <Skeleton className="h-10 w-16 rounded animate-pulse" />
      </div>
    </motion.div>
  );
}
