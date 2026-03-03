'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

interface AnimatedCountBadgeProps {
  count: number;
  variant?: 'secondary' | 'default' | 'outline' | 'destructive';
  className?: string;
  ariaLabel?: string;
  /** If true, show compact badge for small spaces (mobile nav) */
  compact?: boolean;
}

export function AnimatedCountBadge({
  count,
  variant = 'secondary',
  className = '',
  ariaLabel,
  compact = false,
}: AnimatedCountBadgeProps) {
  const prevCountRef = useRef(count);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'up' | 'down'>('up');

  useEffect(() => {
    if (prevCountRef.current !== count) {
      setDirection(count > prevCountRef.current ? 'up' : 'down');
      setIsAnimating(true);
      prevCountRef.current = count;

      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
  }, [count]);

  if (count <= 0) return null;

  const displayCount = compact && count > 99 ? '99+' : count;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={count}
        initial={{ scale: 0.6, opacity: 0, y: direction === 'up' ? 8 : -8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.6, opacity: 0, y: direction === 'up' ? -8 : 8 }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
          duration: 0.3,
        }}
      >
        <Badge
          variant={variant}
          className={`${className} ${
            isAnimating ? 'ring-2 ring-primary/30 ring-offset-1' : ''
          } transition-shadow duration-300`}
          aria-label={ariaLabel || `${count} items`}
        >
          {displayCount}
        </Badge>
      </motion.div>
    </AnimatePresence>
  );
}
