import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { motion } from 'framer-motion';

export function DashboardStatsSkeleton() {
  return (
    <motion.div
      className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {[...Array(4)].map((_, i) => (
        <StatsCardSkeleton key={i} index={i} />
      ))}
    </motion.div>
  );
}

function StatsCardSkeleton({ index }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.3,
        delay: (index || 0) * 0.05,
        ease: [0.0, 0.0, 0.2, 1]
      }}
    >
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              {/* Label */}
              <Skeleton className="h-4 w-24 animate-pulse" />

              {/* Value */}
              <Skeleton className="h-8 w-16 animate-pulse" />

              {/* Subtitle */}
              <Skeleton className="h-3 w-32 animate-pulse" />
            </div>

            {/* Icon */}
            <Skeleton className="w-12 h-12 rounded-full flex-shrink-0 animate-pulse" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function DashboardContentSkeleton() {
  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Stats grid */}
      <DashboardStatsSkeleton />

      {/* Quick Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Insight */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-32 animate-pulse" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-6 w-full animate-pulse" />
            <Skeleton className="h-6 w-4/5 mt-2 animate-pulse" />
          </CardContent>
        </Card>
      </motion.div>

      {/* Two column layout */}
      <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-28 animate-pulse" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full animate-pulse" />
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Stale Items */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-28 animate-pulse" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-8 w-40 animate-pulse" />
                  <Skeleton className="h-4 w-20 animate-pulse" />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-36 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-16 rounded-full animate-pulse" />
                    <Skeleton className="h-5 w-48 animate-pulse" />
                  </div>
                  <Skeleton className="h-4 w-24 animate-pulse" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
