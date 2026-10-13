/**
 * Request Logger Middleware
 * Logs incoming HTTP requests and their response times
 * Provides visibility into request patterns and performance metrics
 *
 * Logs:
 * - HTTP method and endpoint path
 * - Authenticated user ID (if available)
 * - Query parameters and payload (payload logging is optional for security)
 * - Response status code
 * - Response time in milliseconds
 * - Error status indicators
 *
 * Flow:
 * 1. Record request start time
 * 2. Log incoming request details
 * 3. Execute request through middleware chain
 * 4. Calculate elapsed time
 * 5. Log response details with timing
 */

/**
 * Create request logger middleware
 * Logs all requests and their response times for monitoring
 *
 * @param {LoggerService} loggerService - Injected LoggerService for logging
 * @returns {Function} Express middleware function
 *
 * @example
 * const requestLoggerMiddleware = createRequestLoggerMiddleware(loggerService);
 * app.use(requestLoggerMiddleware);
 */
function createRequestLoggerMiddleware(loggerService) {
  // Validate dependency
  if (!loggerService) {
    throw new Error('LoggerService is required for request logger middleware');
  }

  /**
   * Middleware function that logs request and response details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  return (req, res, next) => {
    // Record the start time of the request
    const startTime = Date.now();

    // Build context information
    const requestContext = {
      userId: req.user?.id || null,
      method: req.method,
      endpoint: req.path,
      query: req.query && Object.keys(req.query).length > 0 ? req.query : null,
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString(),
    };

    // Log incoming request
    loggerService.debug(
      `→ ${req.method} ${req.path}`,
      requestContext
    );

    // Intercept the response's send method to capture response details
    // This allows us to log response status and timing
    const originalSend = res.send;
    res.send = function (data) {
      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Build response context
      const responseContext = {
        ...requestContext,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      };

      // Log response with timing
      const logLevel = res.statusCode >= 400 ? 'warn' : 'debug';
      loggerService[logLevel](
        `← ${req.method} ${req.path} ${res.statusCode} (${responseTime}ms)`,
        responseContext
      );

      // Call the original send method
      return originalSend.call(this, data);
    };

    // Proceed to next middleware
    next();
  };
}

module.exports = createRequestLoggerMiddleware;
