import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Edit3, ScanLine, Camera, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

export function SearchResultsSkeleton() {
  return (
    <motion.div
      className="space-y-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {[...Array(5)].map((_, i) => (
        <SearchResultItemSkeleton key={i} index={i} />
      ))}
    </motion.div>
  );
}

function SearchResultItemSkeleton({ index }: { index?: number }) {
  return (
    <motion.div
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.2,
        delay: (index || 0) * 0.05,
        ease: [0.0, 0.0, 0.2, 1]
      }}
    >
      {/* Type icon */}
      <Skeleton className="w-8 h-8 rounded-lg animate-pulse" />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Title */}
        <Skeleton className="h-4 w-3/4 max-w-[280px] animate-pulse" />

        {/* Metadata */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-16 rounded-full animate-pulse" />
          <Skeleton className="h-3 w-24 animate-pulse" />
        </div>
      </div>

      {/* Arrow */}
      <Skeleton className="w-4 h-4 animate-pulse" />
    </motion.div>
  );
}
