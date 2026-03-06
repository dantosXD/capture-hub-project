/**
 * Edge Gateway
 * Unified API gateway middleware that wraps all route handlers with:
 * - Contract validation (body, query, params against registered schemas)
 * - Rate limiting (per-route preset from contract registry)
 * - CSRF protection
 * - Request tracing (OTel-ready correlation IDs)
 * - Standard response envelope
 * - Error classification and consistent error format
 *
 * Usage:
 * ```ts
 * import { gateway } from '@/contracts/gateway';
 * import { API_CONTRACTS } from '@/contracts/api';
 *
 * export const GET = gateway('capture.list', async (ctx) => {
 *   const items = await db.captureItem.findMany();
 *   return ctx.success(items);
 * });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { API_CONTRACTS, type ApiContractKey } from './api';
import { validateRequest, validateBody, validateQuery } from '@/lib/api-security';
import { classifyError } from '@/lib/api-route-handler';
import { RateLimitPresets } from '@/lib/rate-limit';
import { getAllSecurityHeaders, getRequestOrigin } from '@/lib/csrf';

// ============================================================================
// Gateway Context (passed to every handler)
// ============================================================================

export interface GatewayContext<TBody = unknown, TQuery = unknown, TParams = unknown> {
  /** The original Next.js request */
  request: NextRequest;
  /** Validated request body (if bodySchema defined in contract) */
  body: TBody;
  /** Validated query parameters (if querySchema defined in contract) */
  query: TQuery;
  /** Route parameters (e.g., { id: "abc" }) */
  params: TParams;
  /** Unique request ID for tracing */
  requestId: string;
  /** Correlation ID (from header or generated) */
  correlationId: string;
  /** Request start timestamp */
  startedAt: number;
  /** Security headers to include in response */
  securityHeaders: Record<string, string>;

  /** Return a standard success response */
  success: <T>(data: T, options?: {
    status?: number;
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
    headers?: Record<string, string>;
  }) => NextResponse;

  /** Return a standard error response */
  error: (message: string, status?: number, details?: Array<{ path?: string; message: string }>) => NextResponse;
}

// ============================================================================
// Response Builders
// ============================================================================

function buildSuccessResponse<T>(
  data: T,
  ctx: { requestId: string; startedAt: number; securityHeaders: Record<string, string> },
  options?: {
    status?: number;
    pagination?: { page: number; limit: number; total: number };
    headers?: Record<string, string>;
  }
): NextResponse {
  const durationMs = Date.now() - ctx.startedAt;
  const pagination = options?.pagination;

  const body: Record<string, unknown> = {
    success: true,
    data,
    meta: {
      requestId: ctx.requestId,
      timestamp: new Date().toISOString(),
      durationMs,
    },
  };

  if (pagination) {
    const totalPages = Math.ceil(pagination.total / pagination.limit);
    body.pagination = {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
    };
  }

  return NextResponse.json(body, {
    status: options?.status || 200,
    headers: {
      ...ctx.securityHeaders,
      'X-Request-Id': ctx.requestId,
      'X-Response-Time': `${durationMs}ms`,
      ...options?.headers,
    },
  });
}

function buildErrorResponse(
  message: string,
  status: number,
  ctx: { requestId: string; securityHeaders: Record<string, string> },
  details?: Array<{ path?: string; message: string }>
): NextResponse {
  const body: Record<string, unknown> = {
    success: false,
    error: {
      code: statusToCode(status),
      message,
      ...(details && { details }),
    },
    meta: {
      requestId: ctx.requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return NextResponse.json(body, {
    status,
    headers: {
      ...ctx.securityHeaders,
      'X-Request-Id': ctx.requestId,
    },
  });
}

function statusToCode(status: number): string {
  const codes: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
  };
  return codes[status] || 'UNKNOWN_ERROR';
}

// ============================================================================
// Gateway Factory
// ============================================================================

/**
 * Create a gateway-wrapped route handler.
 *
 * @param contractKey - Key from API_CONTRACTS registry
 * @param handler - Async function that receives GatewayContext and returns NextResponse
 * @param options - Optional overrides
 */
export function gateway<K extends ApiContractKey>(
  contractKey: K,
  handler: (ctx: GatewayContext) => Promise<NextResponse>,
  options?: {
    /** Override params extraction (for dynamic routes) */
    extractParams?: (request: NextRequest, routeParams: Record<string, string>) => Record<string, string>;
  }
) {
  const contract = API_CONTRACTS[contractKey];

  return async (
    request: NextRequest,
    routeContext?: { params: Promise<Record<string, string>> | Record<string, string> }
  ): Promise<NextResponse> => {
    const startedAt = Date.now();
    const requestId = request.headers.get('x-request-id') || randomUUID();
    const correlationId = request.headers.get('x-correlation-id') || requestId;

    // Get security headers
    const origin = getRequestOrigin(request);
    const securityHeaders = {
      ...getAllSecurityHeaders(origin),
      'X-Request-Id': requestId,
      'X-Correlation-Id': correlationId,
    };

    const ctxBase = { requestId, startedAt, securityHeaders };

    try {
      // 1. Security validation (CSRF + rate limiting)
      const secValidation = await validateRequest(request, {
        requireCsrf: contract.requiresCsrf,
        rateLimitPreset: contract.rateLimit as keyof typeof RateLimitPresets,
      });

      if (!secValidation.success) {
        return buildErrorResponse(
          secValidation.error || 'Security validation failed',
          secValidation.status || 403,
          ctxBase
        );
      }

      // Merge rate limit headers
      if (secValidation.headers) {
        Object.assign(securityHeaders, secValidation.headers);
      }

      // 2. Validate request body (if contract defines bodySchema)
      let validatedBody: unknown = undefined;
      if ('bodySchema' in contract && contract.bodySchema && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const bodyResult = await validateBody(request, contract.bodySchema as z.ZodType);
        if (bodyResult instanceof NextResponse) {
          return bodyResult;
        }
        validatedBody = bodyResult;
      }

      // 3. Validate query parameters (if contract defines querySchema)
      let validatedQuery: unknown = undefined;
      if ('querySchema' in contract && contract.querySchema) {
        const queryResult = validateQuery(request, contract.querySchema as z.ZodType);
        if (queryResult instanceof NextResponse) {
          return queryResult;
        }
        validatedQuery = queryResult;
      }

      // 4. Extract route params
      let params: Record<string, string> = {};
      if (routeContext?.params) {
        params = routeContext.params instanceof Promise
          ? await routeContext.params
          : routeContext.params;
      }
      if (options?.extractParams) {
        params = options.extractParams(request, params);
      }

      // 5. Build gateway context
      const ctx: GatewayContext = {
        request,
        body: validatedBody,
        query: validatedQuery,
        params,
        requestId,
        correlationId,
        startedAt,
        securityHeaders,
        success: (data, opts) => buildSuccessResponse(data, ctxBase, opts),
        error: (msg, status = 400, details) => buildErrorResponse(msg, status || 400, ctxBase, details),
      };

      // 6. Execute handler
      const response = await handler(ctx);

      // 7. Inject tracing headers into response
      response.headers.set('X-Request-Id', requestId);
      response.headers.set('X-Correlation-Id', correlationId);
      response.headers.set('X-Response-Time', `${Date.now() - startedAt}ms`);

      return response;

    } catch (error) {
      // Classify and return consistent error
      const classified = classifyError(error);
      console.error(`[Gateway:${contractKey}] ${classified.message}:`, error);

      return buildErrorResponse(
        classified.message,
        classified.status,
        ctxBase,
        classified.details ? [{ message: classified.details }] : undefined
      );
    }
  };
}

// ============================================================================
// OPTIONS handler factory (CORS preflight)
// ============================================================================

export function gatewayOptions() {
  return async (request: NextRequest): Promise<NextResponse> => {
    const origin = getRequestOrigin(request);
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...getAllSecurityHeaders(origin),
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Request-Id, X-Correlation-Id, X-Client-Timestamp',
        'Access-Control-Max-Age': '86400',
      },
    });
  };
}
