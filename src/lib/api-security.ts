/**
 * API Security Helper
 * Combines validation, sanitization, rate limiting, and CSRF protection
 * for use in API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  validateCsrf,
  getAllSecurityHeaders,
  getRequestOrigin,
} from './csrf';
import {
  rateLimitMiddleware,
  RateLimitPresets,
} from './rate-limit';
import { classifyError } from './api-route-handler';

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  success: boolean;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
  rateLimit?: RateLimitInfo;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
}

/**
 * Validate and sanitize a request
 *
 * @param request - Next.js request object
 * @param options - Security options
 * @returns Validation result
 */
export async function validateRequest(request: NextRequest, options: {
  requireCsrf?: boolean;
  rateLimitPreset?: keyof typeof RateLimitPresets;
  rateLimitConfig?: RateLimitConfig;
  allowedMethods?: string[];
}): Promise<SecurityValidationResult> {
  const {
    requireCsrf = true,
    rateLimitPreset = 'standard',
    allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  } = options;

  // Check HTTP method
  const method = request.method.toUpperCase();
  if (!allowedMethods.includes(method)) {
    return {
      success: false,
      error: 'Method not allowed',
      status: 405,
      headers: getAllSecurityHeaders(),
    };
  }

  // CSRF validation for state-changing methods
  if (requireCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfValidation = validateCsrf(request);
    if (!csrfValidation.valid) {
      return {
        success: false,
        error: csrfValidation.error || 'CSRF validation failed',
        status: 403,
        headers: getAllSecurityHeaders(getRequestOrigin(request)),
      };
    }
  }

  // Rate limiting
  const rateLimitConfig = options.rateLimitConfig || RateLimitPresets[rateLimitPreset];
  const rateLimitResult = rateLimitMiddleware(request, rateLimitConfig);

  if (!rateLimitResult.success) {
    return {
      success: false,
      error: 'Rate limit exceeded',
      status: 429,
      headers: {
        ...getAllSecurityHeaders(getRequestOrigin(request)),
        'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
      },
      rateLimit: rateLimitResult.rateLimit,
    };
  }

  return {
    success: true,
    headers: {
      ...getAllSecurityHeaders(getRequestOrigin(request)),
      'X-RateLimit-Limit': rateLimitResult.rateLimit.limit.toString(),
      'X-RateLimit-Remaining': rateLimitResult.rateLimit.remaining.toString(),
      'X-RateLimit-Reset': rateLimitResult.rateLimit.reset.toString(),
    },
    rateLimit: rateLimitResult.rateLimit,
  };
}

/**
 * Validate request body against a Zod schema
 *
 * @param request - Next.js request object
 * @param schema - Zod schema to validate against
 * @returns Validated data or error response
 */
export async function validateBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T
): Promise<z.infer<T> | NextResponse> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.issues.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      }));

      return NextResponse.json(
        {
          error: 'Validation failed',
          details: errors,
        },
        { status: 400, headers: getAllSecurityHeaders(getRequestOrigin(request)) }
      );
    }

    return result.data;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400, headers: getAllSecurityHeaders(getRequestOrigin(request)) }
    );
  }
}

/**
 * Validate query parameters against a Zod schema
 *
 * @param request - Next.js request object
 * @param schema - Zod schema to validate against
 * @returns Validated data or error response
 */
export function validateQuery<T extends z.ZodType>(
  request: NextRequest,
  schema: T
): z.infer<T> | NextResponse {
  const { searchParams } = new URL(request.url);
  const params: Record<string, unknown> = {};

  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }

  const result = schema.safeParse(params);

  if (!result.success) {
    const errors = result.error.issues.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }));

    return NextResponse.json(
      {
        error: 'Query validation failed',
        details: errors,
      },
      { status: 400, headers: getAllSecurityHeaders(getRequestOrigin(request)) }
    );
  }

  return result.data;
}

/**
 * Create a secure API error response with proper headers
 *
 * @param message - Error message
 * @param status - HTTP status code
 * @param request - Request object for headers
 * @returns NextResponse with error and headers
 */
export function secureError(
  message: string,
  status: number,
  request: NextRequest
): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: getAllSecurityHeaders(getRequestOrigin(request)),
    }
  );
}

/**
 * Create a secure API success response with proper headers
 *
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @param request - Request object for headers
 * @returns NextResponse with data and headers
 */
export function secureSuccess(
  data: unknown,
  status: number,
  request: NextRequest,
  additionalHeaders?: Record<string, string>
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      ...getAllSecurityHeaders(getRequestOrigin(request)),
      ...additionalHeaders,
    },
  });
}

/**
 * Wrap an API handler with security checks
 * This is a convenience function for common patterns
 */
export function withSecurity<T extends z.ZodType>(
  handler: (request: NextRequest, data: z.infer<T>, validation: SecurityValidationResult) => Promise<NextResponse>,
  options: {
    bodySchema?: T;
    querySchema?: z.ZodType;
    rateLimitPreset?: keyof typeof RateLimitPresets;
    requireCsrf?: boolean;
  }
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Step 1: Security validation (CSRF, rate limiting)
    const securityValidation = await validateRequest(request, {
      requireCsrf: options.requireCsrf,
      rateLimitPreset: options.rateLimitPreset,
    });

    if (!securityValidation.success) {
      return NextResponse.json(
        { error: securityValidation.error },
        {
          status: securityValidation.status || 500,
          headers: securityValidation.headers,
        }
      );
    }

    // Step 2: Body validation (if schema provided)
    let validatedBody: z.infer<T> | undefined;
    if (options.bodySchema) {
      const bodyResult = await validateBody(request, options.bodySchema);

      if (bodyResult instanceof NextResponse) {
        // Validation failed, return error response
        return bodyResult;
      }

      validatedBody = bodyResult;
    }

    // Step 3: Query validation (if schema provided)
    let validatedQuery: z.infer<typeof options.querySchema> | undefined;
    if (options.querySchema) {
      const queryResult = validateQuery(request, options.querySchema);

      if (queryResult instanceof NextResponse) {
        return queryResult;
      }

      validatedQuery = queryResult;
    }

    // Step 4: Call the handler
    try {
      return await handler(request, validatedBody as z.infer<T>, securityValidation);
    } catch (error) {
      const classified = classifyError(error);
      return NextResponse.json(
        { error: classified.message },
        {
          status: classified.status,
          headers: securityValidation.headers,
        }
      );
    }
  };
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export function handleOptions(request: NextRequest): NextResponse {
  const origin = getRequestOrigin(request);
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...getAllSecurityHeaders(origin),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}
