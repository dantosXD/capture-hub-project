import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'framer-motion';

export function ProjectsListSkeleton() {
  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {[...Array(6)].map((_, i) => (
        <ProjectCardSkeleton key={i} index={i} />
      ))}
    </motion.div>
  );
}

function ProjectCardSkeleton({ index }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.3,
        delay: (index || 0) * 0.06,
        ease: [0.0, 0.0, 0.2, 1]
      }}
    >
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Icon */}
              <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0 animate-pulse" />

              {/* Title and Description */}
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-6 w-full max-w-[150px] animate-pulse" />
                <Skeleton className="h-4 w-full max-w-[100px] animate-pulse" />
              </div>
            </div>

            {/* Menu button */}
            <Skeleton className="w-8 h-8 rounded flex-shrink-0 animate-pulse" />
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex items-center justify-between">
            {/* Status badge */}
            <Skeleton className="h-6 w-20 rounded-full animate-pulse" />

            {/* Item count */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-12 animate-pulse" />
              <Skeleton className="w-4 h-4 animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
