'use client';

import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';

interface AnimatedNumberProps {
  value: number | string;
  duration?: number;
  className?: string;
}

/**
 * Component that displays a number with smooth animation when it changes.
 * Handles both numeric values and percentage strings (e.g., "75%").
 */
export function AnimatedNumber({ value, duration = 400, className = '' }: AnimatedNumberProps) {
  const animatedValue = useAnimatedNumber(value, { duration });

  // If original value is a string with % suffix, preserve it
  if (typeof value === 'string' && value.includes('%')) {
    return <span className={className}>{Math.round(animatedValue)}%</span>;
  }

  // For regular numbers, round to integer for display
  return <span className={className}>{Math.round(animatedValue)}</span>;
}
