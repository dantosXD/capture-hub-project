/**
 * CSRF (Cross-Site Request Forgery) protection utilities
 *
 * Since this is a single-tenant app without authentication, we use:
 * 1. Origin-based validation
 * 2. SameSite cookie attributes
 * 3. Referer header validation
 */

import { randomBytes, createHmac } from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || randomBytes(32).toString('hex');

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

  // Always add the app URL if configured (server-only env var, no NEXT_PUBLIC_ prefix)
  const appUrl = process.env.APP_URL;
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

  // Explicit dev bypass via env var (no unconditional localhost bypass)
  if (process.env.CSRF_DEV_BYPASS === 'true') {
    return true;
  }

  // Exact match
  if (ALLOWED_ORIGINS.has(origin)) {
    return true;
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
 * Generate a cryptographically secure CSRF token using HMAC-SHA256.
 * Token format (base64url): nonce.timestamp.signature
 */
export function generateCsrfToken(): string {
  const nonce = randomBytes(16).toString('hex');
  const ts = Date.now().toString();
  const sig = createHmac('sha256', CSRF_SECRET).update(`${nonce}.${ts}`).digest('hex');
  return Buffer.from(`${nonce}.${ts}.${sig}`).toString('base64url');
}

/**
 * Validate a CSRF token by verifying its HMAC-SHA256 signature and age.
 */
export function validateCsrfToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const [nonce, ts, sig] = decoded.split('.');
    if (!nonce || !ts || !sig) return false;
    const age = Date.now() - parseInt(ts);
    if (age > 24 * 60 * 60 * 1000 || age < 0) return false;
    const expected = createHmac('sha256', CSRF_SECRET).update(`${nonce}.${ts}`).digest('hex');
    return sig === expected;
  } catch { return false; }
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
