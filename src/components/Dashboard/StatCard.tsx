'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { scaleOnHover, staggerItem } from '@/lib/animations';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
  onClick?: () => void;
  highlighted?: boolean;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  trendValue,
  className,
  onClick,
  highlighted,
}: StatCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover="hover"
      whileTap={onClick ? "tap" : undefined}
      initial="rest"
      animate="rest"
    >
      <motion.div variants={scaleOnHover}>
        <Card
          className={cn(
            'transition-all duration-200',
            onClick && 'cursor-pointer hover:shadow-md hover:border-primary/50',
            highlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
            className
          )}
          onClick={onClick}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold">{value}</p>
                {description && (
                  <p className="text-xs text-muted-foreground">{description}</p>
                )}
                {trend && trendValue && (
                  <div
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium',
                      trend === 'up' && 'text-emerald-500',
                      trend === 'down' && 'text-red-500',
                      trend === 'neutral' && 'text-muted-foreground'
                    )}
                  >
                    {trend === 'up' && '↑'}
                    {trend === 'down' && '↓'}
                    {trendValue}
                  </div>
                )}
              </div>
              <div
                className={cn(
                  'p-2 rounded-lg bg-gradient-to-br',
                  highlighted
                    ? 'from-primary/20 to-primary/10 text-primary'
                    : 'from-muted to-muted/50 text-muted-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
