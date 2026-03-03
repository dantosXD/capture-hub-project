/**
 * Rate limiting utility for API endpoints
 * Provides in-memory rate limiting to prevent abuse and DoS attacks
 *
 * Note: For production with multiple server instances, use Redis-based rate limiting
 * or a dedicated rate limiting service.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blockedUntil?: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
}

/**
 * In-memory store for rate limit tracking
 * Key: identifier (IP address, API key, etc.)
 * Value: RateLimitEntry
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries from the rate limit store
 * Run periodically to prevent memory leaks
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now && (!entry.blockedUntil || entry.blockedUntil < now)) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}

/**
 * Rate limit configuration presets
 */
export const RateLimitPresets: Record<string, RateLimitConfig> = {
  // Very strict for authentication endpoints
  auth: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 5 requests per minute
    blockDurationMs: 15 * 60 * 1000, // Block for 15 minutes
  },

  // Strict for write operations (create, update, delete)
  write: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 20 requests per minute
    blockDurationMs: 5 * 60 * 1000, // Block for 5 minutes
  },

  // Moderate for general API use
  standard: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 100 requests per minute
  },

  // Lenient for read-only operations
  read: {
    maxRequests: 200,
    windowMs: 60 * 1000, // 200 requests per minute
  },

  // Very lenient for search
  search: {
    maxRequests: 50,
    windowMs: 60 * 1000, // 50 searches per minute
  },

  // Loose for WebSocket connections
  websocket: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 10 connection attempts per minute
    blockDurationMs: 5 * 60 * 1000,
  },

  // Loose for bookmarklet
  bookmarklet: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 30 captures per minute
  },
};

/**
 * Check if a request should be rate limited
 *
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Object with success status and rate limit info
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // If entry is blocked, check if block should be lifted
  if (entry?.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime: entry.blockedUntil,
      retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
    };
  }

  // If no entry or window expired, create new entry
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(identifier, newEntry);

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }

  // Increment counter
  entry.count++;

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    // Apply block if configured
    if (config.blockDurationMs) {
      entry.blockedUntil = now + config.blockDurationMs;
    }

    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: config.blockDurationMs
        ? Math.ceil(config.blockDurationMs / 1000)
        : Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  return {
    allowed: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get a rate limit response object for API responses
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Extract client IP address from request headers
 * Handles proxy and load balancer scenarios
 */
export function getClientIp(request: Request): string {
  // Check various headers for real IP
  const headers = request.headers;

  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to remote address (not available in Next.js API routes easily)
  return 'unknown';
}

/**
 * Rate limit middleware for Next.js API routes
 *
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @returns Object with success status and headers
 */
export function rateLimitMiddleware(
  request: Request,
  config: RateLimitConfig
): {
  success: boolean;
  rateLimit: RateLimitInfo;
  retryAfter?: number;
} {
  const identifier = getClientIp(request);
  const result = checkRateLimit(identifier, config);

  return {
    success: result.allowed,
    rateLimit: {
      limit: result.limit,
      remaining: result.remaining,
      reset: Math.ceil(result.resetTime / 1000),
    },
    retryAfter: result.retryAfter,
  };
}

/**
 * Reset rate limit for a specific identifier (useful for testing or admin)
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Get current rate limit status for an identifier
 */
export function getRateLimitStatus(identifier: string): RateLimitEntry | undefined {
  return rateLimitStore.get(identifier);
}

/**
 * Clear all rate limit data (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}
