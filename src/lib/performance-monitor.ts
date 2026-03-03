/**
 * Performance Monitoring Utility
 *
 * Tracks API response times, AI API call durations, and system metrics.
 * Provides insights into application performance.
 */

import { loggers } from './logger';

const logger = loggers.server;

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface PerformanceStats {
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
  p99Duration: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private maxMetricsPerKey = 1000; // Prevent unbounded growth

  /**
   * Record a performance metric
   */
  record(name: string, duration: number, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: new Date().toISOString(),
      metadata,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    // Keep only the most recent metrics
    if (metrics.length > this.maxMetricsPerKey) {
      metrics.shift();
    }

    // Log slow operations (> 1 second)
    if (duration > 1000) {
      logger.warn(`Slow operation: ${name} took ${duration.toFixed(1)}ms`, {
        name,
        duration,
      });
    }
  }

  /**
   * Get statistics for a metric
   */
  getStats(name: string): PerformanceStats | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const count = durations.length;
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    return {
      count,
      totalDuration,
      avgDuration: totalDuration / count,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p95Duration: durations[Math.floor(count * 0.95)],
      p99Duration: durations[Math.floor(count * 0.99)],
    };
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Clear metrics for a specific name
   */
  clearMetric(name: string): void {
    this.metrics.delete(name);
  }

  /**
   * Get a summary of all metrics
   */
  getSummary(): Record<string, PerformanceStats> {
    const summary: Record<string, PerformanceStats> = {};
    for (const name of this.getMetricNames()) {
      const stats = this.getStats(name);
      if (stats) {
        summary[name] = stats;
      }
    }
    return summary;
  }
}

// Global performance monitor instance
const performanceMonitor = new PerformanceMonitor();

/**
 * Time a function execution
 */
export async function time<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    performanceMonitor.record(name, duration, metadata);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    performanceMonitor.record(name, duration, { ...metadata, error: true });
    throw error;
  }
}

/**
 * Get performance stats
 */
export function getPerformanceStats(name?: string): PerformanceStats | Record<string, PerformanceStats> | null {
  if (name) {
    return performanceMonitor.getStats(name);
  }
  return performanceMonitor.getSummary();
}

/**
 * Clear performance metrics
 */
export function clearPerformanceMetrics(name?: string): void {
  if (name) {
    performanceMonitor.clearMetric(name);
  } else {
    performanceMonitor.clear();
  }
}

/**
 * Get all metric names
 */
export function getPerformanceMetricNames(): string[] {
  return performanceMonitor.getMetricNames();
}

// Export the monitor for direct access if needed
export { performanceMonitor };

/**
 * Wrapper to track API route performance
 */
export function trackPerformance<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    return time(name, () => fn(...args), {
      args: args.length,
    });
  }) as T;
}

/**
 * System metrics monitoring
 */
export function getSystemMetrics(): {
  memory: NodeJS.MemoryUsage;
  uptime: number;
  timestamp: string;
} {
  return {
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log system metrics (for monitoring)
 */
export function logSystemMetrics(): void {
  const metrics = getSystemMetrics();
  logger.debug('System metrics', {
    memoryUsed: `${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    memoryTotal: `${(metrics.memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    uptime: `${metrics.uptime.toFixed(0)}s`,
  });
}
