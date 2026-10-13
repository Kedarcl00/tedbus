/**
 * TedBus Backend Server
 * Express.js application with service-oriented architecture
 * Initializes MongoDB connection, middleware, routes, and error handling
 *
 * Architecture: Layered Service Architecture with clear separation of concerns
 * Middleware Order: CORS → Body Parser → Request Logger → Auth Middleware → Routes → Error Handler
 * Request Flow: Client Request → CORS → Body Parser → Request Logger → Auth Middleware → Route Handler → Controller → Service → Repository → Database
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

// ============================================================================
// SERVICE LAYER IMPORTS
// ============================================================================

const LoggerService = require('./services/logger.service');
const ErrorHandlerService = require('./services/error-handler.service');
const AuthService = require('./services/auth.service');
const CustomerService = require('./services/customer.service');
const BusService = require('./services/bus.service');
const RouteService = require('./services/route.service');
const BookingService = require('./services/booking.service');

// ============================================================================
// CONTROLLER LAYER IMPORTS
// ============================================================================

const AuthController = require('./controllers/auth.controller');
const CustomerController = require('./controllers/customer.controller');
const BookingController = require('./controllers/booking.controller');
const BusController = require('./controllers/bus.controller');
const RouteController = require('./controllers/route.controller');

// ============================================================================
// MIDDLEWARE LAYER IMPORTS
// ============================================================================

const createCorsMiddleware = require('./middleware/cors.middleware');
const createRequestLoggerMiddleware = require('./middleware/request-logger.middleware');
const createAuthMiddleware = require('./middleware/auth.middleware');
const createErrorHandlerMiddleware = require('./middleware/error-handler.middleware');

// ============================================================================
// ROUTE LAYER IMPORTS
// ============================================================================

const createAuthRoutes = require('./routes/auth.routes');
const createBookingRoutes = require('./routes/booking.routes');
const createCustomerRoutes = require('./routes/customer.routes');
const createBusRoutes = require('./routes/bus.routes');
const createRouteRoutes = require('./routes/route.routes');

// ============================================================================
// INITIALIZE EXPRESS APP
// ============================================================================

const app = express();

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

/**
 * Establish MongoDB connection
 * Logs connection success/failure and returns connection status
 * @returns {Promise<boolean>} True if connection successful, false otherwise
 */
async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tedbus';

    // Set connection timeout to 5 seconds
    const mongooseOptions = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    // Connect to MongoDB
    await mongoose.connect(mongoUri, mongooseOptions);

    LoggerService.info('MongoDB connected successfully');
    return true;
  } catch (error) {
    LoggerService.error('MongoDB connection failed', error);
    return false;
  }
}

// ============================================================================
// DEPENDENCY INJECTION & SERVICE INITIALIZATION
// ============================================================================

/**
 * Initialize all services with dependency injection
 * Services are instantiated in order of their dependencies:
 * 1. Infrastructure services: ErrorHandlerService, LoggerService
 * 2. Domain services: AuthService, CustomerService, BusService, RouteService
 * 3. Complex services: BookingService (depends on BusService, NotificationService)
 *
 * This pattern enables:
 * - Easy testing with mocks
 * - Loose coupling between services
 * - Clear dependency graph
 * - Single responsibility principle
 */

// Infrastructure services
const errorHandlerService = new ErrorHandlerService(LoggerService);

// Domain services - independent services
const customerService = new CustomerService(errorHandlerService);
const busService = new BusService(errorHandlerService);
const routeService = RouteService; // Already instantiated as singleton

// Auth service depends on CustomerService
const authService = new AuthService(customerService, errorHandlerService);

// Booking service depends on BusService
const bookingService = new BookingService(busService, errorHandlerService);

// ============================================================================
// CONTROLLER INITIALIZATION
// ============================================================================

/**
 * Initialize all controllers with dependency injection
 * Controllers are thin request handlers that delegate business logic to services
 * Controllers receive services and dependencies as constructor parameters
 */

const authController = new AuthController(
  authService,
  customerService,
  errorHandlerService
);

const customerController = new CustomerController(
  customerService,
  errorHandlerService
);

const bookingController = new BookingController(
  bookingService,
  errorHandlerService
);

const busController = new BusController(
  busService,
  errorHandlerService
);

const routeController = new RouteController(
  routeService,
  errorHandlerService
);

// ============================================================================
// MIDDLEWARE REGISTRATION - ORDER IS CRITICAL
// ============================================================================

/**
 * MIDDLEWARE ORDER EXPLANATION:
 *
 * 1. CORS Middleware (FIRST)
 *    - Must be first to handle preflight OPTIONS requests
 *    - Allows requests from whitelisted frontend origin
 *    - Enables credentials (cookies, auth headers)
 *
 * 2. Body Parser Middleware (SECOND)
 *    - Parses JSON request bodies
 *    - Must come after CORS to avoid parsing preflight requests
 *
 * 3. Request Logger Middleware (THIRD)
 *    - Logs all incoming requests with timing information
 *    - Helps with debugging and monitoring
 *    - Should execute early to capture full request lifecycle
 *
 * 4. Authentication Middleware (FOURTH)
 *    - Validates user authentication before controllers process request
 *    - Attaches authenticated userId to request.user.id
 *    - Skips public routes (/auth/login, /buses, /routes, etc.)
 *    - Throws AuthenticationError for protected routes without valid session
 *
 * 5. Route Handlers (FIFTH)
 *    - Express route matching and controller execution
 *    - Controllers delegate to services
 *    - May throw errors which are caught by error handler
 *
 * 6. Error Handler Middleware (LAST)
 *    - Catches all unhandled errors from controllers/services
 *    - Must be registered LAST with 4 parameters (err, req, res, next)
 *    - Formats errors into standardized response
 *    - Sends response to client
 */

// ① CORS Middleware - Allow cross-origin requests from frontend
app.use(createCorsMiddleware());

// ② Body Parser Middleware - Parse JSON and URL-encoded request bodies
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// ③ Request Logger Middleware - Log all incoming requests with response times
app.use(createRequestLoggerMiddleware(LoggerService));

// ④ Health Check Endpoint - Simple endpoint to verify server is running
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'TedBus backend is running',
    timestamp: new Date().toISOString(),
  });
});

// ⑤ Authentication Middleware - Validate session for protected routes
const authMiddleware = createAuthMiddleware(authService, errorHandlerService);

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

/**
 * Register all routes in order:
 * 1. Public routes first (no authentication required)
 * 2. Apply authentication middleware to subsequent routes
 * 3. Protected routes after auth middleware
 *
 * Public Routes:
 * - /auth/login, /auth/register - User authentication
 * - /buses, /routes - Bus and route catalog (read-only)
 * - /search - Bus search
 * - /health - Health check
 *
 * Protected Routes (require authentication):
 * - /bookings - User bookings (create, read, update, delete)
 * - /users/profile - User profile (read, update)
 * - All payment endpoints
 */

// ① PUBLIC ROUTES (no authentication required)
const authRoutes = createAuthRoutes(authController);
app.use('/auth', authRoutes);

// ② PUBLIC ROUTES - Bus and Routes (no authentication required)
const busRoutes = createBusRoutes(busController);
app.use('/buses', busRoutes);

const routeRoutes = createRouteRoutes(routeController);
app.use('/routes', routeRoutes);

// ③ AUTHENTICATION MIDDLEWARE - Apply to all subsequent routes
app.use(authMiddleware);

// ④ PROTECTED ROUTES (authentication required)
const bookingRoutes = createBookingRoutes(bookingController, authMiddleware);
app.use('/bookings', bookingRoutes);

const customerRoutes = createCustomerRoutes(customerController, authMiddleware);
app.use('/users', customerRoutes);

// ============================================================================
// 404 NOT FOUND HANDLER
// ============================================================================

/**
 * Catch requests to undefined endpoints
 * This middleware runs BEFORE error handler middleware to format 404 errors
 */
app.use((req, res, next) => {
  const { NotFoundError } = require('./utils/custom-errors');
  const notFoundError = new NotFoundError('Endpoint');
  next(notFoundError); // Pass to error handler middleware
});

// ============================================================================
// ERROR HANDLER MIDDLEWARE - MUST BE LAST
// ============================================================================

/**
 * CRITICAL: This middleware MUST be registered LAST, after all other middleware and routes.
 * Express recognizes error handlers by the 4-parameter signature: (err, req, res, next)
 *
 * The error handler:
 * 1. Receives errors thrown by controllers or services
 * 2. Logs error with full context using LoggerService
 * 3. Formats error using ErrorHandlerService
 * 4. Sends standardized error response to client
 *
 * Error Response Format:
 * {
 *   success: false,
 *   error: {
 *     code: "ERROR_CODE",
 *     message: "User-friendly message",
 *     statusCode: 400,
 *     details: { ... }
 *   }
 * }
 */
const errorHandlerMiddleware = createErrorHandlerMiddleware(
  errorHandlerService,
  LoggerService
);
app.use(errorHandlerMiddleware);

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 3001;

/**
 * Start the Express server
 * 1. Connects to MongoDB database
 * 2. Starts Express server listening on configured port
 * 3. Initializes middleware and routes
 * 4. Logs startup information
 * @async
 */
async function startServer() {
  try {
    // Connect to database
    const dbConnected = await connectDatabase();
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log(`✓ Server is running on http://localhost:${PORT}`);
      console.log(`✓ Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:4200'}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:4200'}`);
      console.log(`✓ Middleware Order: CORS → Body Parser → Request Logger → Auth → Routes → Error Handler`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

/**
 * Export Express app for testing and external use
 * The app is exported as the default module export
 * Tests can import the app and make requests to it without starting the server
 * Example: const request = require('supertest')(app);
 */

// Start the server only if this is the main module (not imported for testing)
if (require.main === module) {
  startServer();
}

module.exports = app;
