# Requirements Document

# TedBus Service-Oriented Architecture Refactoring

## Introduction

The TedBus application is a MEAN stack bus booking platform currently running with Angular 17.3.0 frontend and Express.js/MongoDB backend. The backend uses a mixed controller-based architecture with limited separation of concerns. This specification defines requirements for refactoring into a clean, service-oriented architecture that maintains all existing functionality while improving code organization, testability, and data security.

The refactoring focuses on:
1. Service-oriented backend with clear layer separation
2. User data isolation and security
3. Structured error handling
4. Authentication middleware for all protected endpoints
5. "Cash on Trip" payment option
6. Proper file organization for scalability

Out of scope: community forums, advanced notifications, Stripe/Razorpay payment gateway, Redis/Elasticsearch, admin panels, microservices architecture.

---

## Glossary

- **Service**: A self-contained module responsible for a specific business domain (e.g., BookingService, AuthService)
- **Controller**: HTTP request handler that delegates business logic to services
- **Middleware**: Express function that processes HTTP requests before they reach controllers
- **Repository**: Data access layer abstraction for database operations
- **DTO**: Data Transfer Object for standardized request/response formats
- **User Isolation**: Security requirement where users can only access their own data, enforced server-side
- **Acceptance Criteria**: Specific, testable conditions a requirement must satisfy
- **Idempotent Operation**: Operation that produces the same result when called multiple times
- **System**: The refactored TedBus application backend and frontend together
- **Session**: User authentication state stored in sessionStorage with key "Loggedinuser" containing {name, email, picture, id}

---

## Requirements

### Requirement 1: Service-Oriented Backend Architecture

**User Story:** As a developer, I want backend code organized into services with clear responsibilities, so that business logic is testable and reusable.

#### Acceptance Criteria

1. THE System backend SHALL organize code into layers: controllers (request handling) → services (business logic) → repositories (data access)
2. THE System SHALL create 6 core services: AuthService, CustomerService, BusService, BookingService, ErrorHandlerService, LoggerService
3. WHEN a service method is called, THE Service SHALL return the result or throw a structured error (not undefined/null)
4. WHERE business logic currently exists in controllers, THE System SHALL move it to services
5. THE System SHALL NOT duplicate service functionality; existing services SHALL be refactored, not replaced
6. WHEN a service depends on another service, THE Service SHALL be injectable to enable testing with mocks
7. WHEN a controller calls a service method, THE Controller SHALL receive either the expected result or catch a thrown error from the service

### Requirement 2: User Isolation and Data Security

**User Story:** As a customer, I want my bookings and profile to be protected so that other users cannot see or modify my data.

#### Acceptance Criteria

1. WHEN a user requests their bookings via GET /bookings, THE System backend SHALL filter by authenticated user ID server-side (not client-side)
2. WHEN a user tries to access another user's booking via GET /bookings/:id, THE System SHALL return 403 Forbidden
3. WHEN a user creates a booking, THE System SHALL automatically associate it with the authenticated user's ID from the request context
4. WHEN a user views their profile via GET /users/profile, THE System SHALL only return their own profile data
5. WHEN a user updates their profile via PUT /users/profile, THE System SHALL only allow updates to their own profile
6. WHEN a different user attempts to view or modify another user's profile, THE System SHALL return 403 Forbidden
7. THE System backend controllers SHALL attach the authenticated user ID to the request object after authentication middleware validates it

### Requirement 3: Structured Error Handling

**User Story:** As a frontend developer, I want consistent error responses so I can display appropriate messages to users.

#### Acceptance Criteria

1. THE System backend SHALL return all errors in format: {success: false, error: {code, message, statusCode}}
2. WHEN validation fails, THE System SHALL return HTTP 400 Bad Request with code "VALIDATION_ERROR" and field-specific details
3. WHEN user is not authenticated, THE System SHALL return HTTP 401 Unauthorized with code "UNAUTHORIZED" and message "Authentication required"
4. WHEN user lacks permissions, THE System SHALL return HTTP 403 Forbidden with code "FORBIDDEN" and message "Insufficient permissions"
5. WHEN resource is not found, THE System SHALL return HTTP 404 Not Found with code "NOT_FOUND" and message "Resource not found"
6. WHEN unexpected error occurs, THE System SHALL log full error internally and return HTTP 500 with generic message to client "An unexpected error occurred"
7. THE ErrorHandlerService SHALL be the single point for error response formatting across all controllers

### Requirement 4: Authentication Middleware

**User Story:** As an architect, I want all backend endpoints to validate authentication and user identity, so that only authorized requests are processed.

#### Acceptance Criteria

1. THE System SHALL add authentication middleware that validates incoming requests before they reach controllers
2. WHEN a request includes a Google user ID in the session, THE System SHALL validate it matches the authenticated user
3. WHERE a route requires authentication, THE System SHALL return 401 Unauthorized if user is not authenticated
4. WHEN a request is validated, THE System SHALL attach user ID to request.user for use by controllers and services
5. THE System SHALL apply authentication middleware to all protected routes: /bookings, /users/profile, payment endpoints
6. THE System public endpoints (GET /buses, GET /routes, POST /auth/login, POST /auth/register) SHALL NOT require authentication middleware

### Requirement 5: "Cash on Trip" Payment Option

**User Story:** As a customer, I want to pay for my bus ticket when I board the bus, so I don't need to pay upfront online.

#### Acceptance Criteria

1. WHEN booking confirmation page is displayed, THE System SHALL show "Cash on Trip" as a payment option alongside other methods
2. WHEN customer selects "Cash on Trip", THE System SHALL hide payment method details (card fields, etc.)
3. WHEN customer submits "Cash on Trip" booking, THE System SHALL create the booking with paymentMethod: "cash_on_trip" and status: "confirmed"
4. WHEN booking is created with "Cash on Trip", THE System SHALL NOT process any payment transaction
5. WHEN booking is created successfully, THE System SHALL display confirmation message "Trip booked successfully!" with booking reference
6. WHEN user views their profile bookings, THE System SHALL show bookings with "Cash on Trip" status label indicating payment pending at trip

### Requirement 6: User-Specific Booking Retrieval

**User Story:** As a customer, I want to see only my bookings on my profile page, without loading all bookings from the database.

#### Acceptance Criteria

1. WHEN a user requests bookings via GET /bookings/my, THE System backend SHALL return only bookings created by that authenticated user
2. THE System SHALL order bookings by travel date in descending order (upcoming trips first)
3. THE System SHALL include in each booking: bus details, route (source/destination), seats, passenger info, fare, status, booking date
4. WHEN user has no bookings, THE System SHALL return empty array with HTTP 200 OK (not an error)
5. WHEN user requests bookings of another user, THE System SHALL return 403 Forbidden
6. THE BookingService.getBookingsByCustomer() method SHALL query repository with customerId filter and return results

### Requirement 7: Backend File Structure Organization

**User Story:** As a new developer, I want clear directory organization so I can quickly find where to add new features.

#### Acceptance Criteria

1. THE System backend SHALL organize files as:
   - `src/services/` — business logic (auth.service.js, booking.service.js, bus.service.js, customer.service.js, error-handler.service.js, logger.service.js)
   - `src/controllers/` — thin request handlers (booking.controller.js, customer.controller.js, bus.controller.js, auth.controller.js, route.controller.js)
   - `src/routes/` — route definitions (index.js, auth.routes.js, booking.routes.js, customer.routes.js, bus.routes.js, route.routes.js)
   - `src/models/` — Mongoose schemas (User.js, Bus.js, Route.js, Booking.js, Community.js, Review.js)
   - `src/middleware/` — Express middleware (auth.middleware.js, error-handler.middleware.js, request-logger.middleware.js)
   - `src/utils/` — error classes, validators, helpers (custom-errors.js, validators.js, constants.js)
   - `src/config/` — configuration (database.js, constants.js, environment variables)
2. THE System backend SHALL use consistent naming: camelCase for files, PascalCase for classes
3. WHEN importing services in controllers, THE System SHALL use relative paths: `../services/booking.service.js`
4. THE System backend SHALL NOT have circular dependencies between services

### Requirement 8: Basic API Testing

**User Story:** As a QA engineer, I want to verify the API works end-to-end without spending weeks setting up test infrastructure.

#### Acceptance Criteria

1. WHEN backend starts, THE System SHALL connect to MongoDB and log "MongoDB connected successfully"
2. WHEN frontend calls API, THE System SHALL respond with proper HTTP status codes (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Internal Server Error)
3. WHEN user authenticates with Google ID, THE System SHALL store/validate authentication state in session
4. WHEN booking is created, THE System SHALL save it to database and return booking object with generated ID
5. WHEN user requests their bookings via GET /bookings/my, THE System SHALL return only their bookings, not other users' bookings
6. THE System backend database queries SHALL not throw connection errors or timeout errors during normal operation

---

## Non-Functional Requirements

- **Performance**: Backend APIs SHALL respond within 500ms for 95% of requests
- **Availability**: MongoDB connection errors SHALL be logged and retried automatically
- **Security**: User IDs and authentication SHALL be validated server-side on every protected request
- **Maintainability**: New developers SHALL be able to add a new service following the existing file structure pattern in under 1 hour

---

## Data Model Changes

### Booking Model
- Add `paymentMethod` field with values: "cash_on_trip" | "online" | others
- Existing fields preserved: customerId, busId, routeId, seats, fare, status, departureDetails, etc.

### Other Models
- No breaking changes required
- Community model kept for future use but not actively used in this refactoring

