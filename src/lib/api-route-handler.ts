import { NextResponse } from 'next/server';

/**
 * Consistent error JSON format for all API routes.
 * { error: string, details?: string }
 */
export interface ApiErrorResponse {
  error: string;
  details?: string;
}

/**
 * Create a consistent error response for API routes.
 * Logs the error server-side and returns a properly formatted JSON response.
 *
 * @param message - User-facing error message
 * @param status - HTTP status code (default 500)
 * @param options - Additional options
 * @param options.details - Additional error details for debugging (included in response)
 * @param options.logPrefix - Prefix for the server-side log (e.g., "[GET /api/capture]")
 * @param options.error - The original error to log server-side
 * @param options.headers - Additional response headers (e.g., CORS headers)
 */
export function apiError(
  message: string,
  status: number = 500,
  options?: {
    details?: string;
    logPrefix?: string;
    error?: unknown;
    headers?: Record<string, string>;
  }
): NextResponse<ApiErrorResponse> {
  const { details, logPrefix, error, headers } = options || {};

  // Log server-side for debugging
  if (error) {
    const prefix = logPrefix ? `${logPrefix} ` : '';
    console.error(`${prefix}${message}:`, error);
  }

  // Build the response body
  const body: ApiErrorResponse = { error: message };
  if (details) {
    body.details = details;
  }

  return NextResponse.json(body, { status, headers });
}

/**
 * Determine the error message and status for common error types.
 * Useful in catch blocks to handle JSON parse errors, Prisma errors, etc.
 */
export function classifyError(error: unknown): { message: string; status: number; details?: string } {
  // JSON parse errors (invalid request body)
  if (error instanceof SyntaxError) {
    return {
      message: 'Invalid JSON in request body',
      status: 400,
      details: error.message,
    };
  }

  // Prisma known request errors (e.g., unique constraint violations, foreign key violations)
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'clientVersion' in error
  ) {
    const prismaError = error as { code: string; message: string; meta?: Record<string, unknown> };

    switch (prismaError.code) {
      case 'P2002': // Unique constraint violation
        return {
          message: 'A record with this data already exists',
          status: 409,
          details: prismaError.meta?.target
            ? `Duplicate value for: ${String(prismaError.meta.target)}`
            : undefined,
        };
      case 'P2025': // Record not found
        return {
          message: 'Record not found',
          status: 404,
        };
      case 'P2003': // Foreign key constraint violation
        return {
          message: 'Referenced record does not exist',
          status: 400,
          details: prismaError.meta?.field_name
            ? `Invalid reference: ${String(prismaError.meta.field_name)}`
            : undefined,
        };
      default:
        return {
          message: 'Database error',
          status: 500,
          details: `Prisma error code: ${prismaError.code}`,
        };
    }
  }

  // Generic errors
  if (error instanceof Error) {
    return {
      message: 'Internal server error',
      status: 500,
      details: error.message,
    };
  }

  return {
    message: 'An unexpected error occurred',
    status: 500,
  };
}

/**
 * Wrap a route handler in consistent error handling.
 * Catches all errors, classifies them, and returns a consistent error response.
 *
 * Usage:
 * ```ts
 * export const GET = withErrorHandler('GET /api/capture', async (request) => {
 *   // ... your handler logic
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  routeName: string,
  handler: T
): T {
  const wrapped = async (...args: Parameters<T>): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      const classified = classifyError(error);
      return apiError(classified.message, classified.status, {
        details: classified.details,
        logPrefix: `[${routeName}]`,
        error,
      });
    }
  };

  return wrapped as T;
}
