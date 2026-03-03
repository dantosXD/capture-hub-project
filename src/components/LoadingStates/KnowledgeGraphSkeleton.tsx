import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { motion } from 'framer-motion';

export function KnowledgeGraphSkeleton() {
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
          <Skeleton className="h-7 w-56 animate-pulse" />
          <Skeleton className="h-5 w-80 animate-pulse" />
        </div>
        <Skeleton className="h-10 w-40 animate-pulse" />
      </div>

      {/* Item Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0 animate-pulse" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-3/4 animate-pulse" />
              <Skeleton className="h-4 w-1/2 animate-pulse" />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Links Section */}
      <div className="grid sm:grid-cols-2 gap-6">
        {/* Incoming Links */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Outgoing Links */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Create Link Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40 animate-pulse" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full animate-pulse" />
            <Skeleton className="h-10 w-full animate-pulse" />
            <Skeleton className="h-10 w-32 animate-pulse" />
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
