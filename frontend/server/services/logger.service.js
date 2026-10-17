/**
 * Logger Service
 * 
 * Provides structured logging with context tracking for debugging and monitoring.
 * Supports development and production environments with different verbosity levels.
 *
 * Features:
 * - Structured logging service with context and environment-specific output
 */

class LoggerService {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * Format log message with timestamp and context
   * @private
   */
  formatLog(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      level,
      message,
      context,
      env: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * Log info-level messages
   */
  info(message, context = {}) {
    const log = this.formatLog('INFO', message, context);
    if (this.isDevelopment) {
      console.log(`[${log.timestamp}] INFO:`, message, context);
    } else {
      console.log(JSON.stringify(log));
    }
  }

  /**
   * Log error with full stack trace
   */
  error(message, error, context = {}) {
    const errorContext = {
      ...context,
      errorMessage: error?.message,
      errorStack: error?.stack,
      errorCode: error?.code,
    };
    const log = this.formatLog('ERROR', message, errorContext);
    if (this.isDevelopment) {
      console.error(`[${log.timestamp}] ERROR:`, message);
      console.error(error);
      console.error('Context:', errorContext);
    } else {
      console.error(JSON.stringify(log));
    }
  }

  /**
   * Log warning messages
   */
  warn(message, context = {}) {
    const log = this.formatLog('WARN', message, context);
    if (this.isDevelopment) {
      console.warn(`[${log.timestamp}] WARN:`, message, context);
    } else {
      console.warn(JSON.stringify(log));
    }
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message, context = {}) {
    if (this.isDevelopment) {
      const log = this.formatLog('DEBUG', message, context);
      console.debug(`[${log.timestamp}] DEBUG:`, message, context);
    }
  }

  /**
   * Log database query performance
   */
  logQueryTime(query, executionMs, context = {}) {
    const threshold = 100; // ms
    const isSlow = executionMs > threshold;
    const level = isSlow ? 'WARN' : 'DEBUG';
    
    const queryContext = {
      ...context,
      query,
      executionMs,
      isSlow: isSlow,
    };

    if (level === 'WARN' || this.isDevelopment) {
      this.debug(`Query execution: ${executionMs}ms`, queryContext);
    }
  }
}

module.exports = LoggerService;
