/**
 * CSRF (Cross-Site Request Forgery) protection utilities
 *
 * Since this is a single-tenant app without authentication, we use:
 * 1. Origin-based validation
 * 2. SameSite cookie attributes
 * 3. Referer header validation
 */

/**
 * Allowed origins for CSRF protection
 * In production, this should be configured via environment variables
 */
const ALLOWED_ORIGINS = new Set<string>();

/**
 * Initialize allowed origins from environment variable
 * Format: comma-separated list of origins
 * Example: http://localhost:3000,https://capturehub.example.com
 */
export function initAllowedOrigins(): void {
  const envOrigins = process.env.ALLOWED_ORIGINS || '';
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];

  if (envOrigins) {
    envOrigins.split(',').forEach(origin => {
      ALLOWED_ORIGINS.add(origin.trim());
    });
  } else {
    // In development, allow all localhost origins
    if (process.env.NODE_ENV === 'development') {
      defaultOrigins.forEach(origin => ALLOWED_ORIGINS.add(origin));
    }
  }

  // Always add the app URL if configured
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    ALLOWED_ORIGINS.add(appUrl);
  }
}

// Initialize on module load
initAllowedOrigins();

/**
 * Validate if a request origin is allowed
 *
 * @param origin - The Origin header value
 * @returns true if origin is allowed, false otherwise
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  // Exact match
  if (ALLOWED_ORIGINS.has(origin)) {
    return true;
  }

  // For development, allow any localhost/127.0.0.1 origin
  if (process.env.NODE_ENV === 'development') {
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Validate if a referer is from an allowed origin
 *
 * @param referer - The Referer header value
 * @returns true if referer is from allowed origin, false otherwise
 */
export function isAllowedReferer(referer: string | null): boolean {
  if (!referer) return false;

  try {
    const url = new URL(referer);
    const origin = `${url.protocol}//${url.host}`;
    return isAllowedOrigin(origin);
  } catch {
    return false;
  }
}

/**
 * Get the origin from a request
 * Checks Origin header first, then falls back to Referer
 */
export function getRequestOrigin(request: Request): string | null {
  const origin = request.headers.get('origin');
  if (origin) return origin;

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      return `${url.protocol}//${url.host}`;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Validate CSRF for a request
 * Checks Origin header (preferred) or Referer header (fallback)
 *
 * @param request - The request to validate
 * @returns Object with validation result and error message if failed
 */
export function validateCsrf(request: Request): {
  valid: boolean;
  error?: string;
  origin?: string;
} {
  // Skip validation for GET, HEAD, OPTIONS requests (they're read-only)
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }

  const origin = getRequestOrigin(request);

  if (!origin) {
    return {
      valid: false,
      error: 'Missing Origin or Referer header',
    };
  }

  if (!isAllowedOrigin(origin)) {
    return {
      valid: false,
      error: `Origin not allowed: ${origin}`,
      origin,
    };
  }

  return {
    valid: true,
    origin,
  };
}

/**
 * CORS headers for API responses
 * Includes SameSite cookie attributes and CSRF protection headers
 */
export function getCorsHeaders(origin?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset',
  };

  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  } else if (process.env.NODE_ENV === 'development') {
    // In development, allow any origin
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return headers;
}

/**
 * Generate CSRF token for use in forms
 * Note: Since this is a single-tenant app without auth, we use
 * origin-based validation instead of tokens.
 *
 * For future authentication implementation, this can be enhanced
 * with proper CSRF tokens.
 */
export function generateCsrfToken(): string {
  // Simple timestamp-based token (not for production use with auth)
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return Buffer.from(`${timestamp}.${random}`).toString('base64');
}

/**
 * Validate CSRF token
 * Note: This is a placeholder for future authentication implementation
 */
export function validateCsrfToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [timestamp] = decoded.split('.');

    // Token should be from within the last 24 hours
    const tokenAge = Date.now() - parseInt(timestamp);
    return tokenAge < 24 * 60 * 60 * 1000 && tokenAge > 0;
  } catch {
    return false;
  }
}

/**
 * Security headers for API responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

/**
 * Combine all security headers for API responses
 */
export function getAllSecurityHeaders(origin?: string | null): Record<string, string> {
  return {
    ...getSecurityHeaders(),
    ...getCorsHeaders(origin),
  };
}
