/**
 * AI API Call Logger
 *
 * Wraps AI SDK calls to log requests, responses, and errors.
 * Provides visibility into AI usage for debugging and monitoring.
 */

import { loggers } from './logger';
import { time } from './performance-monitor';

const logger = loggers.ai;

export interface AICallLog {
  timestamp: string;
  function: string;
  params: any;
  duration?: number;
  success: boolean;
  response?: any;
  error?: string;
}

// Store recent AI calls for debugging (last 100 calls)
const aiCallLogs: AICallLog[] = [];
const MAX_LOGS = 100;

/**
 * Log an AI call
 */
function logAICall(log: AICallLog): void {
  aiCallLogs.push(log);

  // Keep only recent logs — remove all excess entries at once (O(excess) vs O(n) shift)
  if (aiCallLogs.length > MAX_LOGS) {
    aiCallLogs.splice(0, aiCallLogs.length - MAX_LOGS);
  }

  // Log to console
  if (log.success) {
    logger.info(`${log.function}() completed`, {
      duration: log.duration,
      function: log.function,
    });
  } else {
    logger.error(`${log.function}() failed`, new Error(log.error), {
      function: log.function,
      duration: log.duration,
    });
  }
}

/**
 * Wrap an AI function call with logging
 */
export async function withAILogging<T>(
  functionName: string,
  params: any,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    logger.debug(`${functionName}() called`, {
      function: functionName,
      params: JSON.stringify(params).substring(0, 200), // Truncate long params
    });

    const result = await fn();
    const duration = Date.now() - startTime;

    logAICall({
      timestamp: new Date().toISOString(),
      function: functionName,
      params,
      duration,
      success: true,
      response: typeof result === 'object' ? '[Object]' : result,
    });

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logAICall({
      timestamp: new Date().toISOString(),
      function: functionName,
      params,
      duration,
      success: false,
      error: error?.message || String(error),
    });

    throw error;
  }
}

/**
 * Get recent AI call logs
 */
export function getAICallLogs(limit: number = 50): AICallLog[] {
  return aiCallLogs.slice(-limit);
}

/**
 * Get AI call statistics
 */
export function getAICallStats(): {
  total: number;
  successful: number;
  failed: number;
  avgDuration: number;
  byFunction: Record<string, { count: number; avgDuration: number }>;
} {
  const stats = {
    total: aiCallLogs.length,
    successful: aiCallLogs.filter(log => log.success).length,
    failed: aiCallLogs.filter(log => !log.success).length,
    avgDuration: 0,
    byFunction: {} as Record<string, { count: number; avgDuration: number }>,
  };

  if (aiCallLogs.length === 0) {
    return stats;
  }

  // Calculate average duration
  const totalDuration = aiCallLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
  stats.avgDuration = totalDuration / aiCallLogs.length;

  // Group by function
  for (const log of aiCallLogs) {
    if (!stats.byFunction[log.function]) {
      stats.byFunction[log.function] = { count: 0, avgDuration: 0 };
    }
    stats.byFunction[log.function].count++;
  }

  // Calculate average duration per function
  for (const fn of Object.keys(stats.byFunction)) {
    const fnLogs = aiCallLogs.filter(log => log.function === fn);
    const fnTotalDuration = fnLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
    stats.byFunction[fn].avgDuration = fnTotalDuration / fnLogs.length;
  }

  return stats;
}

/**
 * Clear AI call logs
 */
export function clearAICallLogs(): void {
  aiCallLogs.length = 0;
}

/**
 * Wrap AI module with logging
 */
export function createAILogger() {
  return {
    /**
     * Log OCR text extraction call
     */
    async logOCR<T>(imageSize: number, fn: () => Promise<T>): Promise<T> {
      return withAILogging('extractTextFromImage', { imageSize }, fn);
    },

    /**
     * Log web page capture call
     */
    async logWebCapture<T>(url: string, fn: () => Promise<T>): Promise<T> {
      return withAILogging('captureWebPage', { url }, fn);
    },

    /**
     * Log auto-tagging call
     */
    async logAutoTag<T>(itemCount: number, fn: () => Promise<T>): Promise<T> {
      return withAILogging('generateTags', { itemCount }, fn);
    },

    /**
     * Log search enhancement call
     */
    async logSearchEnhance<T>(queryLength: number, resultCount: number, fn: () => Promise<T>): Promise<T> {
      return withAILogging('enhanceSearch', { queryLength, resultCount }, fn);
    },

    /**
     * Log insights generation call
     */
    async logInsights<T>(fn: () => Promise<T>): Promise<T> {
      return withAILogging('generateInsights', {}, fn);
    },

    /**
     * Log GTD processing suggestion call
     */
    async logProcessSuggestion<T>(fn: () => Promise<T>): Promise<T> {
      return withAILogging('generateProcessSuggestion', {}, fn);
    },

    /**
     * Log semantic connections call
     */
    async logConnections<T>(fn: () => Promise<T>): Promise<T> {
      return withAILogging('findConnections', {}, fn);
    },
  };
}

// Export singleton
export const aiLogger = createAILogger();
