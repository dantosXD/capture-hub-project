'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface TagDistributionProps {
  topTags: Array<{ tag: string; count: number }>;
}

export function TagDistribution({ topTags }: TagDistributionProps) {
  // Calculate max count for percentage calculations
  const maxCount = useMemo(() => {
    return topTags[0]?.count || 1;
  }, [topTags]);

  if (topTags.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Tag className="w-5 h-5 text-purple-500" />
            Tag Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No tags yet. Start adding tags to your captures to see the distribution.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Tag className="w-5 h-5 text-purple-500" />
          Tag Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topTags.map((tag, index) => {
            const percentage = (tag.count / maxCount) * 100;

            return (
              <motion.div
                key={tag.tag}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="space-y-1"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">#{tag.tag}</span>
                  <span className="text-muted-foreground">{tag.count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ delay: index * 0.05 + 0.2, duration: 0.5 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
