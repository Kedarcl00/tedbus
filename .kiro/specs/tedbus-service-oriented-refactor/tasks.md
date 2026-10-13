# Implementation Plan: TedBus Service-Oriented Architecture Refactor

## Overview

This implementation plan converts the TedBus MEAN stack application from a mixed controller-based architecture into a clean, service-oriented architecture with clear layer separation. The refactoring maintains all existing functionality while improving testability, maintainability, and data security through proper service organization, authentication enforcement, and user isolation.

The plan is organized into five implementation phases:
1. **Foundation**: Project structure, custom error classes, and base utilities
2. **Core Services**: AuthService, CustomerService, BusService, BookingService, SearchService
3. **Middleware & Controllers**: Request handling layer with proper error and authentication
4. **Data Layer**: Mongoose models and repository pattern
5. **Integration & Frontend**: Wire services together and update frontend

---

## Phase 1: Foundation Setup

- [x] 1. Set up project structure and create core directories
  - Create `src/services/`, `src/controllers/`, `src/middleware/`, `src/models/`, `src/repositories/`, `src/utils/`, `src/config/`, `src/dtos/` directories
  - Create `.gitignore` to exclude node_modules, .env, logs
  - Set up environment configuration file with MongoDB connection string and API port
  - _Requirements: 7.1, 7.2_

- [x] 2. Create custom error classes
  - Implement `src/utils/custom-errors.js` with error hierarchy: ServiceError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, BusinessRuleError
  - Add error code constants for consistent categorization
  - Include stack trace capture and error context
  - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [x] 3. Create ErrorHandlerService
  - Implement `src/services/error-handler.service.js` with methods: formatError(), categorizeError(), transformServiceError(), logError(), createError()
  - Implement standard error response format: `{success: false, error: {code, message, statusCode, details}}`
  - Add mapping from error types to HTTP status codes and error codes
  - Add context-aware error logging
  - _Requirements: 3.1, 3.6, 3.7_

- [x] 4. Create LoggerService
  - Implement `src/services/logger.service.js` with methods: info(), error(), warn(), debug(), logQueryTime()
  - Include timestamp and context fields in log output
  - Add separate logging for development vs. production environments
  - _Requirements: 7.1_

- [x] 5. Create validation utilities
  - Implement `src/utils/validators.js` with validation functions: validateEmail(), validateBookingData(), validateUserData(), validateSeatNumbers()
  - Return structured validation errors with field-specific details
  - _Requirements: 3.2_

- [ ] 6. Create data transfer object (DTO) interfaces
  - Create `src/dtos/` directory with DTO files: booking.dto.js, user.dto.js, bus.dto.js, search.dto.js
  - Define DTOs for request/response standardization
  - _Requirements: 7.1_

---

## Phase 2: Core Services

- [x] 1. Create AuthService
  - Implement `src/services/auth.service.js` with methods: authenticateGoogleUser(), validateSession(), getAuthenticatedUserId(), verifyUserAccess()
  - Implement session validation using Google ID from request context
  - Implement user isolation checks (userId vs resourceOwnerId comparison)
  - Throw appropriate errors: AuthenticationError, AuthorizationError
  - _Requirements: 1.3, 2.1, 2.2, 2.7, 4.1, 4.2_

- [x] 2. Create CustomerService (User management)
  - Implement `src/services/customer.service.js` with methods: getProfile(), updateProfile(), getPreferences(), registerCustomer(), emailExists()
  - Enforce user isolation: check userId matches profile owner before returning/updating
  - Validate profile update data and throw ValidationError on invalid input
  - Throw NotFoundError if user not found, ConflictError if email already registered
  - _Requirements: 1.3, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 3. Create BusService
  - Implement `src/services/bus.service.js` with methods: searchBuses(), getBusById(), checkAvailability(), reserveSeats(), releaseSeats()
  - Implement seat availability calculation: total_seats - booked_seats
  - Implement atomic seat reservation to prevent double-booking
  - Implement seat release on cancellation
  - Throw NotFoundError, BusinessRuleError for insufficient seats
  - _Requirements: 1.3, 6.2_

- [x] 4. Create BookingService
  - Implement `src/services/booking.service.js` with methods: createBooking(), getBookingsByCustomer(), getBookingById(), cancelBooking(), updateBookingStatus(), validateBookingData()
  - Enforce user isolation: verify userId matches booking.customerId before returning/updating
  - Implement booking state transitions: pending → confirmed → in_progress → completed
  - Implement cancellation with refund calculation
  - Call BusService for seat reservation and release
  - Call NotificationService for sending confirmations
  - Throw ForbiddenError, ValidationError, BusinessRuleError, NotFoundError appropriately
  - _Requirements: 1.3, 2.1, 2.2, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.6_

- [ ] 5. Create SearchService
  - Implement `src/services/search.service.js` with methods: search(), applyFilters(), sortResults(), getPopularRoutes(), invalidateSearchCache()
  - Implement cache key generation: `search:{route_id}:{date}:{bus_type}`
  - Implement in-memory caching (simple Map or prepare for Redis integration)
  - Implement filter logic: busType, priceRange, departureTime
  - Implement sort logic: price (asc/desc), departure time (asc/desc), duration (asc/desc)
  - Implement cache invalidation on new bookings
  - _Requirements: 1.3, 6.1_

- [ ] 6. Create NotificationService
  - Implement `src/services/notification.service.js` with methods: sendBookingConfirmation(), sendCancellationNotification(), sendReminderNotification(), queueNotification(), getUserNotifications()
  - Implement email sending (log to console in development, mock SMTP in production)
  - Implement in-app notification storage and retrieval
  - Handle failures gracefully: log errors but don't fail the request
  - _Requirements: 5.3, 5.5_

- [ ] 7. Create SearchNotificationService (optional infrastructure service)
  - Implement `src/services/search-notification.service.js` for coordinating search cache invalidation
  - Subscribe to booking events and trigger cache invalidation
  - _Requirements: 1.3_

---

## Phase 3: Middleware Layer

- [x] 1. Create Authentication Middleware
  - Implement `src/middleware/auth.middleware.js` to validate incoming requests
  - Extract Google user ID from session (sessionStorage) or headers (X-User-Id)
  - Call AuthService.validateSession() to verify user exists and is valid
  - Attach authenticated userId to request.user.id for use by controllers
  - Define public routes list: /auth/login, /auth/register, /buses, /routes, /search
  - Skip authentication for public routes, validate for protected routes
  - Return 401 Unauthorized if authentication fails
  - _Requirements: 2.1, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 2. Create Error Handler Middleware
  - Implement `src/middleware/error-handler.middleware.js` to catch unhandled errors
  - Call ErrorHandlerService.formatError() to format the error response
  - Return standardized error response with proper HTTP status code
  - Log error using LoggerService before sending response
  - _Requirements: 3.1, 3.6_

- [ ] 3. Create Request Logger Middleware
  - Implement `src/middleware/request-logger.middleware.js` to log all incoming requests
  - Log request details: method, path, user ID (if authenticated), query parameters
  - Record request start time and end time
  - Calculate response time and log it
  - _Requirements: 7.1_

- [x] 4. Create CORS Middleware Configuration
  - Configure Express CORS to allow requests from frontend origin
  - Allow credentials (cookies, authorization headers)
  - Set allowed headers and methods
  - _Requirements: 7.1_

---

## Phase 4: Controllers Layer

- [x] 1. Create AuthController
  - Implement `src/controllers/auth.controller.js` with methods: login(), register(), logout(), getCurrentUser()
  - Call AuthService.authenticateGoogleUser() in login()
  - Call CustomerService.registerCustomer() if new user
  - Validate user data and throw ValidationError if invalid
  - Return user object on successful login
  - _Requirements: 1.7, 4.1, 4.2_

- [x] 2. Create BookingController
  - Implement `src/controllers/booking.controller.js` with methods: createBooking(), getBookingsByCustomer(), getBookingById(), cancelBooking(), updateBookingStatus()
  - Extract userId from request.user.id (set by auth middleware)
  - Call BookingService methods with userId parameter
  - Validate request body against BookingDTO schema
  - Return appropriate HTTP status codes: 201 Created, 200 OK, 400 Bad Request, 403 Forbidden, 404 Not Found
  - _Requirements: 1.7, 2.1, 2.2, 5.1, 5.5, 6.1, 6.6_

- [x] 3. Create CustomerController
  - Implement `src/controllers/customer.controller.js` with methods: getProfile(), updateProfile(), getPreferences()
  - Extract userId from request.user.id
  - Call CustomerService methods with userId parameter
  - Validate request body for profile updates
  - _Requirements: 1.7, 2.3, 2.4, 2.5, 2.6_

- [x] 4. Create BusController
  - Implement `src/controllers/bus.controller.js` with methods: searchBuses(), getBusById(), checkAvailability()
  - Call SearchService.search() for search queries
  - Apply filters and sorting from request query parameters
  - Return bus list with availability information
  - No authentication required for read operations
  - _Requirements: 1.7_

- [x] 5. Create RouteController
  - Implement `src/controllers/route.controller.js` with methods: getRoutes(), getRouteById()
  - Return route list with source, destination, duration, distance
  - No authentication required
  - _Requirements: 1.7_

---

## Phase 5: Data Layer

- [x] 1. Create Mongoose Models
  - Implement `src/models/User.js` with fields: googleId, name, email, picture, preferences, createdAt
  - Implement `src/models/Bus.js` with fields: operatorName, busType, totalSeats, registrationNumber, amenities
  - Implement `src/models/Route.js` with fields: source, destination, distance, duration
  - Implement `src/models/Booking.js` with fields: customerId, busId, routeId, seats, passengers, fare, status, paymentMethod, paymentStatus, departureDate, createdAt
  - Add unique index on email in User model
  - Add compound index on (customerId, createdAt) in Booking model for efficient user booking retrieval
  - _Requirements: 1.2, 5.4_

- [ ] 2. Create Repository Layer
  - Implement `src/repositories/user.repository.js` with methods: findById(), findByEmail(), findByGoogleId(), create(), update()
  - Implement `src/repositories/booking.repository.js` with methods: create(), findById(), findByCustomerId(), updateStatus(), delete()
  - Implement `src/repositories/bus.repository.js` with methods: findById(), find(), findByRoute()
  - Implement `src/repositories/route.repository.js` with methods: findById(), find()
  - Implement `src/repositories/notification.repository.js` with methods: create(), findByUserId(), markAsRead()
  - Each repository method returns data from database or throws NotFoundError if not found
  - _Requirements: 1.2_

- [x] 3. Set up database connection and initialization
  - Implement `src/config/database.js` to connect to MongoDB on application start
  - Load connection string from environment variables
  - Log "MongoDB connected successfully" on connection
  - Implement error handling and automatic retry on connection failure
  - Implement model exports and schema validation
  - _Requirements: 8.1_

- [ ] 4. Create database seed script (optional for development)
  - Create `scripts/seed-data.js` to populate initial bus, route, and user data
  - Useful for local development and testing
  - _Requirements: 8.6_

---

## Phase 6: Middleware Integration

- [x] 1. Register middleware in Express application
  - Implement `src/server.js` or modify existing server file to register all middleware in correct order
  - Order: CORS → Body Parser → Request Logger → Authentication → Routes → Error Handler
  - Initialize services with dependency injection
  - Export Express app for testing
  - _Requirements: 1.1, 4.1, 4.2_

- [x] 2. Set up route definitions
  - Create `src/routes/auth.routes.js`: POST /auth/login, POST /auth/register, GET /auth/current-user
  - Create `src/routes/booking.routes.js`: POST /bookings, GET /bookings/my, GET /bookings/:id, DELETE /bookings/:id, PUT /bookings/:id/status
  - Create `src/routes/customer.routes.js`: GET /users/profile, PUT /users/profile, GET /users/preferences
  - Create `src/routes/bus.routes.js`: GET /buses, GET /buses/:id, GET /buses/search
  - Create `src/routes/route.routes.js`: GET /routes, GET /routes/:id
  - Mount routes in main server file
  - _Requirements: 1.1, 4.5, 4.6_

- [ ] 3. Implement response wrapper utility
  - Create `src/utils/response.js` with formatSuccessResponse() and formatErrorResponse() functions
  - Standardize all successful API responses: `{success: true, data: {...}, message: "..."}`
  - Use ErrorHandlerService for error responses
  - _Requirements: 3.1_

---

## Phase 7: Frontend Integration

- [x] 1. Create/Update authentication service
  - Create `src/app/services/auth.service.ts` or update existing auth service
  - Implement methods: login(), logout(), getCurrentUser(), isAuthenticated()
  - Store user data in sessionStorage with key "Loggedinuser"
  - Store Google ID in sessionStorage for header injection
  - _Requirements: 2.1, 4.2, 4.4_

- [x] 2. Create/Update HTTP interceptor for authentication
  - Create `src/app/interceptors/auth.interceptor.ts` or update existing
  - Inject Google ID or session token in every request header (X-User-Id)
  - Handle 401 responses by redirecting to login
  - Handle 403 responses by showing "Access Denied" message
  - _Requirements: 4.2, 4.4_

- [x] 3. Update BookingService in frontend
  - Create `src/app/services/booking.service.ts` or update existing
  - Implement methods: searchBuses(), createBooking(), getMyBookings(), getBookingDetails(), cancelBooking()
  - Call backend APIs: GET /buses/search, POST /bookings, GET /bookings/my, GET /bookings/:id, DELETE /bookings/:id
  - Handle API errors using ErrorHandlerService
  - _Requirements: 5.1, 5.2, 5.3, 6.1_

- [x] 4. Update booking component to show "Cash on Trip" option
  - Update booking confirmation component
  - Add payment method selector: radio buttons or dropdown with "Online" and "Cash on Trip" options
  - Show/hide payment form fields based on selection
  - Display "Pay driver when boarding" message for "Cash on Trip"
  - Submit booking with selected paymentMethod
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 5. Update user profile component
  - Update profile display to show user isolation
  - Add GET /users/profile API call to fetch current user profile
  - Validate profile belongs to authenticated user before displaying
  - _Requirements: 2.3, 2.4_

- [x] 6. Update my-bookings component
  - Update component to display only user's bookings from GET /bookings/my API
  - Display payment method: "Online" or "Cash on Trip"
  - Display payment status if applicable
  - Add cancel booking button with confirmation dialog
  - _Requirements: 5.1, 6.1_

---

## Phase 8: Testing & Validation

- [ ] 1. Create unit tests for services
  - Create `tests/unit/services/` directory
  - Write tests for AuthService: validateSession(), getAuthenticatedUserId(), verifyUserAccess()
  - Write tests for BookingService: validateBookingData(), getBookingsByCustomer() with user isolation
  - Write tests for CustomerService: getProfile() with user isolation, updateProfile() permission checks
  - Write tests for BusService: checkAvailability(), reserveSeats(), releaseSeats()
  - Mock repository layer and other service dependencies
  - _Requirements: 8.2, 8.3_

- [ ] 2. Create integration tests for API endpoints
  - Create `tests/integration/` directory
  - Write tests for booking flow: POST /bookings → GET /bookings/my → DELETE /bookings/:id
  - Write tests for authentication: POST /auth/login with valid/invalid credentials
  - Write tests for user isolation: verify GET /bookings/my only returns user's bookings, not other users'
  - Write tests for "Cash on Trip": verify paymentMethod is stored in booking
  - Use test database fixtures for setup/teardown
  - _Requirements: 8.2, 8.3, 8.5, 8.6_

- [ ] 3. Create E2E test for complete booking flow
  - Write test: User logs in → searches buses → creates booking with "Cash on Trip" → views booking in profile → cancels booking
  - Verify user isolation: verify user can only see own bookings, not other users'
  - Verify error handling: test invalid inputs, unauthorized access, not found errors
  - _Requirements: 8.2, 8.3, 8.5_

- [ ] 4. Test error handling
  - Write tests for ValidationError scenarios: invalid booking data, missing fields
  - Write tests for AuthenticationError: missing or invalid session
  - Write tests for AuthorizationError: user accessing another user's booking
  - Write tests for NotFoundError: booking/user/bus not found
  - Verify error responses follow standard format
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5. Test user isolation enforcement
  - Write test: User A creates booking → User B attempts to GET /bookings/:id (from User A)
  - Verify User B receives 403 Forbidden (not 404 which would leak existence)
  - Write test: User A requests GET /bookings/my → verify only User A's bookings returned
  - Write test: User A attempts PUT /users/profile/:userId (User B's ID) → verify 403 Forbidden
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 6. Verify MongoDB connectivity and queries
  - Test database connection on application startup
  - Test basic CRUD operations for each model
  - Test compound indexes for booking retrieval performance
  - Verify no N+1 query problems in booking retrieval
  - _Requirements: 8.1, 8.6_

---

## Phase 9: Performance & Security Hardening

- [ ] 1. Add input validation and sanitization
  - Validate all request inputs before processing
  - Sanitize strings to prevent injection attacks
  - Validate email format, seat numbers, fare amounts
  - _Requirements: 3.2, 5.1_

- [ ] 2. Add rate limiting (optional)
  - Implement basic rate limiting for authentication endpoints
  - Limit login attempts to prevent brute force
  - _Requirements: Non-functional requirement_

- [ ] 3. Add request timeout handling
  - Set timeouts for long-running operations
  - Gracefully handle timeout errors
  - _Requirements: Non-functional requirement_

- [ ] 4. Verify response time performance
  - Benchmark API response times
  - Verify 95% of requests respond within 500ms
  - Identify and optimize slow queries
  - _Requirements: Non-functional requirement_

---

## Phase 10: Documentation & Cleanup

- [ ] 1. Create API documentation
  - Document all endpoints: method, path, authentication required, request/response format
  - Include example requests and responses for each endpoint
  - Document error responses and status codes
  - Document pagination for list endpoints (if applicable)
  - _Requirements: 7.1_

- [ ] 2. Create service documentation
  - Document each service's responsibility and public methods
  - Include service dependencies and injection patterns
  - Create architecture diagram in README
  - _Requirements: 7.1_

- [ ] 3. Update README and deployment guide
  - Update project README with new architecture overview
  - Document how to set up development environment
  - Document how to run tests
  - Document deployment steps
  - _Requirements: 7.1_

- [ ] 4. Code cleanup and review
  - Review all services for consistency and adherence to patterns
  - Remove any dead code or commented-out code
  - Verify no circular dependencies between modules
  - _Requirements: 7.1_

- [ ] 5. Final checkpoint - Ensure all tests pass and system works end-to-end
  - Run all unit tests
  - Run all integration tests
  - Run E2E test for complete booking flow
  - Verify frontend components work with updated APIs
  - Verify no console errors or warnings
  - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6_

---

## Notes

- **Dependency Injection Pattern**: Services should accept their dependencies as constructor parameters, not directly instantiate other services. This enables easy testing with mocks.
- **User Isolation Critical**: Every single service method that retrieves user-specific data MUST verify that the userId matches the authenticated user. Never trust client-provided IDs.
- **Error Handling Pattern**: Services throw structured errors (ValidationError, NotFoundError, etc.). Controllers catch these and let ErrorHandlerMiddleware format responses.
- **Asynchronous Operations**: All service methods return Promises. Controllers should use async/await and wrap in try/catch.
- **Testing**: Each phase should include unit tests for the services/components created. Integration tests should verify layer interactions.
- **Database Indexes**: Add indexes on frequently queried fields (email, customerId, busId) for performance.
- **Caching Strategy**: Cache search results for 5 minutes. Invalidate cache when new bookings are created or buses are modified.
- **Backward Compatibility**: Ensure existing frontend code continues to work. Update it incrementally as new APIs are implemented.
- **Frontend sessionStorage**: User authentication is stored in sessionStorage with key "Loggedinuser" containing {name, email, picture, id, googleId}.

---

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": [
        "1.1",
        "1.2",
        "1.5",
        "1.6"
      ],
      "description": "Foundation: Create project structure, error classes, validators, DTOs"
    },
    {
      "id": 1,
      "tasks": [
        "1.3",
        "1.4"
      ],
      "description": "Core utilities: ErrorHandlerService, LoggerService"
    },
    {
      "id": 2,
      "tasks": [
        "2.1",
        "2.2",
        "2.3"
      ],
      "description": "Core services: Auth, Customer, Bus (no dependencies on each other)"
    },
    {
      "id": 3,
      "tasks": [
        "2.4",
        "2.5"
      ],
      "description": "Complex services: Booking (depends on BusService), Search"
    },
    {
      "id": 4,
      "tasks": [
        "2.6"
      ],
      "description": "Notification service"
    },
    {
      "id": 5,
      "tasks": [
        "3.1",
        "3.2",
        "3.3",
        "3.4"
      ],
      "description": "Middleware: Auth, Error Handler, Logger, CORS"
    },
    {
      "id": 6,
      "tasks": [
        "4.1",
        "4.2",
        "4.3",
        "4.4",
        "4.5"
      ],
      "description": "Controllers: Auth, Booking, Customer, Bus, Route"
    },
    {
      "id": 7,
      "tasks": [
        "5.1",
        "5.2",
        "5.3"
      ],
      "description": "Data layer: Models, Repositories, Database config"
    },
    {
      "id": 8,
      "tasks": [
        "6.1",
        "6.2"
      ],
      "description": "Middleware integration and route setup"
    },
    {
      "id": 9,
      "tasks": [
        "7.1",
        "7.2",
        "7.3",
        "7.4",
        "7.5",
        "7.6"
      ],
      "description": "Frontend: Auth service, interceptor, booking service, components"
    },
    {
      "id": 10,
      "tasks": [
        "8.1",
        "8.2",
        "8.3",
        "8.4",
        "8.5",
        "8.6"
      ],
      "description": "Testing: Unit tests, integration tests, E2E tests, error handling, isolation, database"
    },
    {
      "id": 11,
      "tasks": [
        "9.1",
        "9.2",
        "9.3",
        "9.4"
      ],
      "description": "Performance & Security: Input validation, rate limiting, timeouts, benchmarking"
    },
    {
      "id": 12,
      "tasks": [
        "10.1",
        "10.2",
        "10.3",
        "10.4",
        "10.5"
      ],
      "description": "Documentation & Cleanup: API docs, service docs, README, code review, final testing"
    }
  ]
}
```

---

## Implementation Phases Summary

| Phase | Tasks | Focus | Deliverables |
|-------|-------|-------|--------------|
| **1** | 1.1 - 1.6 | Foundation | Project structure, error classes, utilities |
| **2** | 2.1 - 2.7 | Core Services | 6 domain services, dependency injection ready |
| **3** | 3.1 - 3.4 | Middleware | Request validation, error handling, logging |
| **4** | 4.1 - 4.5 | Controllers | 5 thin request handlers |
| **5** | 5.1 - 5.4 | Data Layer | Mongoose models, repositories, DB connection |
| **6** | 6.1 - 6.2 | Integration | Middleware registration, routes setup |
| **7** | 7.1 - 7.6 | Frontend | Updated services, components, interceptors |
| **8** | 8.1 - 8.6 | Testing | Unit, integration, E2E tests, security validation |
| **9** | 9.1 - 9.4 | Hardening | Input validation, rate limiting, performance |
| **10** | 10.1 - 10.5 | Documentation | API docs, architecture, README, final testing |

---

## Estimated Effort

- **Foundation (Phase 1-2)**: ~16-20 hours (core utilities, services)
- **Request Handling (Phase 3-4)**: ~12-16 hours (middleware, controllers)
- **Data Layer (Phase 5)**: ~8-10 hours (models, repositories)
- **Integration (Phase 6-7)**: ~12-16 hours (wiring, frontend)
- **Testing (Phase 8)**: ~16-20 hours (comprehensive test suite)
- **Hardening (Phase 9)**: ~4-6 hours (performance, security)
- **Documentation (Phase 10)**: ~6-8 hours (docs, README, cleanup)

**Total Estimated Effort**: ~80-100 hours (2-2.5 weeks for one developer)

---

## Success Criteria

✅ All services implemented with clean separation of concerns  
✅ All controllers are thin (delegate to services)  
✅ User isolation enforced on all user-specific data endpoints  
✅ All errors follow standardized format with proper HTTP status codes  
✅ Authentication middleware validates all protected endpoints  
✅ "Cash on Trip" payment option works end-to-end  
✅ Frontend updated to use new services and display payment options  
✅ All tests pass (unit, integration, E2E)  
✅ No circular dependencies between modules  
✅ API response times within 500ms for 95% of requests  
✅ API documentation complete and accurate  
