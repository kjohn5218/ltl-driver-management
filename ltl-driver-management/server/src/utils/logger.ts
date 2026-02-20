/**
 * Centralized Logging Service
 * Provides standardized logging format across the application
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogContext {
  requestId?: string;
  userId?: string | number;
  ip?: string;
  method?: string;
  path?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private static instance: Logger;
  private minLevel: LogLevel;
  private useJson: boolean;

  private constructor() {
    this.minLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'INFO');
    this.useJson = process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production';
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private parseLogLevel(level: string): LogLevel {
    const normalized = level.toUpperCase();
    if (normalized in LogLevel) {
      return LogLevel[normalized as keyof typeof LogLevel];
    }
    return LogLevel.INFO;
  }

  private getLevelPriority(level: LogLevel): number {
    const priorities = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3
    };
    return priorities[level];
  }

  private shouldLog(level: LogLevel): boolean {
    return this.getLevelPriority(level) >= this.getLevelPriority(this.minLevel);
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatEntry(entry: LogEntry): string {
    if (this.useJson) {
      return JSON.stringify(entry);
    }

    // Human-readable format for development
    const { timestamp, level, category, message, context, error } = entry;
    let output = `${timestamp} [${level}] [${category}] ${message}`;

    if (context && Object.keys(context).length > 0) {
      const contextStr = Object.entries(context)
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' ');
      output += ` | ${contextStr}`;
    }

    if (error) {
      output += ` | error=${error.name}: ${error.message}`;
      if (error.stack && process.env.NODE_ENV !== 'production') {
        output += `\n${error.stack}`;
      }
    }

    return output;
  }

  private log(level: LogLevel, category: string, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      category,
      message,
      context
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      };
    }

    const formatted = this.formatEntry(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  // General logging methods
  debug(category: string, message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, category, message, context);
  }

  info(category: string, message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, category, message, context);
  }

  warn(category: string, message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, category, message, context);
  }

  error(category: string, message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : undefined;
    if (error && !(error instanceof Error)) {
      context = { ...context, errorDetails: String(error) };
    }
    this.log(LogLevel.ERROR, category, message, context, err);
  }

  // Specialized logging methods

  /** Security-related events (attacks, blocks, suspicious activity) */
  security(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, 'SECURITY', message, context);
  }

  /** Critical security events requiring immediate attention */
  securityCritical(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, 'SECURITY', `[CRITICAL] ${message}`, context);
  }

  /** Audit trail for sensitive operations */
  audit(action: string, context: LogContext): void {
    this.log(LogLevel.INFO, 'AUDIT', action, {
      ...context,
      auditTimestamp: Date.now()
    });
  }

  /** API request logging */
  request(method: string, path: string, statusCode: number, durationMs: number, context?: LogContext): void {
    const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.log(level, 'HTTP', `${method} ${path} ${statusCode} ${durationMs}ms`, context);
  }

  /** Database operation logging */
  database(operation: string, table: string, durationMs?: number, context?: LogContext): void {
    this.log(LogLevel.DEBUG, 'DATABASE', `${operation} on ${table}${durationMs ? ` (${durationMs}ms)` : ''}`, context);
  }

  /** External service call logging */
  external(service: string, operation: string, success: boolean, context?: LogContext): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    this.log(level, 'EXTERNAL', `${service}: ${operation} ${success ? 'succeeded' : 'failed'}`, context);
  }

  /** Application lifecycle events */
  lifecycle(event: string, context?: LogContext): void {
    this.log(LogLevel.INFO, 'LIFECYCLE', event, context);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions for common use cases
export const log = {
  debug: (category: string, message: string, context?: LogContext) => logger.debug(category, message, context),
  info: (category: string, message: string, context?: LogContext) => logger.info(category, message, context),
  warn: (category: string, message: string, context?: LogContext) => logger.warn(category, message, context),
  error: (category: string, message: string, error?: Error | unknown, context?: LogContext) => logger.error(category, message, error, context),
  security: (message: string, context?: LogContext) => logger.security(message, context),
  securityCritical: (message: string, context?: LogContext) => logger.securityCritical(message, context),
  audit: (action: string, context: LogContext) => logger.audit(action, context),
  request: (method: string, path: string, statusCode: number, durationMs: number, context?: LogContext) => logger.request(method, path, statusCode, durationMs, context),
  external: (service: string, operation: string, success: boolean, context?: LogContext) => logger.external(service, operation, success, context),
  lifecycle: (event: string, context?: LogContext) => logger.lifecycle(event, context)
};

export default logger;
