import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { motion } from 'framer-motion';

export function GTDSkeleton() {
  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 animate-pulse" />
          <Skeleton className="h-5 w-64 animate-pulse" />
        </div>
        <Skeleton className="h-10 w-32 animate-pulse" />
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-40 animate-pulse" />
            <Skeleton className="h-6 w-20 animate-pulse" />
          </div>
          <Skeleton className="h-2 w-full animate-pulse" />
        </CardContent>
      </Card>

      {/* Processing Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-3/4 animate-pulse" />
                <Skeleton className="h-4 w-1/2 animate-pulse" />
              </div>
              <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0 animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Content preview */}
            <Skeleton className="h-4 w-full animate-pulse" />
            <Skeleton className="h-4 w-5/6 animate-pulse" />
            <Skeleton className="h-4 w-4/6 animate-pulse" />

            {/* AI Suggestion */}
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <Skeleton className="h-4 w-24 animate-pulse mb-2" />
              <Skeleton className="h-4 w-full animate-pulse" />
              <Skeleton className="h-4 w-3/4 animate-pulse mt-1" />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-10 w-24 animate-pulse" />
              <Skeleton className="h-10 w-24 animate-pulse" />
              <Skeleton className="h-10 w-24 animate-pulse" />
              <Skeleton className="h-10 w-24 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
