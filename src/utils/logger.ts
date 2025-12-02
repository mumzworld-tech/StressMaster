/**
 * Structured Logger Utility
 * Provides structured logging following StressMaster agent guidelines
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  [key: string]: any;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

class StructuredLogger implements Logger {
  private level: LogLevel;
  private context: LogContext;

  constructor(level: LogLevel = LogLevel.INFO, context: LogContext = {}) {
    this.level = level;
    this.context = context;
  }

  debug(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.DEBUG) {
      this.log("DEBUG", message, context);
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.INFO) {
      this.log("INFO", message, context);
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.WARN) {
      this.log("WARN", message, context);
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.ERROR) {
      this.log("ERROR", message, context);
    }
  }

  private log(level: string, message: string, context?: LogContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...context,
    };

    // Only log if LOG_LEVEL is set to debug or in verbose mode
    // This prevents internal logging from cluttering user-facing output
    const shouldLog = 
      process.env.LOG_LEVEL === "debug" || 
      process.env.VERBOSE === "true" ||
      level === "ERROR" || 
      level === "WARN";

    if (!shouldLog) {
      return;
    }

    // In production, output JSON; in development, pretty print
    if (process.env.NODE_ENV === "production") {
      // Use stderr for structured logs to avoid interfering with stdout
      console.error(JSON.stringify(logEntry));
    } else {
      // Use stderr for debug logs to avoid interfering with user output
      const contextStr = Object.keys(logEntry).length > 3
        ? ` ${JSON.stringify({ ...this.context, ...context }, null, 2)}`
        : "";
      console.error(`[${level}] ${message}${contextStr}`);
    }
  }

  child(context: LogContext): Logger {
    return new StructuredLogger(this.level, { ...this.context, ...context });
  }
}

// Export singleton instance
export const logger = new StructuredLogger(
  process.env.LOG_LEVEL === "debug"
    ? LogLevel.DEBUG
    : process.env.NODE_ENV === "production"
    ? LogLevel.INFO
    : LogLevel.DEBUG
);

// Export factory function
export function createLogger(context?: LogContext): Logger {
  return logger.child(context || {});
}

