import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';

export function InboxListSkeleton() {
  return (
    <motion.div
      className="divide-y"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {[...Array(5)].map((_, i) => (
        <InboxItemSkeleton key={i} index={i} />
      ))}
    </motion.div>
  );
}

function InboxItemSkeleton({ index }: { index?: number }) {
  return (
    <motion.div
      className="p-4 flex items-start gap-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: (index || 0) * 0.05,
        ease: [0.0, 0.0, 0.2, 1]
      }}
    >
      {/* Checkbox */}
      <Skeleton className="w-5 h-5 rounded flex-shrink-0 mt-1 animate-pulse" />

      {/* Type icon */}
      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0 animate-pulse" />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Title */}
        <Skeleton className="h-5 w-3/4 max-w-[300px] animate-pulse" />

        {/* Metadata row */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16 rounded-full animate-pulse" />
          <Skeleton className="h-4 w-20 animate-pulse" />
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1 flex-wrap">
          <Skeleton className="h-5 w-12 rounded-full animate-pulse" />
          <Skeleton className="h-5 w-16 rounded-full animate-pulse" />
          <Skeleton className="h-5 w-14 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Skeleton className="w-8 h-8 rounded animate-pulse" />
        <Skeleton className="w-8 h-8 rounded animate-pulse" />
      </div>
    </motion.div>
  );
}
