/**
 * Error Recovery Strategies
 *
 * Implements various error recovery patterns:
 * - Retry with exponential backoff
 * - Circuit breaker pattern
 * - Fallback responses
 * - Graceful degradation
 */

import { loggers } from './logger';

const logger = loggers.server;

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  totalTimeoutMs?: number;
  retryableErrors?: Array<(error: any) => boolean>;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    // Retry on network errors
    (error: any) => error?.code === 'ECONNRESET',
    (error: any) => error?.code === 'ETIMEDOUT',
    (error: any) => error?.code === 'ENOTFOUND',
    // Retry on 5xx errors
    (error: any) => error?.status >= 500 && error?.status < 600,
    // Retry on 429 Too Many Requests
    (error: any) => error?.status === 429,
  ],
};

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const totalTimeout = fullConfig.totalTimeoutMs ?? 30_000;
  const startTime = Date.now();
  let lastError: any;
  let delay = fullConfig.initialDelay;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable BEFORE waiting — throw immediately for non-retryable errors
      const isRetryable = fullConfig.retryableErrors?.some(check => check(error));

      if (!isRetryable) {
        logger.error('Non-retryable error, giving up immediately', error instanceof Error ? error : undefined, {
          attempt: attempt + 1,
          maxRetries: fullConfig.maxRetries,
        });
        throw error;
      }

      if (attempt === fullConfig.maxRetries) {
        logger.error('Retry failed, giving up', error instanceof Error ? error : undefined, {
          attempt: attempt + 1,
          maxRetries: fullConfig.maxRetries,
        });
        throw error;
      }

      // Check total timeout: if elapsed + next delay would exceed totalTimeout, give up now
      if (Date.now() - startTime + delay > totalTimeout) {
        logger.error('Total timeout exceeded, giving up', error instanceof Error ? error : undefined, {
          attempt: attempt + 1,
          elapsed: Date.now() - startTime,
          totalTimeout,
        });
        throw lastError;
      }

      logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
        attempt: attempt + 1,
        maxRetries: fullConfig.maxRetries,
        error: (error as any)?.message,
      });

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * fullConfig.backoffMultiplier, fullConfig.maxDelay);
    }
  }

  throw lastError;
}

/**
 * Circuit breaker state
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN',     // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service has recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  resetTimeout: number; // Time to wait before attempting recovery
  monitoringPeriod: number; // Time window to count failures
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  monitoringPeriod: 10000, // 10 seconds
};

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number = 0;
  private successCount = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;

      // Try to recover after reset timeout
      if (timeSinceLastFailure >= this.config.resetTimeout) {
        logger.info('Circuit breaker attempting recovery', {
          state: this.state,
        });
        this.state = CircuitState.HALF_OPEN;
      } else {
        const error = new Error('Circuit breaker is OPEN - service unavailable');
        logger.warn('Circuit breaker rejected request', {
          state: this.state,
          timeUntilReset: this.config.resetTimeout - timeSinceLastFailure,
        });
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      logger.info('Circuit breaker recovered, closing circuit', {
        state: this.state,
      });
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      if (this.state !== CircuitState.OPEN) {
        logger.error('Circuit breaker opened due to failures', undefined, {
          state: this.state,
          failureCount: this.failureCount,
          threshold: this.config.failureThreshold,
        });
      }
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Get current state
   */
  getState(): { state: CircuitState; failureCount: number; successCount: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    logger.info('Circuit breaker manually reset', {
      previousState: this.state,
    });
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }
}

/**
 * Create a circuit breaker for a specific service
 */
export function createCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  const breaker = new CircuitBreaker(config);

  // Log state changes
  const originalExecute = breaker.execute.bind(breaker);
  breaker.execute = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await originalExecute(fn);
    } catch (error: any) {
      if (error?.message?.includes('Circuit breaker')) {
        logger.warn(`Circuit breaker "${name}" blocked request`, {
          name,
          ...breaker.getState(),
        });
      }
      throw error;
    }
  };

  return breaker;
}

/**
 * Fallback response generator
 */
export function withFallback<T>(
  fn: () => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<T> {
  return fn().catch(async (error) => {
    logger.warn('Using fallback response', {
      error: (error as any)?.message,
    });
    return await fallback();
  });
}

/**
 * Graceful degradation - return partial data on error
 */
export async function withGracefulDegradation<T>(
  primaryFn: () => Promise<T>,
  fallbackData: T,
  context: string
): Promise<T> {
  try {
    return await primaryFn();
  } catch (error) {
    logger.warn(`Graceful degradation activated for ${context}`, {
      error: (error as any)?.message,
    });
    return fallbackData;
  }
}

// Pre-configured circuit breakers for external services
export const circuitBreakers = {
  ai: createCircuitBreaker('AI Service', {
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
  }),
  database: createCircuitBreaker('Database', {
    failureThreshold: 5,
    resetTimeout: 10000, // 10 seconds
  }),
  externalApi: createCircuitBreaker('External API', {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
  }),
};
