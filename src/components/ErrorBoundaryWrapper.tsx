'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface ErrorBoundaryWrapperProps {
  children: React.ReactNode;
}

/**
 * ErrorBoundaryWrapper
 *
 * Client component wrapper that provides error boundary functionality
 * for the entire application. This wraps the children content and
 * catches any React errors in the component tree.
 */
export function ErrorBoundaryWrapper({ children }: ErrorBoundaryWrapperProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log to console
    console.error('Application Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);

    // In development, show more details
    if (process.env.NODE_ENV === 'development') {
      console.group('Error Details');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.groupEnd();
    }
  };

  return (
    <ErrorBoundary onError={handleError}>
      {children}
    </ErrorBoundary>
  );
}
