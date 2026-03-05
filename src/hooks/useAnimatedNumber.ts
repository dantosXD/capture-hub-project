'use client';

import { useState, useEffect, useRef } from 'react';

interface UseAnimatedNumberOptions {
  duration?: number; // Animation duration in ms
  ease?: (t: number) => number; // Easing function
}

/**
 * Custom hook for animating number changes.
 * Smoothly transitions from oldValue to newValue over the specified duration.
 */
export function useAnimatedNumber(
  value: number | string,
  options: UseAnimatedNumberOptions = {}
): number {
  const { duration = 400, ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 } = options;

  const [displayValue, setDisplayValue] = useState(() => {
    // Parse numeric values, return non-numeric as-is (0 for animation purposes)
    if (typeof value === 'number') return value;
    const numericValue = parseFloat(String(value).replace(/[^\d.-]/g, ''));
    return isNaN(numericValue) ? 0 : numericValue;
  });

  const previousValueRef = useRef<number>(displayValue);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Parse the new value
    const targetValue = typeof value === 'number'
      ? value
      : parseFloat(String(value).replace(/[^\d.-]/g, ''));

    if (isNaN(targetValue)) {
      // Non-numeric value, just update without animation
      previousValueRef.current = displayValue;
      return;
    }

    const startValue = previousValueRef.current;

    // If value hasn't changed, skip animation
    if (startValue === targetValue) {
      return;
    }

    // Cancel any existing animation before starting a new one
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Start animation
    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) return;

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = ease(progress);

      const newValue = startValue + (targetValue - startValue) * easedProgress;
      setDisplayValue(newValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        previousValueRef.current = targetValue;
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [value, duration, ease]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return displayValue;
}
