/**
 * Structured Logging Utility
 *
 * Provides consistent, structured logging across the application.
 * Supports different log levels and includes contextual metadata.
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  module?: string;
  function?: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number; // For performance logging
}

/**
 * Get log level from environment
 */
function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  if (envLevel && Object.values(LogLevel).includes(envLevel as LogLevel)) {
    return envLevel as LogLevel;
  }
  // Default to INFO in production, DEBUG in development
  return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
}

/**
 * Check if a log level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel();
  const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
  return levels.indexOf(level) >= levels.indexOf(currentLevel);
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level}]`,
    entry.context?.module ? `[${entry.context.module}]` : '',
    entry.context?.function ? `${entry.context.function}()` : '',
    entry.message,
  ].filter(Boolean).join(' ');

  // Add error details if present
  if (entry.error) {
    return `${parts}\n  Error: ${entry.error.name}: ${entry.error.message}${entry.error.stack ? '\n  Stack: ' + entry.error.stack : ''}`;
  }

  // Add duration if present
  if (entry.duration !== undefined) {
    return `${parts} (${entry.duration.toFixed(1)}ms)`;
  }

  // Add context as JSON if present
  if (entry.context && Object.keys(entry.context).length > 0) {
    const cleanContext = { ...entry.context };
    delete cleanContext.module;
    delete cleanContext.function;
    if (Object.keys(cleanContext).length > 0) {
      return `${parts} ${JSON.stringify(cleanContext)}`;
    }
  }

  return parts;
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    // Add Prisma error code if present
    if (error && typeof error === 'object' && 'code' in error) {
      entry.error.code = (error as any).code;
    }
  }

  const formatted = formatLogEntry(entry);

  // Output to appropriate console stream
  switch (level) {
    case LogLevel.ERROR:
      console.error(formatted);
      break;
    case LogLevel.WARN:
      console.warn(formatted);
      break;
    case LogLevel.DEBUG:
      console.debug(formatted);
      break;
    default:
      console.log(formatted);
      break;
  }
}

/**
 * Logger with pre-configured module context
 */
export class Logger {
  private context: LogContext;

  constructor(module: string) {
    this.context = { module };
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    const logger = new Logger(this.context.module!);
    logger.context = { ...this.context, ...additionalContext };
    return logger;
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    log(LogLevel.DEBUG, message, { ...this.context, ...context });
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    log(LogLevel.INFO, message, { ...this.context, ...context });
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    log(LogLevel.WARN, message, { ...this.context, ...context });
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    log(LogLevel.ERROR, message, { ...this.context, ...context }, error);
  }

  /**
   * Log function call with duration (for performance monitoring)
   */
  logFunctionCall<T extends (...args: any[]) => any>(
    fn: T,
    fnName?: string
  ): T {
    const name = fnName || fn.name;
    return (async (...args: any[]) => {
      const start = performance.now();
      try {
        const result = await fn(...args);
        const duration = performance.now() - start;
        log(LogLevel.DEBUG, `${name}() completed`, {
          ...this.context,
          function: name,
          duration,
        });
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        log(LogLevel.ERROR, `${name}() failed`, { ...this.context, function: name, duration }, error as Error);
        throw error;
      }
    }) as T;
  }
}

// Module-specific loggers
export const loggers = {
  api: new Logger('API'),
  websocket: new Logger('WebSocket'),
  ai: new Logger('AI'),
  database: new Logger('Database'),
  server: new Logger('Server'),
  capture: new Logger('Capture'),
  inbox: new Logger('Inbox'),
  projects: new Logger('Projects'),
  search: new Logger('Search'),
  export: new Logger('Export'),
};

// Export convenience functions
export const logger = {
  debug: (message: string, context?: LogContext) => log(LogLevel.DEBUG, message, context),
  info: (message: string, context?: LogContext) => log(LogLevel.INFO, message, context),
  warn: (message: string, context?: LogContext) => log(LogLevel.WARN, message, context),
  error: (message: string, error?: Error, context?: LogContext) => log(LogLevel.ERROR, message, context, error),
};
