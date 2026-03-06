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

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getFirstHeaderValue(value: string | null): string | null {
  if (!value) return null;

  const first = value.split(',')[0]?.trim();
  return first || null;
}

function addAllowedOrigin(value: string | null | undefined): void {
  const normalized = normalizeOrigin(value);
  if (normalized) {
    ALLOWED_ORIGINS.add(normalized);
  }
}

export function getExpectedRequestOrigin(request: Request): string | null {
  const forwardedProto = getFirstHeaderValue(request.headers.get('x-forwarded-proto'));
  const forwardedHost = getFirstHeaderValue(request.headers.get('x-forwarded-host'));

  if (forwardedProto && forwardedHost) {
    return normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
  }

  const host = getFirstHeaderValue(request.headers.get('host'));
  if (host) {
    try {
      const url = new URL(request.url);
      return normalizeOrigin(`${url.protocol}//${host}`);
    } catch {
      return null;
    }
  }

  return normalizeOrigin(request.url);
}

/**
 * Initialize allowed origins from environment variable
 * Format: comma-separated list of origins
 * Example: http://localhost:3000,https://capturehub.example.com
 */
export function initAllowedOrigins(): void {
  ALLOWED_ORIGINS.clear();

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
      addAllowedOrigin(origin.trim());
    });
  } else {
    // In development, allow all localhost origins
    if (process.env.NODE_ENV === 'development') {
      defaultOrigins.forEach(origin => addAllowedOrigin(origin));
    }
  }

  // Prefer the server-only app URL, but retain NEXT_PUBLIC_APP_URL as a deployment fallback.
  addAllowedOrigin(process.env.APP_URL);
  addAllowedOrigin(process.env.NEXT_PUBLIC_APP_URL);
}

// Initialize on module load
initAllowedOrigins();

/**
 * Validate if a request origin is allowed
 *
 * @param origin - The Origin header value
 * @returns true if origin is allowed, false otherwise
 */
export function isAllowedOrigin(origin: string | null, request?: Request): boolean {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;

  // Explicit dev bypass via env var (no unconditional localhost bypass)
  if (process.env.CSRF_DEV_BYPASS === 'true') {
    return true;
  }

  // In development, allow any localhost / 127.0.0.1 origin regardless of port
  // (covers browser preview proxies, dev tools, etc.)
  if (process.env.NODE_ENV === 'development') {
    if (normalizedOrigin.startsWith('http://localhost:') || normalizedOrigin.startsWith('http://127.0.0.1:')) {
      return true;
    }
  }

  // Always allow the request's own origin, even when the app sits behind a reverse proxy.
  if (request) {
    const expectedOrigin = getExpectedRequestOrigin(request);
    if (expectedOrigin && normalizedOrigin === expectedOrigin) {
      return true;
    }
  }

  // Exact match
  if (ALLOWED_ORIGINS.has(normalizedOrigin)) {
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
export function isAllowedReferer(referer: string | null, request?: Request): boolean {
  if (!referer) return false;

  try {
    const url = new URL(referer);
    const origin = `${url.protocol}//${url.host}`;
    return isAllowedOrigin(origin, request);
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

  if (!isAllowedOrigin(origin, request)) {
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
