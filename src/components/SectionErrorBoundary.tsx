'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SectionErrorBoundaryProps {
  children: React.ReactNode;
  sectionName: string;
  fallback?: React.ReactNode;
}

/**
 * SectionErrorBoundary
 *
 * A specialized error boundary for major app sections that shows
 * a more localized error UI and allows other parts of the app
 * to continue functioning.
 */
export class SectionErrorBoundary extends React.Component<
  SectionErrorBoundaryProps,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`Error in section "${this.props.sectionName}":`, error);
    console.error('Component Stack:', errorInfo.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <CardTitle className="text-lg">Section Error</CardTitle>
            </div>
            <CardDescription>
              Something went wrong in the {this.props.sectionName} section. The rest of the app continues to work.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {this.state.error && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-mono text-destructive break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <Button onClick={this.handleReset} size="sm" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary wrapper for functional components
 */
interface SectionErrorWrapperProps {
  children: React.ReactNode;
  sectionName: string;
}

export function SectionErrorWrapper({ children, sectionName }: SectionErrorWrapperProps) {
  return (
    <SectionErrorBoundary sectionName={sectionName}>
      {children}
    </SectionErrorBoundary>
  );
}
