/**
 * CORS (Cross-Origin Resource Sharing) Middleware
 * 
 * Purpose: Configure Express CORS to allow requests from frontend origin
 * with proper credentials and header handling.
 * 
 * Security Considerations:
 * - Origin is whitelisted to frontend URL (prevents unauthorized cross-origin requests)
 * - Credentials allowed for authenticated requests (cookies, authorization headers)
 * - Only necessary headers are whitelisted to prevent abuse
 * - Preflight requests (OPTIONS) are automatically handled by cors middleware
 */

const cors = require('cors');

/**
 * Create CORS middleware with configuration
 * 
 * Configuration Details:
 * - origin: Specifies which origins can access the API
 *   - Development: http://localhost:4200 (default)
 *   - Production: Set via FRONTEND_URL environment variable
 * - credentials: Enables sending cookies and auth headers with requests
 * - methods: HTTP verbs allowed in requests
 * - allowedHeaders: Headers that can be included in requests
 *   - Content-Type: For JSON request bodies
 *   - Authorization: For bearer tokens and auth schemes
 *   - X-Google-ID: For Google user ID authentication (custom header)
 * 
 * @returns {Function} Express middleware function
 */
function createCorsMiddleware() {
  const corsOptions = {
    // Allow requests from specified frontend origin
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    
    // Allow credentials (cookies, authorization headers) to be sent with requests
    credentials: true,
    
    // HTTP methods allowed in requests
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    
    // Headers that are allowed in requests
    allowedHeaders: [
      'Content-Type',           // For JSON request bodies
      'Authorization',          // For bearer tokens and OAuth
      'X-Google-ID',           // Custom header for Google user ID
    ],
    
    // Headers that can be exposed to the client (optional)
    exposedHeaders: [
      'Content-Type',
      'X-Total-Count',         // For pagination
      'X-Request-ID',          // For request tracking
    ],
    
    // Cache preflight requests for 24 hours
    maxAge: 86400,
  };

  return cors(corsOptions);
}

module.exports = createCorsMiddleware;
