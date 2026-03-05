import { NextRequest, NextResponse } from 'next/server';
import { getAllSecurityHeaders } from '@/lib/csrf';

export const runtime = 'nodejs';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const headers = getAllSecurityHeaders();
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
