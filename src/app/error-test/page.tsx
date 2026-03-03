'use client';

import React, { useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Bug } from 'lucide-react';

/**
 * Error Test Page
 *
 * This page is used to test the ErrorBoundary component by intentionally
 * triggering errors in different scenarios.
 */

// Component that throws an error when triggered
function ThrowErrorComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('This is a test error from ThrowErrorComponent');
  }
  return (
    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
      <p className="text-green-600 dark:text-green-400">Component is working correctly!</p>
    </div>
  );
}

// Component that throws an error in render
function BadRenderComponent() {
  const [, setState] = useState<object>();

  return (
    <div className="space-y-4">
      <Button
        onClick={() => {
          // Trigger error by setting state to undefined (causes TypeError)
          setState(undefined as any);
        }}
        variant="destructive"
      >
        <Bug className="w-4 h-4 mr-2" />
        Trigger State Error
      </Button>
      <p className="text-sm text-muted-foreground">
        This will cause a TypeError when trying to access properties of undefined state.
      </p>
    </div>
  );
}

// Component that throws an error in useEffect
function BadEffectComponent() {
  const [shouldThrow, setShouldThrow] = useState(false);

  React.useEffect(() => {
    if (shouldThrow) {
      throw new Error('This is a test error from useEffect');
    }
  }, [shouldThrow]);

  return (
    <Button
      onClick={() => setShouldThrow(true)}
      variant="destructive"
    >
      <Bug className="w-4 h-4 mr-2" />
      Trigger useEffect Error
    </Button>
  );
}

export default function ErrorTestPage() {
  const [throwSimple, setThrowSimple] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Error Boundary Test Page</h1>
        <p className="text-muted-foreground">
          This page tests the ErrorBoundary component by intentionally triggering errors.
        </p>
      </div>

      {/* Test 1: Simple render error */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Test 1: Simple Render Error
          </CardTitle>
          <CardDescription>
            This error boundary catches errors during component rendering.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ErrorBoundary key={`test1-${resetKey}`}>
            <Button
              onClick={() => setThrowSimple(true)}
              variant="destructive"
              disabled={throwSimple}
            >
              <Bug className="w-4 h-4 mr-2" />
              Trigger Render Error
            </Button>
            <ThrowErrorComponent shouldThrow={throwSimple} />
          </ErrorBoundary>
        </CardContent>
      </Card>

      {/* Test 2: State mutation error */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Test 2: State Mutation Error
          </CardTitle>
          <CardDescription>
            This error boundary catches errors from state mutations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ErrorBoundary key={`test2-${resetKey}`}>
            <BadRenderComponent />
          </ErrorBoundary>
        </CardContent>
      </Card>

      {/* Test 3: useEffect error */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Test 3: useEffect Error
          </CardTitle>
          <CardDescription>
            Error boundaries catch errors in useEffect during rendering.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ErrorBoundary key={`test3-${resetKey}`}>
            <BadEffectComponent />
          </ErrorBoundary>
        </CardContent>
      </Card>

      {/* Reset button */}
      <Card>
        <CardHeader>
          <CardTitle>Reset All Tests</CardTitle>
          <CardDescription>
            Click to reset all error boundaries and try again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => {
              setThrowSimple(false);
              setResetKey(prev => prev + 1);
            }}
            variant="outline"
          >
            Reset All Tests
          </Button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>1. Click each "Trigger Error" button to test different error scenarios.</p>
          <p>2. Verify that the error boundary catches the error and shows a friendly error message.</p>
          <p>3. In development mode, you should see the stack trace.</p>
          <p>4. Use "Try Again" to reset the error boundary.</p>
          <p>5. Check the browser console for logged error details.</p>
          <p>6. Check sessionStorage for the errorLog array (contains last 10 errors).</p>
        </CardContent>
      </Card>
    </div>
  );
}
