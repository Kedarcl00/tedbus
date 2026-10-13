/**
 * LoggerService - Structured logging with context tracking
 * Provides consistent logging across the application with support for
 * different log levels, context information, and environment-aware output
 */

/**
 * Log levels for categorizing log messages
 */
const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

/**
 * Log context object for tracking request/operation metadata
 * @typedef {Object} LogContext
 * @property {string} [userId] - Authenticated user ID
 * @property {string} [endpoint] - API endpoint path
 * @property {string} [method] - HTTP method (GET, POST, etc.)
 * @property {string} [requestId] - Unique request identifier for tracing
 * @property {string} [operation] - Name of the operation being performed
 * @property {Object} [metadata] - Additional custom metadata
 */

/**
 * LoggerService - Centralized logging for the application
 * Handles structured logging with timestamps, context, and environment awareness
 *
 * Features:
 * - Structured log format for easy parsing and analysis
 * - Timestamp and context fields in all log output
 * - Separate logging for development vs production environments
 * - Query performance logging for database operations
 * - Debug logs only in development mode
 *
 * @class LoggerService
 */
class LoggerService {
  /**
   * Constructor for LoggerService
   * Initializes based on NODE_ENV for environment-aware logging
   */
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Get current timestamp in ISO 8601 format
   * @private
   * @returns {string} ISO 8601 formatted timestamp
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Build structured log object with standard fields
   * Ensures consistent format across all log output
   *
   * @private
   * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
   * @param {string} message - Log message
   * @param {Object} [context] - Optional context information
   * @returns {Object} Structured log object
   */
  buildLogObject(level, message, context = {}) {
    return {
      timestamp: this.getTimestamp(),
      level,
      message,
      ...(Object.keys(context).length > 0 && { context }),
    };
  }

  /**
   * Format and output log entry
   * Different formatting for development (readable) vs production (JSON)
   *
   * @private
   * @param {string} level - Log level
   * @param {Object} logObject - Structured log object
   */
  outputLog(level, logObject) {
    // Determine which console method to use
    let consoleMethod;
    switch (level) {
      case LOG_LEVELS.ERROR:
        consoleMethod = console.error;
        break;
      case LOG_LEVELS.WARN:
        consoleMethod = console.warn;
        break;
      case LOG_LEVELS.DEBUG:
        consoleMethod = console.debug;
        break;
      case LOG_LEVELS.INFO:
      default:
        consoleMethod = console.log;
        break;
    }

    // Format output based on environment
    if (this.isDevelopment) {
      // Development: readable format with color-coded prefix
      const prefix = this.getLogPrefix(level);
      consoleMethod(`${prefix} [${logObject.timestamp}]`, logObject.message);

      // Include context if present
      if (logObject.context && Object.keys(logObject.context).length > 0) {
        consoleMethod(`  Context:`, logObject.context);
      }
    } else {
      // Production: JSON format for log aggregation/parsing
      consoleMethod(JSON.stringify(logObject));
    }
  }

  /**
   * Get colored log prefix for development output
   * Makes logs easier to scan in development
   *
   * @private
   * @param {string} level - Log level
   * @returns {string} Color-coded prefix
   */
  getLogPrefix(level) {
    const prefixes = {
      [LOG_LEVELS.DEBUG]: '🔍',
      [LOG_LEVELS.INFO]: 'ℹ️',
      [LOG_LEVELS.WARN]: '⚠️',
      [LOG_LEVELS.ERROR]: '❌',
    };
    return prefixes[level] || '📝';
  }

  /**
   * Log informational messages
   * Used for general application events and flow tracking
   *
   * @param {string} message - The message to log
   * @param {Object} [context] - Optional context information
   *
   * @example
   * loggerService.info('User booking created', {
   *   userId: 'user123',
   *   bookingId: 'booking456',
   *   fare: 45.99
   * });
   */
  info(message, context) {
    const logObject = this.buildLogObject(LOG_LEVELS.INFO, message, context);
    this.outputLog(LOG_LEVELS.INFO, logObject);
  }

  /**
   * Log warning messages
   * Used for potentially problematic situations that should be investigated
   *
   * @param {string} message - The warning message to log
   * @param {Object} [context] - Optional context information
   *
   * @example
   * loggerService.warn('Low seat availability on route', {
   *   routeId: 'route123',
   *   availableSeats: 2,
   *   totalSeats: 50
   * });
   */
  warn(message, context) {
    const logObject = this.buildLogObject(LOG_LEVELS.WARN, message, context);
    this.outputLog(LOG_LEVELS.WARN, logObject);
  }

  /**
   * Log debug messages
   * Only logged in development mode; suppressed in production
   * Used for detailed debugging information
   *
   * @param {string} message - The debug message to log
   * @param {Object} [context] - Optional context information
   *
   * @example
   * loggerService.debug('Processing booking request', {
   *   userId: 'user123',
   *   selectedSeats: [1, 2, 3],
   *   paymentMethod: 'cash_on_trip'
   * });
   */
  debug(message, context) {
    // Only log debug messages in development environment
    if (!this.isDevelopment) {
      return;
    }

    const logObject = this.buildLogObject(LOG_LEVELS.DEBUG, message, context);
    this.outputLog(LOG_LEVELS.DEBUG, logObject);
  }

  /**
   * Log error messages with full stack trace
   * Called when errors occur to help with debugging and monitoring
   * Includes stack trace from Error objects for better diagnostics
   *
   * @param {string} message - Description of what was being done when error occurred
   * @param {Error} error - The Error object with stack trace
   * @param {Object} [context] - Optional context information (userId, endpoint, etc.)
   *
   * @example
   * loggerService.error('Failed to create booking', error, {
   *   userId: 'user123',
   *   endpoint: '/bookings',
   *   method: 'POST'
   * });
   */
  error(message, error, context) {
    // Build error context including stack trace
    const errorContext = {
      ...context,
      errorName: error.name || 'Error',
      errorMessage: error.message,
      errorCode: error.code || 'UNKNOWN',
      statusCode: error.statusCode || 500,
    };

    // Include stack trace in development mode
    if (this.isDevelopment && error.stack) {
      errorContext.stack = error.stack;
    }

    // Include error details if available (e.g., validation details)
    if (error.details) {
      errorContext.details = error.details;
    }

    const logObject = this.buildLogObject(LOG_LEVELS.ERROR, message, errorContext);
    this.outputLog(LOG_LEVELS.ERROR, logObject);
  }

  /**
   * Log database query performance metrics
   * Tracks slow queries and provides visibility into database performance
   * Includes query text and execution time for analysis
   *
   * Features:
   * - Logs all queries in development mode
   * - Logs slow queries (>100ms) in production
   * - Helps identify performance bottlenecks
   *
   * @param {string} query - The database query (typically MongoDB aggregation or query object)
   * @param {number} executionMs - Query execution time in milliseconds
   * @param {Object} [context] - Optional additional context
   *
   * @example
   * const startTime = performance.now();
   * const bookings = await bookingRepository.findByCustomerId(userId);
   * const executionTime = performance.now() - startTime;
   * loggerService.logQueryTime('bookingRepository.findByCustomerId', executionTime, {
   *   userId: userId,
   *   resultCount: bookings.length
   * });
   */
  logQueryTime(query, executionMs, context = {}) {
    // Determine if query should be logged based on environment
    const shouldLog = this.isDevelopment || executionMs > 100;

    if (!shouldLog) {
      return;
    }

    // Determine log level based on execution time
    let level = LOG_LEVELS.INFO;
    if (executionMs > 500) {
      level = LOG_LEVELS.WARN;
    }

    // Build query performance context
    const queryContext = {
      ...context,
      query,
      executionMs: `${executionMs.toFixed(2)}ms`,
      isSlowQuery: executionMs > 100,
    };

    const message = `Database query executed in ${executionMs.toFixed(2)}ms`;
    const logObject = this.buildLogObject(level, message, queryContext);
    this.outputLog(level, logObject);
  }

  /**
   * Log HTTP request details
   * Useful for request/response middleware to track API calls
   *
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - Request path
   * @param {number} statusCode - HTTP response status code
   * @param {number} responseTimeMs - Response time in milliseconds
   * @param {Object} [context] - Optional additional context (userId, etc.)
   *
   * @example
   * loggerService.logRequest('POST', '/bookings', 201, 45.32, {
   *   userId: 'user123',
   *   requestId: 'req_12345'
   * });
   */
  logRequest(method, path, statusCode, responseTimeMs, context = {}) {
    // Determine if request was successful based on status code
    const success = statusCode >= 200 && statusCode < 400;

    const requestContext = {
      ...context,
      method,
      path,
      statusCode,
      responseTimeMs: `${responseTimeMs.toFixed(2)}ms`,
    };

    const message = `[${method}] ${path} - ${statusCode} (${responseTimeMs.toFixed(2)}ms)`;
    const logObject = this.buildLogObject(
      success ? LOG_LEVELS.INFO : LOG_LEVELS.WARN,
      message,
      requestContext
    );
    this.outputLog(success ? LOG_LEVELS.INFO : LOG_LEVELS.WARN, logObject);
  }
}

/**
 * Export a singleton instance of LoggerService
 * Used throughout the application via dependency injection
 */
module.exports = new LoggerService();

