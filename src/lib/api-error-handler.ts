'use client';

import { toast } from 'sonner';

/**
 * API Error Types
 */
export const ApiErrorType = {
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION: 'VALIDATION',
  SERVER: 'SERVER',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ApiErrorType = typeof ApiErrorType[keyof typeof ApiErrorType];

/**
 * API Error Interface
 */
export interface ApiError {
  type: ApiErrorType;
  message: string;
  originalMessage?: string;
  status?: number;
  retryable: boolean;
}

/**
 * Default error messages for different error types
 */
const DEFAULT_ERROR_MESSAGES: Record<string, string> = {
  NETWORK: 'Network error. Please check your connection.',
  TIMEOUT: 'Request timed out. Please try again.',
  NOT_FOUND: 'The requested resource was not found.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access to this resource is forbidden.',
  VALIDATION: 'Please check your input and try again.',
  SERVER: 'Server error. Please try again later.',
  UNKNOWN: 'An unexpected error occurred.',
};

/**
 * Context-specific error messages
 */
const CONTEXT_ERROR_MESSAGES: Record<string, Record<number, string>> = {
  capture: {
    500: 'Failed to save item. Please try again.',
    400: 'Invalid item data. Please check your input.',
  },
  inbox: {
    500: 'Failed to update inbox. Please try again.',
  },
  projects: {
    500: 'Failed to save project. Please try again.',
    404: 'Project not found.',
  },
  templates: {
    500: 'Failed to save template. Please try again.',
  },
  links: {
    500: 'Failed to create link. Please try again.',
  },
  search: {
    500: 'Search failed. Please try again.',
  },
  export: {
    500: 'Export failed. Please try again.',
  },
  ocr: {
    500: 'OCR processing failed. Please try again.',
  },
  webpage: {
    500: 'Failed to extract webpage content.',
  },
};

/**
 * Parse Fetch error and return ApiError
 */
export function parseApiError(
  error: unknown,
  context: string = 'api'
): ApiError {
  // Network errors (fetch throws when network fails)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: ApiErrorType.NETWORK,
      message: DEFAULT_ERROR_MESSAGES.NETWORK,
      retryable: true,
    };
  }

  // Timeout errors (AbortError)
  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      type: ApiErrorType.TIMEOUT,
      message: DEFAULT_ERROR_MESSAGES.TIMEOUT,
      retryable: true,
    };
  }

  // Response with status
  if (error instanceof Response) {
    const status = error.status;
    let type: ApiErrorType;
    let message: string;

    // Determine error type from status
    if (status === 404) {
      type = ApiErrorType.NOT_FOUND;
      message = getContextMessage(context, status) || DEFAULT_ERROR_MESSAGES.NOT_FOUND;
    } else if (status === 401) {
      type = ApiErrorType.UNAUTHORIZED;
      message = DEFAULT_ERROR_MESSAGES.UNAUTHORIZED;
    } else if (status === 403) {
      type = ApiErrorType.FORBIDDEN;
      message = DEFAULT_ERROR_MESSAGES.FORBIDDEN;
    } else if (status >= 400 && status < 500) {
      type = ApiErrorType.VALIDATION;
      message = getContextMessage(context, status) || DEFAULT_ERROR_MESSAGES.VALIDATION;
    } else if (status >= 500) {
      type = ApiErrorType.SERVER;
      message = getContextMessage(context, status) || DEFAULT_ERROR_MESSAGES.SERVER;
    } else {
      type = ApiErrorType.UNKNOWN;
      message = DEFAULT_ERROR_MESSAGES.UNKNOWN;
    }

    return {
      type,
      message,
      status,
      retryable: status >= 500, // Server errors are retryable
    };
  }

  // Error objects with message
  if (error instanceof Error) {
    return {
      type: ApiErrorType.UNKNOWN,
      message: error.message || DEFAULT_ERROR_MESSAGES.UNKNOWN,
      originalMessage: error.message,
      retryable: false,
    };
  }

  // Unknown error
  return {
    type: ApiErrorType.UNKNOWN,
    message: DEFAULT_ERROR_MESSAGES.UNKNOWN,
    retryable: false,
  };
}

/**
 * Get context-specific error message
 */
function getContextMessage(context: string, status: number): string | null {
  return CONTEXT_ERROR_MESSAGES[context]?.[status] || null;
}

/**
 * Show toast notification for API error
 */
export function showApiErrorToast(
  error: ApiError,
  options?: {
    duration?: number;
    retryAction?: () => void;
  }
): void {
  const { duration = 5000, retryAction } = options || {};

  // Show error toast
  toast.error(error.message, {
    duration,
    action: error.retryable && retryAction
      ? {
          label: 'Retry',
          onClick: retryAction,
        }
      : undefined,
  });
}

/**
 * Fetch wrapper with error handling
 */
export async function fetchWithErrorHandling<T>(
  url: string,
  options?: RequestInit & {
    context?: string;
    showErrorToast?: boolean;
    retryable?: boolean;
  }
): Promise<T> {
  const {
    context = 'api',
    showErrorToast = true,
    retryable = true,
    ...fetchOptions
  } = options || {};

  try {
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw response; // Throw Response object for parseApiError
    }

    return await response.json();
  } catch (error) {
    const apiError = parseApiError(error, context);

    if (showErrorToast) {
      showApiErrorToast(apiError, {
        retryAction: retryable && apiError.retryable
          ? () => fetchWithErrorHandling(url, options)
          : undefined,
      });
    }

    throw apiError;
  }
}

/**
 * Retry fetch with exponential backoff
 */
export async function fetchWithRetry<T>(
  url: string,
  options?: RequestInit & {
    maxRetries?: number;
    retryDelay?: number;
    context?: string;
    showErrorToast?: boolean;
  }
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    context = 'api',
    showErrorToast = true,
    ...fetchOptions
  } = options || {};

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithErrorHandling<T>(url, {
        ...fetchOptions,
        context,
        // Only show error toast on final attempt
        showErrorToast: showErrorToast && attempt === maxRetries,
      });
    } catch (error) {
      lastError = error as ApiError;

      // Don't retry if error is not retryable
      if (!lastError.retryable) {
        if (showErrorToast) {
          showApiErrorToast(lastError);
        }
        throw lastError;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }
  }

  // Show final error
  if (showErrorToast && lastError) {
    showApiErrorToast(lastError);
  }

  throw lastError;
}
