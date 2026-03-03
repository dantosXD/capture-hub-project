import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';

export function TagManagerSkeleton() {
  return (
    <motion.div
      className="p-6 space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 animate-pulse" />
          <Skeleton className="h-4 w-64 animate-pulse" />
        </div>
        <Skeleton className="h-10 w-32 animate-pulse" />
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 animate-pulse" />
                  <Skeleton className="h-8 w-16 animate-pulse" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Skeleton className="h-10 w-full sm:flex-1 animate-pulse" />
            <Skeleton className="h-10 w-full sm:w-48 animate-pulse" />
          </div>
        </CardContent>
      </Card>

      {/* Tags List */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.03, duration: 0.3 }}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Skeleton className="h-6 w-20 rounded-full animate-pulse" />
                  <Skeleton className="h-4 w-24 animate-pulse" />
                </div>
                <div className="flex gap-1">
                  <Skeleton className="h-8 w-8 rounded animate-pulse" />
                  <Skeleton className="h-8 w-8 rounded animate-pulse" />
                  <Skeleton className="h-8 w-8 rounded animate-pulse" />
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
