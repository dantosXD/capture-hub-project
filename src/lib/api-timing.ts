/**
 * API response timing utility.
 * Adds X-Response-Time header to measure actual handler execution time,
 * separate from Next.js dev server overhead.
 */

import { NextResponse } from 'next/server';

/**
 * Wraps an API handler function with timing instrumentation.
 * Returns the response with X-Response-Time header added.
 */
export function withTiming<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    const start = performance.now();
    const response = await handler(...args);
    const elapsed = performance.now() - start;

    // Clone the response to add the header
    const headers = new Headers(response.headers);
    headers.set('X-Response-Time', `${elapsed.toFixed(1)}ms`);

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }) as T;
}
