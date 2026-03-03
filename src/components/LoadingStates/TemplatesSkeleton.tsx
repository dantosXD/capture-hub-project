import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';

export function TemplatesSkeleton() {
  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32 animate-pulse" />
          <Skeleton className="h-4 w-48 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32 animate-pulse" />
          <Skeleton className="h-8 w-20 animate-pulse" />
        </div>
      </div>

      {/* Template Cards */}
      <div className="grid gap-3">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Skeleton className="w-8 h-8 rounded-md flex-shrink-0 animate-pulse" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-5 w-48 animate-pulse" />
                      <Skeleton className="h-4 w-64 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-20 rounded-full animate-pulse" />
                    <Skeleton className="h-8 w-8 rounded flex-shrink-0 animate-pulse" />
                  </div>
                </div>
                <Skeleton className="mt-3 h-12 w-full rounded animate-pulse" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
