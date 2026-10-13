# TedBus Service-Oriented Architecture Refactor - Design Document

## Overview

This design document outlines the technical architecture and implementation approach for refactoring the TedBus MEAN stack application from a mixed controller-based architecture into a clean, service-oriented architecture. The refactoring maintains all existing functionality while improving code organization, testability, maintainability, and data security through proper layer separation and authentication enforcement.

The design translates business requirements into architectural patterns, service interfaces, and data flow processes that guide implementation without prescribing technology choices where alternatives are viable.

---

## Architecture

### Layered Service Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         EXPRESS MIDDLEWARE                       │
│  CORS │ Body Parser │ Auth Middleware │ Error Handler Middleware│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       CONTROLLER LAYER                           │
│  AuthController │ BookingController │ CustomerController │       │
│  BusController  │  RouteController  │  NotificationCtrl  │       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER (DOMAIN LOGIC)               │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Core Services (Business Logic)                              │ │
│ │ - AuthService (authentication, session validation)          │ │
│ │ - BookingService (booking CRUD, state management)           │ │
│ │ - CustomerService (user profile, preferences)               │ │
│ │ - BusService (bus catalog, availability)                    │ │
│ │ - SearchService (search, filters, caching logic)            │ │
│ │ - NotificationService (email, in-app notifications)         │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Infrastructure Services (Cross-cutting Concerns)            │ │
│ │ - ErrorHandlerService (error formatting, categorization)    │ │
│ │ - LoggerService (structured logging)                        │ │
│ │ - ValidationService (input validation, schema checks)       │ │
│ └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    REPOSITORY LAYER (DATA ACCESS)                │
│  UserRepository │ BookingRepository │ BusRepository │           │
│  RouteRepository │ NotificationRepository                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATA PERSISTENCE LAYER                        │
│  MongoDB Collections:                                            │
│  users │ bookings │ buses │ routes │ notifications              │
└─────────────────────────────────────────────────────────────────┘
```

### Dependency Injection Pattern

Services are instantiated with their dependencies injected, enabling:
- **Testability**: Easy mock substitution for unit testing
- **Loose Coupling**: Services depend on abstractions, not concrete implementations
- **Single Responsibility**: Each service focuses on one domain

**Example Dependency Graph**:
```
BookingController
    ↓ depends on
BookingService
    ├─ depends on → BookingRepository
    ├─ depends on → BusService
    ├─ depends on → NotificationService
    └─ depends on → ErrorHandlerService

BusService
    ├─ depends on → BusRepository
    └─ depends on → ErrorHandlerService
```

---

## Service Method Signatures

### AuthService

**Purpose**: Manages user authentication, session validation, and identity verification.

```typescript
interface AuthService {
  // Authenticate user via Google ID and store session
  authenticateGoogleUser(googleId: string, userData: GoogleUserData): Promise<User>
  
  // Validate if request contains valid authentication
  validateSession(req: Request): Promise<{ isValid: boolean, userId?: string }>
  
  // Extract authenticated user ID from request context
  getAuthenticatedUserId(req: Request): string | throws AuthenticationError
  
  // Verify user has access to specific resource (user isolation check)
  verifyUserAccess(userId: string, resourceOwnerId: string): Promise<boolean | throws ForbiddenError>
}
```

**Error Cases**:
- `UNAUTHORIZED`: Session invalid or expired
- `FORBIDDEN`: User attempting to access another user's resource
- `VALIDATION_ERROR`: Missing or malformed authentication data

### BookingService

**Purpose**: Manages booking lifecycle: creation, retrieval, updates, cancellation, state transitions.

```typescript
interface BookingService {
  // Create new booking with user isolation enforcement
  createBooking(
    userId: string,
    bookingData: CreateBookingDTO
  ): Promise<Booking | throws ValidationError | PaymentError>
  
  // Retrieve all bookings for authenticated user only
  getBookingsByCustomer(userId: string, options?: PaginationOptions): Promise<Booking[]>
  
  // Get single booking with user isolation check
  getBookingById(bookingId: string, userId: string): Promise<Booking | throws NotFoundError | ForbiddenError>
  
  // Cancel booking and update seat availability
  cancelBooking(bookingId: string, userId: string): Promise<CancellationResult | throws ForbiddenError | BusinessRuleError>
  
  // Update booking status (e.g., pending → confirmed → completed)
  updateBookingStatus(
    bookingId: string,
    newStatus: BookingStatus,
    userId: string
  ): Promise<Booking | throws ValidationError | ForbiddenError>
  
  // Validate booking data before persistence
  validateBookingData(data: CreateBookingDTO): Promise<void | throws ValidationError>
}
```

**Key Constraint**: All `getBooking*` methods filter by `userId` server-side. Never trust client-side filtering.

**Error Cases**:
- `VALIDATION_ERROR`: Invalid booking data
- `NOT_FOUND`: Booking doesn't exist
- `FORBIDDEN`: User accessing another user's booking
- `BUSINESS_RULE_ERROR`: Insufficient seats, invalid state transition

### CustomerService

**Purpose**: Manages user profiles, preferences, and user-specific data retrieval.

```typescript
interface CustomerService {
  // Get customer profile (user isolation enforced)
  getProfile(userId: string): Promise<CustomerProfile | throws NotFoundError>
  
  // Update customer profile (user isolation enforced)
  updateProfile(
    userId: string,
    updateData: UpdateProfileDTO
  ): Promise<CustomerProfile | throws ValidationError | ForbiddenError>
  
  // Get customer preferences
  getPreferences(userId: string): Promise<UserPreferences>
  
  // Create new customer account
  registerCustomer(userData: RegisterDTO): Promise<Customer | throws ValidationError | ConflictError>
  
  // Verify email exists (for registration validation)
  emailExists(email: string): Promise<boolean>
}
```

**Error Cases**:
- `VALIDATION_ERROR`: Invalid profile update data
- `NOT_FOUND`: User profile doesn't exist
- `CONFLICT`: Email already registered
- `FORBIDDEN`: User updating another user's profile

### BusService

**Purpose**: Manages bus inventory, seat availability, and bus-related queries.

```typescript
interface BusService {
  // Search buses by route and date with availability
  searchBuses(filters: SearchFilters): Promise<BusSearchResult[]>
  
  // Get bus details including seat layout
  getBusById(busId: string): Promise<BusDetails | throws NotFoundError>
  
  // Check seat availability for specific bus and date
  checkAvailability(busId: string, departureDate: string): Promise<SeatAvailability>
  
  // Reserve seats (atomic operation, prevents double-booking)
  reserveSeats(
    busId: string,
    seatNumbers: number[],
    departureDate: string
  ): Promise<ReservationToken | throws InsufficientSeatsError>
  
  // Release reserved seats on cancellation
  releaseSeats(busId: string, seatNumbers: number[], departureDate: string): Promise<void>
}
```

**Error Cases**:
- `NOT_FOUND`: Bus doesn't exist
- `INSUFFICIENT_SEATS`: Requested seats unavailable
- `BUSINESS_RULE_ERROR`: Invalid seat numbers

### SearchService

**Purpose**: Handles complex search logic, filtering, and result optimization.

```typescript
interface SearchService {
  // Perform multi-criteria search with caching
  search(query: SearchQuery, userId?: string): Promise<SearchResults>
  
  // Apply filters to search results
  applyFilters(results: SearchResult[], filters: FilterCriteria): Promise<FilteredResults>
  
  // Sort results by price, duration, rating, departure time
  sortResults(results: SearchResult[], sortBy: SortCriteria): Promise<SortedResults>
  
  // Get popular search results from cache
  getPopularRoutes(): Promise<Route[]>
  
  // Invalidate cached search results
  invalidateSearchCache(cacheKey: string): Promise<void>
}
```

**Caching Strategy**:
- Cache keys: `search:{route_id}:{date}:{bus_type}`
- TTL: 5 minutes (adjust based on data freshness requirements)
- Invalidate on: bus availability changes, new buses added

### NotificationService

**Purpose**: Manages sending notifications via email and in-app channels.

```typescript
interface NotificationService {
  // Send booking confirmation email
  sendBookingConfirmation(booking: Booking, customer: Customer): Promise<void | throws EmailError>
  
  // Send cancellation notification
  sendCancellationNotification(booking: Booking, customer: Customer): Promise<void>
  
  // Send reminder notification
  sendReminderNotification(booking: Booking, customer: Customer, hoursBeforeDeparture: number): Promise<void>
  
  // Queue notification for async processing
  queueNotification(notification: NotificationPayload): Promise<void>
  
  // Get user notifications
  getUserNotifications(userId: string): Promise<Notification[]>
}
```

**Error Cases**:
- `EMAIL_ERROR`: SMTP failure (log but don't fail the request)
- `INVALID_EMAIL`: Malformed email address

### ErrorHandlerService

**Purpose**: Centralized error formatting, categorization, and transformation for consistent API responses.

```typescript
interface ErrorHandlerService {
  // Format any error into standardized response
  formatError(error: Error | ServiceError, statusCode?: number): ErrorResponse
  
  // Categorize error and assign HTTP status code
  categorizeError(error: Error): { statusCode: number, code: string }
  
  // Transform service layer error for client consumption
  transformServiceError(error: ServiceError): ErrorResponse
  
  // Log error with full context for debugging
  logError(error: Error, context?: ErrorContext): Promise<void>
  
  // Create structured error object
  createError(code: string, message: string, details?: any): ServiceError
}
```

**Standard Error Response Format**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly message",
    "statusCode": 400,
    "details": { "field": "error details" }
  }
}
```

### LoggerService

**Purpose**: Structured logging with context tracking for debugging and monitoring.

```typescript
interface LoggerService {
  // Log info-level messages
  info(message: string, context?: LogContext): void
  
  // Log error with full stack trace
  error(message: string, error: Error, context?: LogContext): void
  
  // Log warning messages
  warn(message: string, context?: LogContext): void
  
  // Log debug messages (only in development)
  debug(message: string, context?: LogContext): void
  
  // Log database query performance
  logQueryTime(query: string, executionMs: number): void
}
```

---

## Components and Interfaces

### Request Flow Components

#### 1. Authentication Middleware (`auth.middleware.js`)

**Responsibility**: Validate incoming requests and attach user context.

**Behavior**:
```
Request arrives
  ↓
Check if route requires authentication
  ├─ No → Next middleware
  └─ Yes ↓
      Extract session from request (sessionStorage or cookies)
      ↓
      Validate Google user ID exists and matches session
      ├─ Invalid → Return 401 Unauthorized
      └─ Valid ↓
          Fetch user from database
          ├─ Not found → Create user if email valid
          └─ Found ↓
              Attach userId to request.user.id
              Attach user object to request.user
              ↓
              Next middleware (controller)
```

**Code Structure**:
```javascript
// Pseudocode
const authMiddleware = (req, res, next) => {
  const publicRoutes = ['/auth/login', '/buses', '/routes'];
  if (publicRoutes.includes(req.path)) {
    return next();
  }
  
  try {
    const googleId = req.session?.googleId || req.headers['x-user-id'];
    if (!googleId) {
      return errorHandler.formatAndSend(res, 'UNAUTHORIZED', 401);
    }
    
    const user = userRepository.findByGoogleId(googleId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    
    req.user = { id: user._id, googleId, ...user };
    next();
  } catch (error) {
    errorHandler.formatAndSend(res, error);
  }
};
```

#### 2. Error Handler Middleware (`error-handler.middleware.js`)

**Responsibility**: Catch unhandled errors and format responses.

**Behavior**:
```
Unhandled error in controller/service
  ↓
Error handler middleware catches
  ↓
Categorize error (ValidationError, NotFoundError, etc.)
  ↓
Format response according to error code
  ├─ VALIDATION_ERROR → 400 Bad Request
  ├─ UNAUTHORIZED → 401 Unauthorized
  ├─ FORBIDDEN → 403 Forbidden
  ├─ NOT_FOUND → 404 Not Found
  └─ Generic Error → 500 Internal Server Error
  ↓
Send standardized JSON response
```

#### 3. Request Logger Middleware (`request-logger.middleware.js`)

**Responsibility**: Log all incoming requests with timing information.

**Behavior**:
```
Request arrives
  ↓
Record start time
  ↓
Log request details: method, path, user ID, query params
  ↓
Execute request
  ↓
Record end time, calculate response time
  ↓
Log response: status code, response time (ms)
```

### Custom Error Classes

**Purpose**: Enable error categorization and handling without string comparisons.

```javascript
// src/utils/custom-errors.js

class ServiceError extends Error {
  constructor(code, message, statusCode = 500, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends ServiceError {
  constructor(message, details = {}) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

class AuthenticationError extends ServiceError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
  }
}

class AuthorizationError extends ServiceError {
  constructor(message = 'Insufficient permissions') {
    super('FORBIDDEN', message, 403);
  }
}

class NotFoundError extends ServiceError {
  constructor(resource = 'Resource') {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

class BusinessRuleError extends ServiceError {
  constructor(message, code = 'BUSINESS_RULE_VIOLATION') {
    super(code, message, 400);
  }
}
```

---

## Data Flow Diagrams

### 1. User Booking Workflow with State Transitions

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BOOKING LIFECYCLE                                 │
└─────────────────────────────────────────────────────────────────────────┘

User Action: Browse Buses
    ↓
[GET /buses/search]
    ├─ SearchService.search(filters)
    ├─ BusRepository.find(filters)
    ├─ Return available buses with seat counts
    └─ Cache results for 5 minutes


User Action: Select Bus and Seats
    ↓
[POST /bookings]
    ├─ AuthMiddleware: Validate user, attach userId
    ├─ BookingController.createBooking()
    │   ├─ Extract bookingData from request.body
    │   ├─ Attach userId to booking (server-side, not trusting client)
    │   ├─ BookingService.validateBookingData()
    │   │   ├─ Validate seats are available
    │   │   ├─ Validate fare calculation
    │   │   ├─ Validate passenger info
    │   │   └─ Throw ValidationError if invalid
    │   ├─ BookingService.createBooking(userId, bookingData)
    │   │   ├─ Create booking document: status: "pending"
    │   │   ├─ BusService.reserveSeats() - atomic operation
    │   │   └─ Return booking with reference ID
    │   ├─ Handle paymentMethod: "cash_on_trip"
    │   │   ├─ Skip payment processing
    │   │   ├─ Set status: "confirmed"
    │   │   └─ NotificationService.sendBookingConfirmation()
    │   └─ Return 201 Created with booking details
    └─ ErrorHandlerService.formatError() if exception


State Transition: PENDING → CONFIRMED
    ├─ Triggered by: Payment success OR "cash_on_trip" selection
    ├─ BookingService.updateBookingStatus(bookingId, "confirmed", userId)
    │   ├─ Verify userId is booking owner (throws ForbiddenError if not)
    │   ├─ Update booking.status = "confirmed"
    │   └─ Send confirmation email
    └─ Client displays: "Trip booked successfully!" with booking reference


State Transition: CONFIRMED → IN_PROGRESS (automatic)
    ├─ Triggered by: Departure time reached (background job or on-demand)
    └─ Booking moves to "in_progress" status


State Transition: IN_PROGRESS → COMPLETED (automatic)
    ├─ Triggered by: Arrival time or manual driver action
    └─ Booking marked completed


User Action: View My Bookings
    ↓
[GET /bookings/my]
    ├─ AuthMiddleware: Validate user, attach userId
    ├─ BookingController.getBookingsByCustomer()
    │   ├─ Extract userId from request.user.id
    │   ├─ BookingService.getBookingsByCustomer(userId)
    │   │   ├─ BookingRepository.find({ customerId: userId })
    │   │   ├─ Sort by departureDate descending (upcoming first)
    │   │   ├─ Include bus details via populate/lookup
    │   │   ├─ Include route details
    │   │   └─ Return bookings array
    │   └─ Return 200 OK with bookings
    └─ Client displays bookings with "Cash on Trip" status indicator


User Action: Cancel Booking
    ↓
[DELETE /bookings/:id]
    ├─ AuthMiddleware: Validate user, attach userId
    ├─ BookingController.cancelBooking(bookingId)
    │   ├─ BookingService.cancelBooking(bookingId, userId)
    │   │   ├─ BookingRepository.findById(bookingId)
    │   │   ├─ Verify booking.customerId === userId (throws ForbiddenError if not)
    │   │   ├─ Check if cancellation allowed (status not "completed")
    │   │   ├─ Calculate refund amount
    │   │   ├─ BusService.releaseSeats() - free up seats
    │   │   ├─ Update booking.status = "cancelled"
    │   │   ├─ NotificationService.sendCancellationNotification()
    │   │   └─ Return cancellation result with refund info
    │   └─ Return 200 OK
    └─ ErrorHandlerService catches ForbiddenError if wrong user


Error Scenarios:

INSUFFICIENT_SEATS:
    ├─ Trigger: BusService.checkAvailability() returns no seats
    ├─ BookingService throws: BusinessRuleError("No seats available")
    ├─ ErrorHandlerService formats as: 400 Bad Request
    └─ Client displays: "Sorry, selected seats are no longer available"

BOOKING_NOT_FOUND:
    ├─ Trigger: Booking ID doesn't exist
    ├─ BookingRepository.findById() returns null
    ├─ BookingService throws: NotFoundError("Booking")
    ├─ ErrorHandlerService formats as: 404 Not Found
    └─ Client displays: "Booking not found"

USER_ACCESSING_OTHER_BOOKING:
    ├─ Trigger: userId doesn't match booking.customerId
    ├─ BookingService.verifyUserAccess() returns false
    ├─ AuthService throws: AuthorizationError()
    ├─ ErrorHandlerService formats as: 403 Forbidden
    └─ Client displays: "You don't have permission to view this booking"

INVALID_CANCELLATION:
    ├─ Trigger: Booking already completed/cancelled
    ├─ BookingService checks status: "completed"
    ├─ Throws: BusinessRuleError("Cannot cancel completed booking")
    ├─ ErrorHandlerService formats as: 400 Bad Request
    └─ Client displays: "This booking cannot be cancelled"
```

### 2. Search Query Flow with Caching

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SEARCH FLOW WITH CACHE                          │
└─────────────────────────────────────────────────────────────────────────┘

User Action: Search Buses
    ↓
[GET /buses/search?from=NYC&to=BOS&date=2024-06-15&passengers=2]
    ├─ BusController.searchBuses()
    │   ├─ Extract query parameters
    │   ├─ SearchService.search(searchQuery)
    │   │   ├─ Generate cache key: search:NYC:BOS:2024-06-15
    │   │   ├─ Cache check (hypothetical Redis)
    │   │   │   ├─ Cache HIT
    │   │   │   │   ├─ Return cached results
    │   │   │   │   ├─ LoggerService.debug("Search cache hit")
    │   │   │   │   └─ Response time < 50ms
    │   │   │   └─ Cache MISS
    │   │   │       ├─ LoggerService.debug("Search cache miss")
    │   │   │       ├─ Query MongoDB:
    │   │   │       │   ├─ db.routes.find({ source: "NYC", destination: "BOS", date: "2024-06-15" })
    │   │   │       │   ├─ db.buses.find({ routeId: <routeIds> })
    │   │   │       │   ├─ Calculate availability: total_seats - booked_seats
    │   │   │       │   └─ Return with seat counts
    │   │   │       ├─ ApplyFilters (busType, priceRange, departureTime)
    │   │   │       ├─ SortResults (price_asc, departure_asc, duration_asc)
    │   │   │       ├─ Cache results for 5 minutes
    │   │   │       └─ Return results
    │   └─ Return 200 OK with buses array
    │
    └─ Response: 
        [
          {
            busId: "BUS001",
            operatorName: "Greyhound",
            departureTime: "08:00",
            arrivalTime: "14:30",
            fare: 45.99,
            availableSeats: 8,
            totalSeats: 50,
            busType: "AC",
            amenities: ["WiFi", "USB", "Blanket"]
          },
          { ... more buses ... }
        ]


Cache Invalidation Scenarios:

New Booking Created:
    ├─ Trigger: [POST /bookings] succeeds
    ├─ After booking save: BookingService.createBooking()
    │   ├─ SearchService.invalidateSearchCache(busId, date)
    │   ├─ Clear: search:NYC:BOS:2024-06-15
    │   └─ Next search will query fresh data
    └─ Previous searches remain cached until TTL expires


Scheduled Cache Refresh:
    ├─ Background job runs every 5 minutes
    ├─ Refresh popular routes cache
    ├─ Update availability for high-demand routes
    └─ Prevent stale data while minimizing database hits
```

### 3. Authentication & User Isolation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION & AUTHORIZATION                        │
└─────────────────────────────────────────────────────────────────────────┘

User First-Time Login:
    ↓
[POST /auth/login]
    ├─ Frontend sends: { googleId: "123456789", name: "John", email: "john@gmail.com" }
    ├─ AuthController.login()
    │   ├─ AuthService.authenticateGoogleUser(googleId, userData)
    │   │   ├─ CustomerService.emailExists(email) - check if user already exists
    │   │   ├─ If exists: fetch existing user
    │   │   ├─ If not exists:
    │   │   │   ├─ CustomerService.registerCustomer(userData)
    │   │   │   ├─ Create new user document:
    │   │   │   │   {
    │   │   │   │     googleId: "123456789",
    │   │   │   │     name: "John",
    │   │   │   │     email: "john@gmail.com",
    │   │   │   │     picture: "url",
    │   │   │   │     createdAt: now,
    │   │   │   │     preferences: {}
    │   │   │   │   }
    │   │   │   └─ Return newly created user
    │   │   └─ Store session: sessionStorage.setItem("Loggedinuser", JSON.stringify(user))
    │   └─ Return 200 OK with user object
    │
    └─ Response: 
        {
          success: true,
          user: {
            id: "507f1f77bcf86cd799439011",
            googleId: "123456789",
            name: "John",
            email: "john@gmail.com",
            picture: "url"
          }
        }


Subsequent Protected Request:
    ↓
[GET /bookings/my]
    ├─ Browser: Include Google ID in request
    │   ├─ From sessionStorage: JSON.parse(sessionStorage.getItem("Loggedinuser")).googleId
    │   └─ Send in headers: X-User-Id or session cookie
    ├─ AuthMiddleware.validateSession()
    │   ├─ Extract googleId from request
    │   ├─ CustomerService.emailExists() - validate user still exists
    │   ├─ Verify googleId matches database record
    │   ├─ Attach userId to request.user.id
    │   └─ Call next()
    ├─ BookingController.getBookingsByCustomer()
    │   ├─ Use request.user.id (NOT client-provided userIdparameter)
    │   ├─ BookingService.getBookingsByCustomer(request.user.id)
    │   │   ├─ CRITICAL: Server-side filter by userId
    │   │   ├─ MongoDB query: db.bookings.find({ customerId: ObjectId(userId) })
    │   │   └─ Return only this user's bookings
    │   └─ Return 200 OK
    │
    └─ Never expose other users' bookings


Attack Scenario: User Tries to Access Another User's Data:
    ↓
[GET /bookings/my?userId=507f1f77bcf86cd799439012]
    ├─ Attacker tries: userId query parameter = another user's ID
    ├─ BookingController IGNORES userId parameter
    ├─ Uses request.user.id from middleware (authenticated userId)
    ├─ BookingService filters: { customerId: request.user.id }
    ├─ Returns only attacker's bookings, not victim's
    └─ Security: Complete mitigation


Attack Scenario: Forged Google ID:
    ↓
[GET /bookings/my]
    ├─ Headers: X-User-Id: "forged_google_id_12345"
    ├─ AuthMiddleware.validateSession()
    │   ├─ Look up user by googleId in database
    │   ├─ Find nothing (forged ID doesn't exist)
    │   ├─ Throw: AuthenticationError("Invalid authentication")
    │   └─ Return 401 Unauthorized
    └─ Request blocked before reaching controller


User Profile Isolation:
    ↓
[PUT /users/profile]
    ├─ Customer tries to update profile
    ├─ AuthMiddleware validates and attaches userId
    ├─ CustomerService.updateProfile(userId, updateData)
    │   ├─ Verify profile owner: profile.userId === request.user.id
    │   ├─ Allow update ONLY if match
    │   └─ Throw ForbiddenError if mismatch
    └─ Never expose other profiles to modification
```

### 4. Payment Processing Flow (Cash on Trip)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   CASH ON TRIP PAYMENT FLOW                             │
└─────────────────────────────────────────────────────────────────────────┘

User Selects "Cash on Trip":
    ↓
[UI] Booking confirmation page
    ├─ Show payment options: ["Online", "Cash on Trip"]
    ├─ On selection of "Cash on Trip"
    │   ├─ Hide payment fields (card number, CVV, etc.)
    │   ├─ Show message: "Pay the driver when you board"
    │   └─ Display booking summary with total fare
    └─ Submit button ready for click


Submit Booking with "Cash on Trip":
    ↓
[POST /bookings]
    ├─ Request body:
    │   {
    │     busId: "BUS001",
    │     routeId: "ROUTE_NYC_BOS",
    │     seats: [12, 13, 14],
    │     passengers: [{ name: "John", age: 25 }, ...],
    │     fare: 135.97,
    │     paymentMethod: "cash_on_trip"
    │   }
    ├─ BookingController.createBooking()
    │   ├─ AuthMiddleware attaches userId
    │   ├─ BookingService.createBooking(userId, bookingData)
    │   │   ├─ Validate: paymentMethod === "cash_on_trip"
    │   │   ├─ Skip PaymentService (no online payment processing)
    │   │   ├─ Create booking:
    │   │   │   {
    │   │   │     customerId: userId,
    │   │   │     busId: "BUS001",
    │   │   │     status: "confirmed",
    │   │   │     paymentMethod: "cash_on_trip",
    │   │   │     paymentStatus: "pending",
    │   │   │     fare: 135.97,
    │   │   │     seats: [12, 13, 14],
    │   │   │     createdAt: now
    │   │   │   }
    │   │   ├─ BusService.reserveSeats(busId, [12, 13, 14])
    │   │   ├─ NotificationService.sendBookingConfirmation()
    │   │   └─ Return booking
    │   └─ Return 201 Created
    │
    └─ Response:
        {
          success: true,
          booking: {
            id: "BOOKING_001",
            status: "confirmed",
            paymentMethod: "cash_on_trip",
            paymentStatus: "pending",
            bookingReference: "TB20240615001",
            fare: 135.97
          }
        }


Client Display:
    ├─ Show success message: "Trip booked successfully!"
    ├─ Display booking reference: "TB20240615001"
    ├─ Show payment details: "Please pay ₹135.97 to the driver"
    └─ Allow download of ticket PDF with reference number


User Views Booking in Profile:
    ↓
[GET /bookings/my]
    ├─ BookingService returns bookings with paymentMethod field
    ├─ UI displays: "Payment: Cash on Trip (Pending)"
    └─ Color indicator: Yellow/Orange for "Payment Pending"


Reconciliation (Driver/Conductor):
    ├─ Driver collects cash at boarding
    ├─ Admin marks payment as received (manual or automatic)
    ├─ Update booking.paymentStatus: "received"
    └─ Booking moves to "in_progress" status


Error Scenario - Insufficient Balance:
    ├─ UI validates fare before submission
    ├─ If fare > available balance (future feature)
    ├─ Return validation error
    └─ User adjusts selection or chooses different payment


Error Scenario - Booking Already Full:
    ├─ Between user selection and submission, seats sold
    ├─ BusService.reserveSeats() finds no seats available
    ├─ Throws: BusinessRuleError("Seats no longer available")
    ├─ BookingService catches and propagates
    ├─ ErrorHandlerService formats: 400 Bad Request
    └─ Client displays: "Sorry, these seats were just booked by someone else. Please select new seats."
```

### 5. Notification Delivery Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     NOTIFICATION FLOW                                    │
└─────────────────────────────────────────────────────────────────────────┘

Booking Confirmation Notification:
    ↓
[POST /bookings] → 201 Created
    ├─ BookingService.createBooking() completes
    ├─ NotificationService.sendBookingConfirmation(booking, customer)
    │   ├─ Build email content:
    │   │   ├─ Booking reference
    │   │   ├─ Bus details (operator, departure time)
    │   │   ├─ Route (source → destination)
    │   │   ├─ Seats selected
    │   │   ├─ Total fare
    │   │   ├─ Cancellation policy
    │   │   └─ Customer support contact
    │   ├─ Queue async notification (don't block response):
    │   │   ├─ Add to: NotificationQueue in MongoDB
    │   │   ├─ NotificationWorker picks up async
    │   │   └─ Worker sends email via Nodemailer
    │   └─ Continue immediately (don't wait for email)
    └─ Return response to client


Async Notification Processing (Background Job):
    ↓
NotificationWorker (runs every 5 seconds):
    ├─ Query: db.notifications.find({ status: "pending", createdAt: { $gt: now - 5m } })
    ├─ For each notification:
    │   ├─ Extract customer email
    │   ├─ Build email from template
    │   ├─ Send via Nodemailer (SMTP)
    │   │   ├─ Success: Mark as "sent"
    │   │   ├─ Failure: Retry up to 3 times
    │   │   └─ Max retries reached: Mark as "failed"
    │   └─ Log result
    └─ Exit when queue empty


Reminder Notification (Scheduled):
    ├─ Background job runs 24 hours before departure
    ├─ Query: Bookings departing tomorrow
    ├─ For each booking:
    │   ├─ NotificationService.sendReminderNotification()
    │   ├─ Email: "Your trip is tomorrow at 08:00 AM"
    │   ├─ Include: Meeting point, check-in instructions
    │   └─ Send async via NotificationWorker
    └─ User receives email reminder


Cancellation Notification:
    ↓
[DELETE /bookings/:id]
    ├─ BookingService.cancelBooking() completes
    ├─ NotificationService.sendCancellationNotification()
    │   ├─ Build email:
    │   │   ├─ Booking reference (now cancelled)
    │   │   ├─ Seats released
    │   │   ├─ Refund amount and status
    │   │   └─ Refund timeline
    │   ├─ Queue async notification
    │   └─ Continue immediately
    └─ User receives confirmation of cancellation


Notification Storage:
    ├─ Collection: db.notifications
    ├─ Document structure:
    │   {
    │     _id: ObjectId,
    │     type: "booking_confirmation",
    │     customerId: ObjectId,
    │     email: "user@gmail.com",
    │     subject: "Booking Confirmation",
    │     body: "HTML content",
    │     status: "pending|sent|failed",
    │     attempts: 0,
    │     maxAttempts: 3,
    │     createdAt: timestamp,
    │     sentAt: timestamp
    │   }
    └─ TTL index on createdAt: auto-delete after 90 days
```

---

## API Request/Response Examples

### Authentication

**POST /auth/login**

```
Request:
{
  "googleId": "106541783456782934782",
  "name": "John Doe",
  "email": "john@gmail.com",
  "picture": "https://lh3.googleusercontent.com/a/..."
}

Response (201 Created):
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "googleId": "106541783456782934782",
    "name": "John Doe",
    "email": "john@gmail.com",
    "picture": "https://lh3.googleusercontent.com/a/..."
  }
}

Error Response (400 Bad Request):
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "statusCode": 400,
    "details": { "field": "email", "error": "must be valid email" }
  }
}
```

### Bus Search

**GET /buses/search?from=NYC&to=BOS&date=2024-06-15&passengers=2**

```
Response (200 OK):
{
  "success": true,
  "data": [
    {
      "busId": "BUS001",
      "operatorName": "Greyhound Express",
      "busType": "AC Sleeper",
      "totalSeats": 50,
      "availableSeats": 8,
      "departureTime": "08:00",
      "arrivalTime": "14:30",
      "duration": "6h 30m",
      "fare": 45.99,
      "amenities": ["WiFi", "USB", "Blanket", "Pillow"],
      "rating": 4.5,
      "seatLayout": {
        "rows": 13,
        "seatsPerRow": 4,
        "seatOccupancy": [1,1,1,0,1,1,0,1,...] // 1 = booked, 0 = available
      }
    },
    { ... more buses ... }
  ]
}

Error Response (400 Bad Request):
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid search parameters",
    "statusCode": 400,
    "details": {
      "field": "date",
      "error": "must be in future"
    }
  }
}
```

### Create Booking

**POST /bookings**

```
Request:
{
  "busId": "BUS001",
  "routeId": "ROUTE_NYC_BOS",
  "seats": [12, 13, 14],
  "passengers": [
    {
      "name": "John Doe",
      "email": "john@gmail.com",
      "phone": "+1234567890",
      "age": 28
    },
    {
      "name": "Jane Doe",
      "email": "jane@gmail.com",
      "phone": "+1234567890",
      "age": 26
    },
    {
      "name": "Mike Smith",
      "email": "mike@gmail.com",
      "phone": "+1234567890",
      "age": 30
    }
  ],
  "fare": 137.97,
  "paymentMethod": "cash_on_trip"
}

Response (201 Created):
{
  "success": true,
  "booking": {
    "id": "607f1f77bcf86cd799439012",
    "bookingReference": "TB20240615001",
    "customerId": "507f1f77bcf86cd799439011",
    "busId": "BUS001",
    "routeId": "ROUTE_NYC_BOS",
    "seats": [12, 13, 14],
    "passengers": [
      { "name": "John Doe", "seat": 12 },
      { "name": "Jane Doe", "seat": 13 },
      { "name": "Mike Smith", "seat": 14 }
    ],
    "fare": 137.97,
    "paymentMethod": "cash_on_trip",
    "paymentStatus": "pending",
    "status": "confirmed",
    "departureTime": "08:00",
    "arrivalTime": "14:30",
    "createdAt": "2024-06-15T10:30:00Z"
  }
}

Error Response (400 Bad Request - Invalid Seats):
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid seat selection",
    "statusCode": 400,
    "details": {
      "field": "seats",
      "error": "seats 13, 15 are no longer available"
    }
  }
}

Error Response (403 Forbidden - Payment Processing Error):
{
  "success": false,
  "error": {
    "code": "PAYMENT_ERROR",
    "message": "Unable to process payment",
    "statusCode": 400,
    "details": {
      "reason": "Payment gateway temporarily unavailable"
    }
  }
}
```

### Get User Bookings

**GET /bookings/my**

```
Response (200 OK):
{
  "success": true,
  "data": [
    {
      "id": "607f1f77bcf86cd799439012",
      "bookingReference": "TB20240615001",
      "busId": "BUS001",
      "operatorName": "Greyhound Express",
      "departureTime": "08:00",
      "arrivalTime": "14:30",
      "seats": [12, 13, 14],
      "source": "New York",
      "destination": "Boston",
      "fare": 137.97,
      "paymentMethod": "cash_on_trip",
      "paymentStatus": "pending",
      "status": "confirmed",
      "createdAt": "2024-06-15T10:30:00Z",
      "departureDate": "2024-06-15"
    }
  ]
}

Empty Response (200 OK):
{
  "success": true,
  "data": []
}

Error Response (401 Unauthorized):
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required",
    "statusCode": 401
  }
}
```

### Update User Profile

**PUT /users/profile**

```
Request:
{
  "name": "John Doe Updated",
  "phone": "+1987654321",
  "preferences": {
    "seatPreference": "window",
    "mealPreference": "vegetarian"
  }
}

Response (200 OK):
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe Updated",
    "email": "john@gmail.com",
    "phone": "+1987654321",
    "preferences": {
      "seatPreference": "window",
      "mealPreference": "vegetarian"
    },
    "updatedAt": "2024-06-15T15:45:00Z"
  }
}

Error Response (403 Forbidden - Accessing Another User):
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You cannot modify another user's profile",
    "statusCode": 403
  }
}

Error Response (400 Bad Request):
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid profile data",
    "statusCode": 400,
    "details": {
      "field": "phone",
      "error": "must be valid phone number"
    }
  }
}
```

### Cancel Booking

**DELETE /bookings/:id**

```
Response (200 OK):
{
  "success": true,
  "cancellation": {
    "bookingId": "607f1f77bcf86cd799439012",
    "status": "cancelled",
    "originalFare": 137.97,
    "cancellationCharge": 20.69,
    "refundAmount": 117.28,
    "refundStatus": "initiated",
    "refundTimeline": "5-7 business days"
  }
}

Error Response (403 Forbidden):
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Cannot access this booking",
    "statusCode": 403
  }
}

Error Response (400 Bad Request):
{
  "success": false,
  "error": {
    "code": "BUSINESS_RULE_ERROR",
    "message": "Cannot cancel this booking",
    "statusCode": 400,
    "details": {
      "reason": "Booking status is 'completed'. Cannot cancel past trips."
    }
  }
}

Error Response (404 Not Found):
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Booking not found",
    "statusCode": 404
  }
}
```

### Pagination Example

**GET /bookings/my?page=1&limit=10&sort=-departureDate**

```
Response (200 OK):
{
  "success": true,
  "data": [
    { ... booking 1 ... },
    { ... booking 2 ... },
    ...
    { ... booking 10 ... }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 10,
    "totalRecords": 45,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}

Request Variations:
- /bookings/my?page=2&limit=20  (page 2, 20 items)
- /bookings/my?sort=fare        (sort by fare ascending)
- /bookings/my?sort=-createdAt  (sort by creation date descending)
```

---

## Database Schema

### Collections and Indexes

#### Users Collection

```javascript
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["googleId", "email", "name"],
      properties: {
        _id: { bsonType: "objectId" },
        googleId: { bsonType: "string", pattern: "^[0-9]+$" },
        email: { bsonType: "string", pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" },
        name: { bsonType: "string", minLength: 1, maxLength: 100 },
        picture: { bsonType: "string" },
        phone: { bsonType: "string" },
        preferences: {
          bsonType: "object",
          properties: {
            seatPreference: { enum: ["window", "aisle", "any"] },
            mealPreference: { enum: ["vegetarian", "non-vegetarian", "vegan", "any"] },
            notificationsEnabled: { bsonType: "bool" }
          }
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
});

// Indexes
db.users.createIndex({ googleId: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ createdAt: -1 });
```

#### Bookings Collection

```javascript
db.createCollection("bookings", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["customerId", "busId", "routeId", "seats", "fare", "status", "paymentMethod"],
      properties: {
        _id: { bsonType: "objectId" },
        customerId: { bsonType: "objectId" },
        busId: { bsonType: "objectId" },
        routeId: { bsonType: "objectId" },
        bookingReference: { bsonType: "string", pattern: "^TB[0-9]{8}[0-9]{3}$" },
        seats: {
          bsonType: "array",
          items: { bsonType: "int", minimum: 1, maximum: 100 }
        },
        passengers: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              name: { bsonType: "string" },
              email: { bsonType: "string" },
              phone: { bsonType: "string" },
              age: { bsonType: "int" },
              seat: { bsonType: "int" }
            }
          }
        },
        fare: { bsonType: "double", minimum: 0 },
        paymentMethod: { enum: ["cash_on_trip", "online", "card", "wallet"] },
        paymentStatus: { enum: ["pending", "completed", "failed", "refunded"] },
        status: { enum: ["pending", "confirmed", "in_progress", "completed", "cancelled"] },
        departureDate: { bsonType: "date" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
        cancelledAt: { bsonType: ["date", "null"] }
      }
    }
  }
});

// Indexes
db.bookings.createIndex({ customerId: 1, departureDate: -1 });  // User bookings query
db.bookings.createIndex({ busId: 1, departureDate: 1 });        // Bus occupancy query
db.bookings.createIndex({ status: 1 });                          // Status filtering
db.bookings.createIndex({ bookingReference: 1 }, { unique: true });
db.bookings.createIndex({ createdAt: -1 });                      // Recent bookings
```

#### Buses Collection

```javascript
db.createCollection("buses", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["operatorName", "busType", "totalSeats", "routes"],
      properties: {
        _id: { bsonType: "objectId" },
        operatorName: { bsonType: "string" },
        busType: { enum: ["AC", "Non-AC", "Sleeper", "Semi-Sleeper"] },
        totalSeats: { bsonType: "int", minimum: 1, maximum: 100 },
        amenities: {
          bsonType: "array",
          items: { bsonType: "string" }
        },
        rating: { bsonType: "double", minimum: 0, maximum: 5 },
        routes: {
          bsonType: "array",
          items: { bsonType: "objectId" }
        },
        operatorContact: { bsonType: "string" },
        createdAt: { bsonType: "date" }
      }
    }
  }
});

// Indexes
db.buses.createIndex({ operatorName: 1 });
db.buses.createIndex({ busType: 1 });
db.buses.createIndex({ routes: 1 });
```

#### Routes Collection

```javascript
db.createCollection("routes", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["source", "destination", "departureDate"],
      properties: {
        _id: { bsonType: "objectId" },
        source: { bsonType: "string" },
        destination: { bsonType: "string" },
        departureTime: { bsonType: "string", pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" },
        arrivalTime: { bsonType: "string", pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" },
        departureDate: { bsonType: "date" },
        distance: { bsonType: "double" },
        duration: { bsonType: "string" },
        busId: { bsonType: "objectId" },
        fare: { bsonType: "double", minimum: 0 },
        stoppingPoints: {
          bsonType: "array",
          items: { bsonType: "string" }
        },
        createdAt: { bsonType: "date" }
      }
    }
  }
});

// Indexes
db.routes.createIndex({ source: 1, destination: 1, departureDate: 1 });
db.routes.createIndex({ busId: 1 });
db.routes.createIndex({ departureDate: 1 });
```

#### Notifications Collection

```javascript
db.createCollection("notifications", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["customerId", "type", "subject"],
      properties: {
        _id: { bsonType: "objectId" },
        customerId: { bsonType: "objectId" },
        email: { bsonType: "string" },
        type: { enum: ["booking_confirmation", "reminder", "cancellation", "payment_status"] },
        subject: { bsonType: "string" },
        body: { bsonType: "string" },
        status: { enum: ["pending", "sent", "failed"] },
        attempts: { bsonType: "int" },
        maxAttempts: { bsonType: "int" },
        createdAt: { bsonType: "date" },
        sentAt: { bsonType: ["date", "null"] },
        failureReason: { bsonType: ["string", "null"] }
      }
    }
  }
});

// Indexes
db.notifications.createIndex({ customerId: 1, status: 1 });
db.notifications.createIndex({ status: 1, createdAt: 1 });
db.notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL
```

### Validation Rules

| Collection | Field | Validation | Rationale |
|-----------|-------|-----------|-----------|
| users | googleId | Unique, numeric string | Prevent duplicate accounts |
| users | email | Unique, valid email format | Required for contact, prevent duplicates |
| users | name | Required, 1-100 chars | Display name validation |
| bookings | customerId | Required, ObjectId | User isolation enforcement |
| bookings | seats | Array of integers 1-100 | Valid seat numbers |
| bookings | fare | ≥ 0, double | Price cannot be negative |
| bookings | status | Enum: pending, confirmed, in_progress, completed, cancelled | State machine enforcement |
| bookings | paymentMethod | Enum: cash_on_trip, online, card, wallet | Restrict to supported methods |
| routes | departureDate | Future date | Cannot book past trips |
| routes | departureTime | HH:MM format | Valid time validation |

### Migration Strategy

**Phase 1**: Add new fields to existing schemas (backward compatible)
```javascript
// Before migration: bookings without paymentMethod field
db.bookings.updateMany(
  { paymentMethod: { $exists: false } },
  { $set: { paymentMethod: "online", paymentStatus: "completed" } }
);
```

**Phase 2**: Index creation (can be done online with MongoDB Atlas)
```javascript
db.bookings.createIndex({ customerId: 1, departureDate: -1 });
```

**Phase 3**: Backfill booking reference if not present
```javascript
db.bookings.find({ bookingReference: { $exists: false } }).forEach(booking => {
  const ref = "TB" + new Date(booking.createdAt).toISOString().slice(0,10).replace(/-/g, '') + 
              String(booking._id).slice(-3);
  db.bookings.updateOne({ _id: booking._id }, { $set: { bookingReference: ref } });
});
```

---

## Technology Stack Recommendations

### Backend Framework

**Express.js 4.x**
- Chosen for: lightweight, mature, excellent middleware ecosystem
- Middleware chain handles authentication → logging → request processing → error handling
- Body-parser for JSON payload parsing
- CORS middleware for cross-origin requests

**Mongoose 8.x**
- Chosen for: schema validation, convenient query API, middleware hooks
- Schemas define data shape and validation rules
- Model layer abstracts MongoDB queries
- Population feature handles document relationships

### Authentication

**Google OAuth 2.0**
- Use Google's OAuth API for user authentication
- Session storage: sessionStorage with key `"Loggedinuser"`
- Session structure: `{ name, email, picture, id (googleId) }`
- Backend validates googleId exists in database before allowing requests

### Error Handling Pattern

Custom error hierarchy with ErrorHandlerService:
```javascript
Error → ServiceError → ValidationError
                    → AuthenticationError
                    → AuthorizationError
                    → NotFoundError
                    → BusinessRuleError
```

ErrorHandlerService maps each error type to HTTP status code and response format.

### Caching Strategy

**Option 1: Simple Memory Cache** (MVP)
```javascript
const cache = new Map();
const cacheKey = `search:${from}:${to}:${date}`;
if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}
// ... query database ...
cache.set(cacheKey, results);
setTimeout(() => cache.delete(cacheKey), 5 * 60 * 1000); // 5 min TTL
```

**Option 2: Redis** (Future enhancement)
```javascript
const redis = require('redis').createClient();
const cacheKey = `search:${from}:${to}:${date}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);
// ... query database ...
await redis.setex(cacheKey, 300, JSON.stringify(results)); // 5 min TTL
```

**Cache Invalidation**:
- On booking creation: Invalidate search caches for affected bus/date
- Scheduled refresh: Background job every 5 minutes for high-volume routes
- Time-based expiry: 5-minute TTL for all cache entries

### Frontend Architecture

**Angular 17.3.0 Standalone Components**
- Components are self-contained with dependencies declared in `standalone: true`
- Services injected via `providedIn: 'root'` or component providers
- Reactive forms for input validation
- HttpClient for API calls with interceptors for authentication headers

**State Management**:
- Use Angular signals/services for application state
- SessionStorage for user session: `JSON.stringify({ name, email, picture, id })`
- Avoid localStorage for sensitive data

**Authentication Flow**:
```typescript
// app.interceptor.ts
export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandler) {
  const user = JSON.parse(sessionStorage.getItem('Loggedinuser') || '{}');
  if (user.googleId) {
    req = req.clone({
      setHeaders: { 'X-User-Id': user.googleId }
    });
  }
  return next.handle(req);
}
```

### Testing Frameworks

**Unit Tests**: Jest with Supertest for HTTP testing
```javascript
describe('BookingService', () => {
  let service: BookingService;
  let mockRepository: jest.Mocked<BookingRepository>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      // ... other mocks ...
    };
    service = new BookingService(mockRepository, mockBusService, mockNotificationService);
  });

  test('getBookingsByCustomer filters by userId', async () => {
    mockRepository.find.mockResolvedValue([{ customerId: userId }]);
    const result = await service.getBookingsByCustomer(userId);
    expect(mockRepository.find).toHaveBeenCalledWith({ customerId: userId });
    expect(result).toHaveLength(1);
  });
});
```

**Integration Tests**: Supertest with test database
```javascript
describe('POST /bookings', () => {
  it('creates booking and returns 201', async () => {
    const response = await request(app)
      .post('/bookings')
      .set('X-User-Id', testUserId)
      .send(bookingPayload);
    
    expect(response.status).toBe(201);
    expect(response.body.booking.customerId).toBe(testUserId);
  });
});
```

**Property-Based Tests** (fast-check, when applicable):
```javascript
// Generate random bookings and verify invariants
fc.assert(
  fc.property(
    arbitraryBooking(),
    (booking) => {
      const serialized = JSON.stringify(booking);
      const deserialized = JSON.parse(serialized);
      expect(deserialized).toEqual(booking); // Round-trip property
    }
  ),
  { numRuns: 100 }
);
```

### Logging

**Console logging during development**:
```javascript
LoggerService.info('MongoDB connected', { host: 'atlas.mongodb.net' });
LoggerService.error('Booking creation failed', error, { bookingId, userId });
```

**Production logging** (future enhancement):
- Winston or Pino for structured JSON logging
- Log aggregation to ELK stack or cloud logging service
- Performance metrics: API response times, database query times

---

## Error Handling Flow

### Error Categorization

| Category | Code | HTTP Status | Example | Client Action |
|----------|------|-------------|---------|---------------|
| Validation Error | VALIDATION_ERROR | 400 | Invalid email format | Show field-level error |
| Authentication Error | UNAUTHORIZED | 401 | Session expired | Redirect to login |
| Authorization Error | FORBIDDEN | 403 | Access another user's booking | Show permission error |
| Not Found | NOT_FOUND | 404 | Booking ID doesn't exist | Show "not found" message |
| Business Rule Error | BUSINESS_RULE_ERROR | 400 | No seats available | Show availability issue |
| Server Error | INTERNAL_ERROR | 500 | Database connection failed | Show "try again later" |

### Error Propagation Through Layers

```
1. Service Layer (Logic)
   ├─ Detects issue: "Booking customerId !== userId"
   ├─ Throws: AuthorizationError("Cannot access this booking")
   └─ Includes: code: "FORBIDDEN", statusCode: 403

2. Controller Layer (Request Handler)
   ├─ Calls: service.getBooking()
   ├─ Catches error: try/catch or async/await
   ├─ Does NOT format error directly
   └─ Re-throws or returns error object

3. Error Handler Middleware
   ├─ Catches: AuthorizationError
   ├─ Calls: ErrorHandlerService.formatError(error)
   ├─ Formats: { success: false, error: { code, message, statusCode } }
   ├─ Logs: error.message, error.stack, userId context
   └─ Sends response with HTTP 403 status
```

### Client Error Response Transformation

```
Backend Error:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Seats 5, 6 are already booked",
    "statusCode": 400,
    "details": {
      "unavailableSeats": [5, 6]
    }
  }
}

Angular Service (app.service.ts):
├─ HttpClient receives response
├─ HttpErrorResponse interceptor triggered
├─ Check: error.error.code === "VALIDATION_ERROR"
├─ Transform to user message: "Seats 5 and 6 are already booked. Please select different seats."
├─ Pass to: ToastrService.error(message)
└─ User sees: Toast notification with clear message

User sees: "Seats 5 and 6 are already booked. Please select different seats."
```

### Error Recovery Examples

**Insufficient Seats Error**:
```
User Action: Try to book 5 seats
API Response: 400 - "No seats available"
Client Action: 
  1. Disable submit button
  2. Show: "Only X seats available. Select fewer seats or choose different trip."
  3. Enable user to select different date or fewer seats
  4. Auto-refresh available seats count
```

**Network Timeout Error**:
```
User Action: Submit booking (network latency > 30s)
API Response: Timeout
Client Action:
  1. Show: "Request taking longer than expected. Checking status..."
  2. Query: GET /bookings (check if booking was created despite timeout)
  3. If found: Show "Booking created successfully"
  4. If not found: Show "Booking could not be created. Try again."
```

---

## Security Considerations

### JWT Token Structure (Future Enhancement)

While current design uses session-based auth via Google OAuth, future JWT implementation:

```
Header: { "alg": "HS256", "typ": "JWT" }

Payload: {
  "sub": "507f1f77bcf86cd799439011",    // User ID (subject)
  "email": "john@gmail.com",
  "name": "John Doe",
  "iat": 1686355200,                   // Issued at
  "exp": 1686441600,                   // Expires in 24 hours
  "aud": "tedbus-app",                 // Audience
  "iss": "tedbus-auth"                 // Issuer
}

Signature: HMAC_SHA256(base64(header) + "." + base64(payload), SECRET_KEY)
```

**Token Security**:
- Signed with HS256 using strong SECRET_KEY (≥32 bytes)
- Stored in httpOnly cookies (not localStorage)
- Refresh token pattern: issue new token every 24 hours
- Revocation list for compromised tokens

### RBAC Permission Matrix

| Role | List Bookings | Create Booking | View Other Booking | Cancel Booking | View All Bookings | Manage Bus | Manage Routes |
|------|---------------|------------------|-------------------|----------------|------------------|-----------|---------------|
| Customer | Own only | Yes | No | Own only | No | No | No |
| Operator | Own company's | Yes | Own company's | No | No | Yes | Yes |
| Admin | All | Yes | Yes | All | Yes | Yes | Yes |

**Implementation**:
```javascript
// authMiddleware
const permissions = {
  customer: ['list_own_bookings', 'create_booking', 'cancel_own_booking'],
  operator: ['list_company_bookings', 'manage_buses', 'manage_routes'],
  admin: ['list_all_bookings', 'manage_users', 'manage_system']
};

function checkPermission(req, requiredPermission) {
  if (!permissions[req.user.role].includes(requiredPermission)) {
    throw new AuthorizationError();
  }
}
```

### Password Hashing Strategy

**Note**: Current system uses Google OAuth (no passwords stored). For future password support:

```javascript
// user.service.js
const bcrypt = require('bcrypt');

async function registerCustomer(userData) {
  // Hash password before storage
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  
  const user = await User.create({
    email: userData.email,
    passwordHash: hashedPassword,  // Never store plaintext
    name: userData.name
  });
  return user;
}

async function authenticatePassword(email, providedPassword) {
  const user = await User.findOne({ email });
  if (!user) throw new AuthenticationError();
  
  const isValid = await bcrypt.compare(providedPassword, user.passwordHash);
  if (!isValid) throw new AuthenticationError();
  
  return user;
}
```

**Best Practices**:
- Bcrypt with cost factor 10-12
- Never log passwords
- Force password reset on first login
- Enforce password requirements: ≥12 characters, mixed case, numbers, symbols

### PCI-DSS Compliance for Payments

**Note**: Cash on Trip avoids PCI-DSS burden. For future online payments:

1. **Never store card data**:
   ```javascript
   // ❌ WRONG - Never do this
   await Booking.create({
     cardNumber: req.body.cardNumber,  // NEVER!
     cvv: req.body.cvv                 // NEVER!
   });
   
   // ✅ CORRECT - Use payment gateway
   const paymentResult = await stripe.charges.create({
     amount: fare * 100,
     currency: 'usd',
     source: req.body.stripeToken  // Only token, not card
   });
   ```

2. **Use tokenization**: Payment gateways provide tokens, not card numbers

3. **HTTPS everywhere**: All payment endpoints require TLS 1.2+

4. **PCI-DSS scope reduction**: Use hosted payment forms (Stripe Checkout, Razorpay)

### Input Validation Strategy

**Validation at Multiple Layers**:

```javascript
// 1. Frontend validation (UX improvement, not security)
// Angular form validators
seatValidator: [Validators.required, maxSeatsValidator],

// 2. Middleware validation (early rejection)
// Express schema validation
const createBookingSchema = {
  busId: { type: 'string', pattern: '^[a-f0-9]{24}$' },  // MongoDB ObjectId
  seats: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'integer', min: 1, max: 100 } },
  fare: { type: 'number', minimum: 0, maximum: 10000 }
};

// 3. Service layer validation (business logic)
// BookingService.validateBookingData()
function validateBookingData(data) {
  if (!Array.isArray(data.seats)) throw new ValidationError('Seats must be array');
  if (data.seats.length > 10) throw new ValidationError('Maximum 10 seats per booking');
  if (data.fare < 0) throw new ValidationError('Fare cannot be negative');
}

// 4. Database validation (schema enforcement)
// MongoDB schema validation on write
bookingSchema: {
  fare: { type: Double, minimum: 0 },
  seats: { type: Array, items: { type: Integer, min: 1, max: 100 } }
}
```

**Validation Rules by Field**:

| Field | Type | Rules | Example |
|-------|------|-------|---------|
| email | string | Match RFC 5322, unique | john@gmail.com |
| phone | string | Valid format, 10-15 digits | +1234567890 |
| seats | array | 1-10 items, integers 1-100 | [12, 13, 14] |
| fare | number | ≥ 0, ≤ 10000, 2 decimals | 45.99 |
| name | string | 1-100 chars, no special chars | John Doe |
| date | string | ISO 8601 format, future date | 2024-06-15 |

### CORS and Rate Limiting

**CORS Configuration**:
```javascript
const cors = require('cors');

app.use(cors({
  origin: ['http://localhost:4200', 'https://tedbus.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-User-Id']
}));
```

**Rate Limiting** (future enhancement):
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                  // 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,                    // 5 login attempts per 15 min
  skipSuccessfulRequests: true
});

app.use('/api/', limiter);
app.use('/auth/login', authLimiter);
```

---

## Performance Optimization

### Caching Layers and Invalidation Strategy

**Layer 1: Query Results Cache** (5-minute TTL)
```javascript
// Cache search results
searchCache = new Map();

async function search(from, to, date) {
  const key = `search:${from}:${to}:${date}`;
  
  // Check cache
  if (searchCache.has(key)) {
    logger.debug('Cache hit', { key });
    return searchCache.get(key);
  }
  
  // Query database
  logger.debug('Cache miss', { key });
  const results = await queryBuses(from, to, date);
  
  // Store in cache with TTL
  searchCache.set(key, results);
  setTimeout(() => searchCache.delete(key), 5 * 60 * 1000);
  
  return results;
}

// Invalidation: After booking created
function createBooking(bookingData) {
  // ... create booking ...
  
  // Invalidate affected caches
  const affectedKeys = [
    `search:${booking.source}:${booking.destination}:${booking.date}`,
    `bus:${booking.busId}:${booking.date}`
  ];
  affectedKeys.forEach(key => searchCache.delete(key));
}
```

**Layer 2: Database Connection Pooling**
```javascript
mongoose.connect(DBURL, {
  maxPoolSize: 10,           // Connection pool size
  minPoolSize: 5,
  maxIdleTimeMS: 45000
});
```

**Layer 3: HTTP Caching Headers** (future CDN)
```javascript
app.use((req, res, next) => {
  // Cache search results in CDN for 5 minutes
  if (req.path === '/buses/search') {
    res.set('Cache-Control', 'public, max-age=300');
  }
  
  // Never cache user-specific data
  if (req.path === '/bookings/my') {
    res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  }
  
  next();
});
```

### Database Indexing Strategy

**Hot Path Queries** (require indexes):

1. **User Bookings Retrieval** (every profile load)
   ```javascript
   // Query: db.bookings.find({ customerId: userId }).sort({ departureDate: -1 })
   // Index: { customerId: 1, departureDate: -1 }
   db.bookings.createIndex({ customerId: 1, departureDate: -1 });
   ```

2. **Search Buses**
   ```javascript
   // Query: db.routes.find({ source, destination, departureDate })
   // Index: { source: 1, destination: 1, departureDate: 1 }
   db.routes.createIndex({ source: 1, destination: 1, departureDate: 1 });
   ```

3. **Bus Availability Check**
   ```javascript
   // Query: db.bookings.find({ busId, departureDate, status: "confirmed" })
   // Index: { busId: 1, departureDate: 1, status: 1 }
   db.bookings.createIndex({ busId: 1, departureDate: 1, status: 1 });
   ```

4. **Unique Constraints**
   ```javascript
   // Prevent duplicate users and bookings
   db.users.createIndex({ email: 1 }, { unique: true });
   db.bookings.createIndex({ bookingReference: 1 }, { unique: true });
   ```

### Query Optimization Approaches

**1. Lean Queries** (when mutations not needed):
```javascript
// ❌ SLOW: Returns full Mongoose documents
const bookings = await Booking.find({ customerId }).exec();

// ✅ FAST: Returns plain JavaScript objects
const bookings = await Booking.find({ customerId }).lean().exec();
```

**2. Select Projection** (fetch only needed fields):
```javascript
// ❌ SLOW: Returns all fields
const bookings = await Booking.find({ customerId });

// ✅ FAST: Return only needed fields
const bookings = await Booking
  .find({ customerId })
  .select('bookingReference seats fare status departureDate')
  .lean();
```

**3. Pagination** (prevent loading all records):
```javascript
// ❌ SLOW: Load all bookings
const bookings = await Booking.find({ customerId });

// ✅ FAST: Load only current page
const page = req.query.page || 1;
const limit = req.query.limit || 10;
const skip = (page - 1) * limit;

const bookings = await Booking
  .find({ customerId })
  .sort({ departureDate: -1 })
  .skip(skip)
  .limit(limit)
  .lean();
```

### N+1 Query Prevention with Populate Strategy

**N+1 Problem**:
```javascript
// ❌ CAUSES N+1 QUERIES
const bookings = await Booking.find({ customerId }).lean();
for (let booking of bookings) {
  booking.bus = await Bus.findById(booking.busId);  // Query per booking!
}
// Total: 1 + N queries (expensive)
```

**Solution: Aggregate Lookup**:
```javascript
// ✅ PREVENTS N+1: Single query with lookup
const bookings = await Booking.aggregate([
  { $match: { customerId: mongoose.Types.ObjectId(userId) } },
  { $sort: { departureDate: -1 } },
  {
    $lookup: {
      from: 'buses',
      localField: 'busId',
      foreignField: '_id',
      as: 'busDetails'
    }
  },
  { $unwind: '$busDetails' },
  {
    $project: {
      bookingReference: 1,
      seats: 1,
      fare: 1,
      status: 1,
      'busDetails.operatorName': 1,
      'busDetails.busType': 1
    }
  }
]);
// Total: 1 query (efficient)
```

### Pagination Strategy

**Cursor-based Pagination** (more efficient):
```javascript
// Request: GET /bookings/my?cursor=507f1f77bcf86cd799439011&limit=10

async function getBookingsPaginated(userId, cursor, limit = 10) {
  const query = { customerId: userId };
  
  // If cursor provided, fetch records after cursor
  if (cursor) {
    query._id = { $lt: mongoose.Types.ObjectId(cursor) };
  }
  
  const bookings = await Booking
    .find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();
  
  const hasMore = bookings.length > limit;
  const results = hasMore ? bookings.slice(0, limit) : bookings;
  const nextCursor = hasMore ? results[results.length - 1]._id : null;
  
  return { results, nextCursor, hasMore };
}

// Response:
{
  data: [...bookings...],
  pagination: {
    nextCursor: "507f1f77bcf86cd799439010",
    hasMore: true
  }
}

// Next request: GET /bookings/my?cursor=507f1f77bcf86cd799439010&limit=10
```

---

## Testing Strategy Pyramid

### Unit Test Structure and Mocking Strategy

**Unit Test Scope**: Test service methods in isolation with mocked dependencies.

```javascript
// test/unit/services/booking.service.test.js

describe('BookingService', () => {
  let bookingService;
  let mockBookingRepository;
  let mockBusService;
  let mockNotificationService;

  beforeEach(() => {
    // Create mocks with Jest
    mockBookingRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      updateStatus: jest.fn()
    };

    mockBusService = {
      reserveSeats: jest.fn(),
      releaseSeats: jest.fn(),
      checkAvailability: jest.fn()
    };

    mockNotificationService = {
      sendBookingConfirmation: jest.fn()
    };

    // Inject mocks
    bookingService = new BookingService(
      mockBookingRepository,
      mockBusService,
      mockNotificationService
    );
  });

  describe('createBooking', () => {
    test('creates booking with cash_on_trip payment method', async () => {
      // Arrange
      const userId = 'user123';
      const bookingData = {
        busId: 'bus001',
        seats: [10, 11],
        fare: 100,
        paymentMethod: 'cash_on_trip'
      };

      mockBookingRepository.create.mockResolvedValue({
        _id: 'booking123',
        ...bookingData,
        customerId: userId,
        status: 'confirmed'
      });

      // Act
      const result = await bookingService.createBooking(userId, bookingData);

      // Assert
      expect(mockBookingRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: userId,
          paymentMethod: 'cash_on_trip',
          status: 'confirmed'
        })
      );
      expect(result.status).toBe('confirmed');
    });

    test('throws ValidationError if seats invalid', async () => {
      // Arrange
      const bookingData = { seats: [], fare: 100 };

      // Act & Assert
      await expect(
        bookingService.createBooking('user123', bookingData)
      ).rejects.toThrow(ValidationError);
    });

    test('reserves seats via BusService', async () => {
      // Arrange
      const bookingData = {
        busId: 'bus001',
        seats: [10, 11],
        fare: 100,
        paymentMethod: 'cash_on_trip',
        departureDate: '2024-06-15'
      };

      mockBusService.reserveSeats.mockResolvedValue({ success: true });
      mockBookingRepository.create.mockResolvedValue({ _id: 'booking123' });

      // Act
      await bookingService.createBooking('user123', bookingData);

      // Assert
      expect(mockBusService.reserveSeats).toHaveBeenCalledWith(
        'bus001',
        [10, 11],
        '2024-06-15'
      );
    });
  });

  describe('getBookingsByCustomer', () => {
    test('filters bookings by userId', async () => {
      // Arrange
      const userId = 'user123';
      const mockBookings = [
        { _id: 'booking1', customerId: userId },
        { _id: 'booking2', customerId: userId }
      ];

      mockBookingRepository.find.mockResolvedValue(mockBookings);

      // Act
      const result = await bookingService.getBookingsByCustomer(userId);

      // Assert
      expect(mockBookingRepository.find).toHaveBeenCalledWith({
        customerId: userId
      });
      expect(result).toEqual(mockBookings);
    });

    test('enforces user isolation - does not expose other users bookings', async () => {
      // This is more of an integration test, but documents the security requirement
      const userId = 'user123';
      const otherUserId = 'user456';

      mockBookingRepository.find.mockResolvedValue([]);

      // Should not include bookings from other users
      const result = await bookingService.getBookingsByCustomer(userId);

      expect(mockBookingRepository.find).toHaveBeenCalledWith({
        customerId: userId  // Only this userId, not all users
      });
    });
  });
});
```

**Mocking Best Practices**:
- Mock external dependencies (database, email, payment gateway)
- Create fixtures for common test data
- Use `jest.fn()` to track calls and return values
- Test both success and failure paths

### Integration Test Database Setup

**Integration Test Scope**: Test multiple services together with a test database.

```javascript
// test/integration/setup.js

const mongoose = require('mongoose');

// Use test MongoDB instance
const TEST_DB_URI = 'mongodb://localhost:27017/tedbus_test';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URI);
  console.log('Test database connected');
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  // Clear all collections before each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// test/integration/booking.integration.test.js

describe('Booking API Integration', () => {
  let request;
  let app;

  beforeAll(async () => {
    app = require('../../server/index');
    request = require('supertest')(app);
  });

  test('POST /bookings creates booking with user isolation', async () => {
    // Create two users
    const user1 = await User.create({
      googleId: 'google1',
      email: 'user1@example.com'
    });

    const user2 = await User.create({
      googleId: 'google2',
      email: 'user2@example.com'
    });

    // User 1 creates booking
    const response = await request
      .post('/bookings')
      .set('X-User-Id', user1.googleId)
      .send({
        busId: 'bus123',
        seats: [10, 11],
        fare: 100,
        paymentMethod: 'cash_on_trip'
      });

    expect(response.status).toBe(201);
    expect(response.body.booking.customerId).toBe(user1._id.toString());

    // User 2 tries to retrieve user 1's booking
    const getResponse = await request
      .get(`/bookings/${response.body.booking._id}`)
      .set('X-User-Id', user2.googleId);

    expect(getResponse.status).toBe(403);
    expect(getResponse.body.error.code).toBe('FORBIDDEN');
  });

  test('GET /bookings/my returns only authenticated user bookings', async () => {
    // Create user and bookings
    const user = await User.create({
      googleId: 'google123',
      email: 'user@example.com'
    });

    await Booking.create({
      customerId: user._id,
      busId: 'bus1',
      status: 'confirmed'
    });

    await Booking.create({
      customerId: new mongoose.Types.ObjectId(), // Different user
      busId: 'bus2',
      status: 'confirmed'
    });

    // Request user's bookings
    const response = await request
      .get('/bookings/my')
      .set('X-User-Id', user.googleId);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].customerId).toBe(user._id.toString());
  });
});
```

### Property-Based Test Approach

**When to use**: For serialization round-trips, data transformations, and algorithmic correctness.

```javascript
// test/property-based/booking.property.test.js

const fc = require('fast-check');

describe('Booking Serialization (Property-Based)', () => {
  // Generator for valid bookings
  const arbitraryBooking = () =>
    fc.record({
      busId: fc.hexadecimal({ minLength: 24, maxLength: 24 }),
      seats: fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 5 }),
      fare: fc.tuple(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 0, max: 99 })
      ).map(([dollars, cents]) => dollars + cents / 100),
      paymentMethod: fc.constantFrom('cash_on_trip', 'online'),
      status: fc.constantFrom('pending', 'confirmed', 'completed')
    });

  test('Serialization round-trip preserves booking data', () => {
    fc.assert(
      fc.property(arbitraryBooking(), (booking) => {
        // Serialize to JSON and back
        const serialized = JSON.stringify(booking);
        const deserialized = JSON.parse(serialized);

        // Assert data preservation
        expect(deserialized).toEqual(booking);
        expect(deserialized.busId).toBe(booking.busId);
        expect(deserialized.fare).toBeCloseTo(booking.fare, 2);
      }),
      { numRuns: 100 }
    );
  });

  test('Booking status transitions follow valid state machine', () => {
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: []
    };

    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(validTransitions)),
        (currentStatus) => {
          const nextStatuses = validTransitions[currentStatus];
          // Assert that state machine is correctly enforced
          expect(Array.isArray(nextStatuses)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});
```

### E2E Test Scenarios

**E2E Test Scope**: Test complete user workflows through UI and API.

```javascript
// test/e2e/booking.e2e.test.js

describe('End-to-End: Complete Booking Workflow', () => {
  let browser;
  let driver;

  beforeAll(async () => {
    // Use Playwright, Cypress, or Selenium
    browser = await chromium.launch();
    driver = browser.newContext();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('User can complete cash-on-trip booking workflow', async () => {
    const page = await driver.newPage();

    // Step 1: Navigate to home and search buses
    await page.goto('http://localhost:4200');
    await page.fill('[data-testid="source"]', 'New York');
    await page.fill('[data-testid="destination"]', 'Boston');
    await page.fill('[data-testid="date"]', '2024-06-15');
    await page.click('[data-testid="search-btn"]');

    // Step 2: Verify search results displayed
    await page.waitForSelector('[data-testid="bus-card"]');
    const busCards = await page.locator('[data-testid="bus-card"]').count();
    expect(busCards).toBeGreaterThan(0);

    // Step 3: Select first bus and seats
    await page.click('[data-testid="bus-card"]:first-child [data-testid="select-btn"]');
    await page.click('[data-testid="seat-10"]'); // Select seat 10
    await page.click('[data-testid="seat-11"]'); // Select seat 11
    await page.click('[data-testid="continue-btn"]');

    // Step 4: Enter passenger details
    await page.fill('[data-testid="passenger-name-0"]', 'John Doe');
    await page.fill('[data-testid="passenger-email-0"]', 'john@example.com');
    await page.click('[data-testid="continue-btn"]');

    // Step 5: Select "Cash on Trip" payment
    await page.click('[data-testid="payment-cash-on-trip"]');
    expect(await page.isVisible('[data-testid="card-fields"]')).toBeFalsy(); // Card fields hidden

    // Step 6: Submit booking
    await page.click('[data-testid="confirm-booking-btn"]');

    // Step 7: Verify confirmation
    await page.waitForSelector('[data-testid="confirmation-message"]');
    const confirmText = await page.locator('[data-testid="confirmation-message"]').textContent();
    expect(confirmText).toContain('Trip booked successfully');

    // Step 8: Verify booking appears in profile
    await page.click('[data-testid="nav-profile"]');
    const bookingElements = await page.locator('[data-testid="booking-card"]').count();
    expect(bookingElements).toBeGreaterThan(0);

    await page.close();
  });

  test('User cannot access another users booking', async () => {
    // Create two test users and verify isolation
    const page = await driver.newPage();

    // User 1 creates booking
    await page.goto('http://localhost:4200');
    // ... create booking ...
    const bookingId = 'some-booking-id'; // Extract from response

    // User 1 logs out
    await page.click('[data-testid="logout-btn"]');

    // User 2 logs in
    await login('user2@example.com');

    // User 2 tries to access User 1's booking via URL
    await page.goto(`http://localhost:4200/bookings/${bookingId}`);

    // Should see "Not Found" or permission error
    await page.waitForSelector('[data-testid="error-message"]');
    const errorMsg = await page.locator('[data-testid="error-message"]').textContent();
    expect(errorMsg).toContain('not found' | 'not authorized');
  });
});
```

### Testing Pyramid Summary

```
        /\
       /  \
      / E2E \           5-10% of tests
     /______\
    /        \
   /Integration\        15-25% of tests
  /____________\
 /              \
/ Unit Tests &   \     65-80% of tests
/ Property Tests  \
/________________\
```

---

## Implementation Pseudocode

### Booking Service Creation Example

```
SERVICE: BookingService

DEPENDENCIES:
  - BookingRepository
  - BusService
  - NotificationService
  - ErrorHandlerService

METHOD: createBooking(userId, bookingData)
  VALIDATE bookingData.seats is array with 1-10 items
  VALIDATE each seat number is 1-100
  VALIDATE bookingData.fare > 0
  VALIDATE paymentMethod is "cash_on_trip", "online", or "card"
  
  IF validation fails
    THROW ValidationError with field-specific details
  
  // Attempt to reserve seats (atomic operation)
  TRY
    CALL BusService.reserveSeats(
      busId=bookingData.busId,
      seats=bookingData.seats,
      date=bookingData.departureDate
    )
  CATCH InsufficientSeatsError
    THROW BusinessRuleError("Requested seats no longer available")
  
  // Create booking record
  CREATE booking object:
    customerId = userId  // CRITICAL: Use authenticated userId, not client-provided
    busId = bookingData.busId
    seats = bookingData.seats
    fare = bookingData.fare
    paymentMethod = bookingData.paymentMethod
    status = "pending"
    createdAt = now
  
  // Handle different payment methods
  IF paymentMethod == "cash_on_trip"
    SET booking.status = "confirmed"
    SET booking.paymentStatus = "pending"
    SKIP payment processing
  ELSE IF paymentMethod == "online" or "card"
    CALL PaymentService.processPayment(booking)
    IF payment fails
      CALL BusService.releaseSeats()  // Rollback
      THROW PaymentError
    SET booking.status = "confirmed"
    SET booking.paymentStatus = "completed"
  
  // Save to database
  CALL BookingRepository.create(booking)
  
  // Send notification (async, don't wait)
  CALL NotificationService.sendBookingConfirmation(booking, customerData)
  
  // Invalidate search cache
  CALL SearchService.invalidateCache(from, to, date)
  
  RETURN booking object with id and reference

METHOD: getBookingsByCustomer(userId, options={})
  // CRITICAL: Filter by userId on server side
  QUERY = { customerId: userId }
  
  // Apply pagination
  SKIP = (options.page - 1) * options.limit
  LIMIT = options.limit || 10
  
  // Sort by upcoming trips first
  SORT = { departureDate: -1 }
  
  CALL BookingRepository.find(QUERY)
    .sort(SORT)
    .skip(SKIP)
    .limit(LIMIT)
    .populate(busDetails, routeDetails)
    .lean()
  
  IF no bookings found
    RETURN empty array (not an error)
  
  RETURN bookings array

METHOD: cancelBooking(bookingId, userId)
  CALL BookingRepository.findById(bookingId)
  
  IF booking not found
    THROW NotFoundError("Booking not found")
  
  // Verify user ownership (CRITICAL for user isolation)
  IF booking.customerId !== userId
    THROW AuthorizationError("Cannot access this booking")
  
  // Check if cancellation allowed
  IF booking.status == "completed" or "cancelled"
    THROW BusinessRuleError("Cannot cancel this booking")
  
  IF booking.status == "in_progress"
    THROW BusinessRuleError("Trip already started")
  
  // Calculate refund
  REFUND_PERCENTAGE = 0.85  // Example: 15% cancellation fee
  refundAmount = booking.fare * REFUND_PERCENTAGE
  cancellationCharge = booking.fare - refundAmount
  
  // Release seats back to bus
  CALL BusService.releaseSeats(
    busId=booking.busId,
    seats=booking.seats,
    date=booking.departureDate
  )
  
  // Update booking
  SET booking.status = "cancelled"
  SET booking.cancelledAt = now
  SET booking.refundAmount = refundAmount
  CALL BookingRepository.update(booking)
  
  // Notify customer
  CALL NotificationService.sendCancellationNotification(booking)
  
  RETURN cancellation details with refund info
```

### Error Handler Service Example

```
SERVICE: ErrorHandlerService

METHOD: formatError(error, customStatusCode=null)
  // Determine error category and HTTP status
  statusCode = customStatusCode || categorizeError(error).statusCode
  
  IF error instanceof ValidationError
    errorCode = "VALIDATION_ERROR"
    statusCode = 400
    details = error.details
  ELSE IF error instanceof AuthenticationError
    errorCode = "UNAUTHORIZED"
    statusCode = 401
    details = { reason: error.message }
  ELSE IF error instanceof AuthorizationError
    errorCode = "FORBIDDEN"
    statusCode = 403
    details = { reason: error.message }
  ELSE IF error instanceof NotFoundError
    errorCode = "NOT_FOUND"
    statusCode = 404
    details = { resource: error.resource }
  ELSE IF error instanceof BusinessRuleError
    errorCode = error.code
    statusCode = 400
    details = { reason: error.message }
  ELSE  // Generic error
    errorCode = "INTERNAL_ERROR"
    statusCode = 500
    details = null
    LoggerService.error("Unhandled error", error)
  
  RETURN {
    success: false,
    error: {
      code: errorCode,
      message: error.message,
      statusCode: statusCode,
      details: details
    }
  }

METHOD: logError(error, context={})
  LOG level = "ERROR"
  LOG message = error.message
  LOG stack = error.stack
  LOG context = {
    userId: context.userId,
    path: context.path,
    timestamp: now,
    errorCode: error.code || "UNKNOWN"
  }
  
  // Send to error tracking service (Sentry, etc.)
  IF process.env.NODE_ENV == "production"
    CALL ErrorTrackingService.captureException(error, context)
```

---

## Architecture Decisions Rationale

### Why Service-Oriented Architecture?

1. **Testability**: Services with injected dependencies enable comprehensive unit testing with mocks
2. **Reusability**: Services encapsulate domain logic that can be used across multiple controllers
3. **Maintainability**: Clear separation of concerns makes code changes localized and understood
4. **Scalability**: Services can be moved to separate microservices later without code restructuring

### Why Layer Separation?

- **Controllers**: Handle HTTP concerns (parsing, routing, responding)
- **Services**: Contain business logic (validation, workflows, state management)
- **Repositories**: Abstract data access (queries, persistence, optimization)
- This structure enables testing services independently of HTTP/database concerns

### Why User Isolation at Server Level?

- **Security**: Client-side filtering is not secure; users can manipulate JavaScript
- **Compliance**: PCI-DSS and data protection regulations require server-side enforcement
- **Robustness**: Network interception cannot expose other users' data

### Why Cash on Trip?

- Simplifies payment processing (no online payments initially)
- Reduces PCI-DSS compliance burden
- Meets user requirement to "pay when boarding"
- Allows booking confirmation before payment

### Why Structured Errors?

- **Consistency**: Clients can rely on predictable error format
- **Debugging**: Error codes enable targeted troubleshooting
- **UX**: Clients can display field-specific errors to users
- **Monitoring**: Error codes enable analytics and alerting

---

## Future Enhancements

This design supports future additions:

1. **Microservices**: Extract services into separate processes with message queues
2. **Advanced Caching**: Replace in-memory Map with Redis for distributed caching
3. **Real-time Notifications**: WebSockets for live seat availability updates
4. **Admin Dashboard**: New services for reporting and monitoring
5. **Mobile Apps**: Same API serves web and mobile clients
6. **Payment Gateways**: Stripe/Razorpay integration via PaymentService
7. **Email Templates**: Improved notification formatting with templates
8. **Audit Logging**: Track all user actions for compliance

---

## Data Models

### MongoDB Collections Schema Definitions

#### Users Collection

**Purpose**: Store customer profiles with authentication and preferences.

**Schema**:
```javascript
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["googleId", "email", "name", "createdAt"],
      properties: {
        _id: { 
          bsonType: "objectId",
          description: "Primary key - MongoDB auto-generated"
        },
        googleId: { 
          bsonType: "string",
          pattern: "^[0-9]+$",
          description: "Unique Google OAuth ID from authentication"
        },
        email: { 
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "User email address - used for notifications"
        },
        name: { 
          bsonType: "string",
          minLength: 1,
          maxLength: 100,
          description: "User full name"
        },
        picture: { 
          bsonType: "string",
          description: "Profile picture URL from Google"
        },
        phone: { 
          bsonType: ["string", "null"],
          description: "Contact phone number (optional)"
        },
        preferences: {
          bsonType: ["object", "null"],
          properties: {
            seatPreference: { 
              enum: ["window", "aisle", "any"],
              description: "Preferred seat location in bus"
            },
            mealPreference: { 
              enum: ["vegetarian", "non-vegetarian", "vegan", "any"],
              description: "Dietary preference for on-trip meals"
            },
            notificationsEnabled: { 
              bsonType: "bool",
              description: "Opt-in for email notifications"
            }
          },
          description: "User travel preferences"
        },
        createdAt: { 
          bsonType: "date",
          description: "Account creation timestamp"
        },
        updatedAt: { 
          bsonType: "date",
          description: "Last profile update timestamp"
        }
      }
    }
  }
});
```

**Indexes**:
```javascript
// User lookup during authentication
db.users.createIndex({ googleId: 1 }, { unique: true, sparse: false });

// Email validation during registration
db.users.createIndex({ email: 1 }, { unique: true, sparse: false });

// Find recent registrations
db.users.createIndex({ createdAt: -1 });
```

**Validation Rules**:
| Field | Rule | Purpose |
|-------|------|---------|
| googleId | Unique, numeric | Prevent duplicate accounts via OAuth |
| email | Unique, RFC 5322 format | Prevent duplicate registrations, contact |
| name | Required, 1-100 chars | Display validation |
| phone | Optional | Contact information |

---

#### Bookings Collection

**Purpose**: Store all booking records with complete lifecycle tracking.

**Schema**:
```javascript
db.createCollection("bookings", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "customerId", "busId", "routeId", "seats", 
        "fare", "status", "paymentMethod", "departureDate", "createdAt"
      ],
      properties: {
        _id: { 
          bsonType: "objectId",
          description: "Primary key"
        },
        customerId: { 
          bsonType: "objectId",
          description: "Reference to User._id - USER ISOLATION KEY"
        },
        busId: { 
          bsonType: "objectId",
          description: "Reference to Bus._id"
        },
        routeId: { 
          bsonType: "objectId",
          description: "Reference to Route._id"
        },
        bookingReference: { 
          bsonType: "string",
          pattern: "^TB[0-9]{8}[0-9]{3}$",
          description: "Human-readable booking reference (e.g., TB202406150001)"
        },
        seats: {
          bsonType: "array",
          minItems: 1,
          maxItems: 10,
          items: { 
            bsonType: "int",
            minimum: 1,
            maximum: 100
          },
          description: "Array of seat numbers reserved"
        },
        passengers: {
          bsonType: "array",
          minItems: 1,
          items: {
            bsonType: "object",
            required: ["name", "seat"],
            properties: {
              name: { 
                bsonType: "string",
                minLength: 1,
                maxLength: 100
              },
              email: { 
                bsonType: "string"
              },
              phone: { 
                bsonType: "string"
              },
              age: { 
                bsonType: "int",
                minimum: 1,
                maximum: 150
              },
              seat: { 
                bsonType: "int",
                minimum: 1,
                maximum: 100,
                description: "Assigned seat number for this passenger"
              }
            }
          },
          description: "List of passengers with seat assignments"
        },
        fare: { 
          bsonType: "double",
          minimum: 0,
          description: "Total booking fare in currency units"
        },
        paymentMethod: { 
          enum: ["cash_on_trip", "online", "card", "wallet"],
          description: "How customer will pay"
        },
        paymentStatus: { 
          enum: ["pending", "completed", "failed", "refunded"],
          description: "Current payment state"
        },
        status: { 
          enum: ["pending", "confirmed", "in_progress", "completed", "cancelled"],
          description: "Booking lifecycle state"
        },
        departureDate: { 
          bsonType: "date",
          description: "Trip departure date"
        },
        cancellationCharge: { 
          bsonType: ["double", "null"],
          minimum: 0,
          description: "Amount deducted for cancellation"
        },
        refundAmount: { 
          bsonType: ["double", "null"],
          minimum: 0,
          description: "Amount refunded to customer"
        },
        createdAt: { 
          bsonType: "date",
          description: "Booking creation timestamp"
        },
        updatedAt: { 
          bsonType: "date",
          description: "Last status update timestamp"
        },
        cancelledAt: { 
          bsonType: ["date", "null"],
          description: "Cancellation timestamp if applicable"
        }
      }
    }
  }
});
```

**Indexes** (Query optimization):
```javascript
// Hot path: Get user's bookings
db.bookings.createIndex(
  { customerId: 1, departureDate: -1 },
  { name: "idx_user_bookings" }
);

// Query: Check bus occupancy for availability
db.bookings.createIndex(
  { busId: 1, departureDate: 1, status: 1 },
  { name: "idx_bus_occupancy" }
);

// Query: Upcoming trips for notifications
db.bookings.createIndex(
  { status: 1, departureDate: 1 },
  { name: "idx_upcoming_trips" }
);

// Booking reference lookup
db.bookings.createIndex(
  { bookingReference: 1 },
  { unique: true, name: "idx_booking_reference" }
);

// Recent bookings for admin
db.bookings.createIndex(
  { createdAt: -1 },
  { name: "idx_recent_bookings" }
);
```

**Status State Machine**:
```
                PENDING ──────────► CONFIRMED
                  │                    │
                  │                    ▼
                  │             IN_PROGRESS ──────► COMPLETED
                  │                    │
                  └───────────────────┬┘
                                      │
                                      ▼
                                 CANCELLED

Valid Transitions:
- pending → confirmed: After payment or cash_on_trip selection
- confirmed → in_progress: When trip starts (automatic)
- in_progress → completed: When trip ends (automatic)
- pending → cancelled: User cancels before confirmation
- confirmed → cancelled: User cancels after confirmation
- in_progress → cancelled: NOT ALLOWED (trip has started)
- completed → cancelled: NOT ALLOWED (trip finished)
```

---

#### Buses Collection

**Purpose**: Store bus inventory with operational details.

**Schema**:
```javascript
db.createCollection("buses", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["operatorName", "busType", "totalSeats", "routes", "createdAt"],
      properties: {
        _id: { 
          bsonType: "objectId",
          description: "Primary key"
        },
        operatorName: { 
          bsonType: "string",
          minLength: 1,
          maxLength: 100,
          description: "Bus operator/company name"
        },
        busType: { 
          enum: ["AC", "Non-AC", "Sleeper", "Semi-Sleeper"],
          description: "Bus category affecting pricing and comfort"
        },
        totalSeats: { 
          bsonType: "int",
          minimum: 1,
          maximum: 100,
          description: "Total passenger capacity"
        },
        amenities: {
          bsonType: ["array", "null"],
          items: { 
            bsonType: "string"
          },
          description: "Array of amenities: WiFi, USB, Blanket, Pillow, etc."
        },
        rating: { 
          bsonType: ["double", "null"],
          minimum: 0,
          maximum: 5,
          description: "Average customer rating"
        },
        routes: {
          bsonType: "array",
          items: { 
            bsonType: "objectId"
          },
          minItems: 1,
          description: "Array of Route._id this bus services"
        },
        operatorContact: { 
          bsonType: ["string", "null"],
          description: "Operator phone/email for support"
        },
        createdAt: { 
          bsonType: "date",
          description: "Bus record creation timestamp"
        }
      }
    }
  }
});
```

**Indexes**:
```javascript
// Find buses by operator
db.buses.createIndex({ operatorName: 1 });

// Filter by bus type during search
db.buses.createIndex({ busType: 1 });

// Find buses on specific routes
db.buses.createIndex({ routes: 1 });
```

---

#### Routes Collection

**Purpose**: Store route definitions with timing and pricing.

**Schema**:
```javascript
db.createCollection("routes", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "source", "destination", "departureDate", 
        "departureTime", "arrivalTime", "busId", "fare", "createdAt"
      ],
      properties: {
        _id: { 
          bsonType: "objectId",
          description: "Primary key"
        },
        source: { 
          bsonType: "string",
          minLength: 1,
          maxLength: 100,
          description: "Starting city/location"
        },
        destination: { 
          bsonType: "string",
          minLength: 1,
          maxLength: 100,
          description: "Ending city/location"
        },
        departureTime: { 
          bsonType: "string",
          pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$",
          description: "Trip start time in HH:MM format (24-hour)"
        },
        arrivalTime: { 
          bsonType: "string",
          pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$",
          description: "Estimated arrival time in HH:MM format"
        },
        departureDate: { 
          bsonType: "date",
          description: "Trip date - must be in future"
        },
        distance: { 
          bsonType: ["double", "null"],
          minimum: 0,
          description: "Distance in kilometers"
        },
        duration: { 
          bsonType: ["string", "null"],
          pattern: "^\\d+h\\s\\d+m$",
          description: "Expected travel duration (e.g., '6h 30m')"
        },
        busId: { 
          bsonType: "objectId",
          description: "Reference to Bus._id"
        },
        fare: { 
          bsonType: "double",
          minimum: 0,
          description: "Base fare per passenger"
        },
        stoppingPoints: {
          bsonType: ["array", "null"],
          items: { 
            bsonType: "string"
          },
          description: "Intermediate stops on route"
        },
        createdAt: { 
          bsonType: "date",
          description: "Route record creation timestamp"
        }
      }
    }
  }
});
```

**Indexes** (Hot path queries):
```javascript
// Primary search: Find routes by source/destination/date
db.routes.createIndex(
  { source: 1, destination: 1, departureDate: 1 },
  { name: "idx_route_search" }
);

// Find all routes for a specific bus
db.routes.createIndex({ busId: 1 }, { name: "idx_bus_routes" });

// Find upcoming routes
db.routes.createIndex({ departureDate: 1 }, { name: "idx_upcoming_routes" });
```

---

#### Notifications Collection

**Purpose**: Queue and track email/in-app notifications.

**Schema**:
```javascript
db.createCollection("notifications", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["customerId", "type", "subject", "status", "createdAt"],
      properties: {
        _id: { 
          bsonType: "objectId",
          description: "Primary key"
        },
        customerId: { 
          bsonType: "objectId",
          description: "Reference to User._id - recipient"
        },
        email: { 
          bsonType: "string",
          description: "Email address to send to"
        },
        type: { 
          enum: ["booking_confirmation", "reminder", "cancellation", "payment_status"],
          description: "Notification type/template"
        },
        subject: { 
          bsonType: "string",
          minLength: 1,
          maxLength: 200,
          description: "Email subject line"
        },
        body: { 
          bsonType: "string",
          description: "Email body (HTML or plain text)"
        },
        status: { 
          enum: ["pending", "sent", "failed"],
          description: "Current sending status"
        },
        attempts: { 
          bsonType: "int",
          minimum: 0,
          description: "Number of send attempts"
        },
        maxAttempts: { 
          bsonType: "int",
          minimum: 1,
          description: "Maximum retry attempts before failing"
        },
        createdAt: { 
          bsonType: "date",
          description: "Notification queued timestamp"
        },
        sentAt: { 
          bsonType: ["date", "null"],
          description: "Successfully sent timestamp"
        },
        failureReason: { 
          bsonType: ["string", "null"],
          description: "Error message if sending failed"
        }
      }
    }
  }
});
```

**Indexes**:
```javascript
// Find pending notifications for async worker
db.notifications.createIndex(
  { status: 1, createdAt: 1 },
  { name: "idx_pending_notifications" }
);

// Find user's notifications
db.notifications.createIndex(
  { customerId: 1, status: 1 },
  { name: "idx_user_notifications" }
);

// Auto-delete old notifications after 90 days
db.notifications.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 7776000, name: "idx_ttl_notifications" }
);
```

---

### Entity Relationship Diagram

```
┌──────────────┐
│    USERS     │
├──────────────┤
│ _id (PK)     │
│ googleId (U) │
│ email (U)    │
│ name         │
│ picture      │
│ phone        │
│ preferences  │
└──────┬───────┘
       │
       │ 1:N (user creates many bookings)
       │
       ▼
┌──────────────────────┐
│     BOOKINGS         │
├──────────────────────┤
│ _id (PK)             │
│ customerId (FK→Users)│
│ busId (FK→Buses)     │
│ routeId (FK→Routes)  │
│ seats[]              │
│ passengers[]         │
│ fare                 │
│ paymentMethod        │
│ paymentStatus        │
│ status               │
│ departureDate        │
│ createdAt            │
└──────┬────────┬──────┘
       │        │
       │        └─────────────────┐
       │                          │
       │ N:1 (many bookings       │ N:1 (booking references
       │     per bus)              │      one route)
       │                          │
       ▼                          ▼
┌──────────────────┐        ┌──────────────────┐
│      BUSES       │        │     ROUTES       │
├──────────────────┤        ├──────────────────┤
│ _id (PK)         │        │ _id (PK)         │
│ operatorName     │        │ source           │
│ busType          │        │ destination      │
│ totalSeats       │        │ departureTime    │
│ amenities[]      │        │ arrivalTime      │
│ rating           │        │ departureDate    │
│ routes[]         │        │ busId (FK→Buses) │
│ operatorContact  │        │ fare             │
└──────────────────┘        │ stoppingPoints[] │
                             │ distance        │
                             │ duration        │
                             └──────────────────┘

┌────────────────────────┐
│   NOTIFICATIONS        │
├────────────────────────┤
│ _id (PK)               │
│ customerId (FK→Users)  │
│ type                   │
│ subject                │
│ body                   │
│ status                 │
│ attempts               │
│ createdAt              │
│ sentAt                 │
│ failureReason          │
└────────────────────────┘
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The following invariant properties must be maintained by the system at all times:

### Property 1: Seat Availability Invariant

**Statement**: For any bus on any given date, the sum of available seats must never be negative. The formula `availableSeats = totalSeats - bookedSeats` must always hold true.

**Validates: Requirement 2.1, Requirement 2.3**

**Test Strategy**:
- Generate random bookings for a bus
- Verify after each booking creation: `bookedSeatsCount ≤ totalSeats`
- Verify seat release on cancellation: `availableSeats increases by released seats`
- Property framework: fast-check with 100+ iterations

### Property 2: Booking Status State Machine Validity

**Statement**: For any booking, the current status must be one of the valid enum values, and state transitions must follow the defined state machine. A booking cannot transition to an invalid next state.

**Validates: Requirement 2.2, Requirement 2.4**

**Valid Transitions**:
- `pending` → `confirmed` (payment success)
- `pending` → `cancelled` (user cancellation)
- `confirmed` → `in_progress` (trip starts)
- `confirmed` → `cancelled` (user cancellation before trip)
- `in_progress` → `completed` (trip ends)
- Invalid transitions: `in_progress` → `pending`, `completed` → `cancelled`, etc.

**Test Strategy**:
- Generate random state transitions
- Verify invalid transitions throw `BusinessRuleError`
- Property: `for all bookings, status ∈ {pending, confirmed, in_progress, completed, cancelled}`

### Property 3: User Data Isolation Enforcement

**Statement**: For any authenticated user making a request, the system must enforce that user can only view/modify bookings where `booking.customerId === authenticatedUserId`. No user shall ever receive data belonging to another user, regardless of how the request is crafted.

**Validates: Requirement 1.2, Requirement 1.5, Requirement 2.1**

**Test Strategy**:
- Create two test users and one booking per user
- Attempt to access User A's booking as User B via API
- Verify 403 Forbidden response with "FORBIDDEN" error code
- Verify database queries always filter by `customerId`
- Security test: Verify query contains `{ customerId: authenticatedUserId }` not just client-provided user ID

### Property 4: Payment Record Immutability

**Statement**: Once a payment transaction is recorded with status `completed`, the amount, method, and timestamp must be immutable. Completed payment records cannot be modified or deleted.

**Validates: Requirement 5.3**

**Test Strategy**:
- Create a completed payment record
- Attempt to modify: `paymentAmount`, `paymentMethod`, `completedAt`
- Verify all modification attempts fail with validation error
- Verify read-only access to historical payment data

### Property 5: Notification Delivery Idempotence

**Statement**: Sending the same notification multiple times (due to retries) should result in the same outcome. The customer receives notification content unchanged, with no duplicate charges or double entries.

**Validates: Requirement 4.1, Requirement 4.2**

**Idempotence Rule**: 
- Same `notificationId` sent 3 times → customer receives exactly 1 email
- If retry mechanism fires, verify no duplicate records created

**Test Strategy**:
- Send notification, capture ID
- Simulate retry logic: send same notification ID again
- Verify no duplicate records in database
- Verify customer receives single email (check email logs)
- Property: `sendNotification(id1) composed with sendNotification(id1) === sendNotification(id1)`

---

## Error Handling

Error handling is structured across three layers: detection, transformation, and response. This ensures consistent behavior across the application.

### Error Detection and Categorization

**Layer 1: Service Layer** - Business logic errors are detected and thrown as typed exceptions:

```javascript
// Example: BookingService detects insufficient seats
class BusinessRuleError extends ServiceError {
  constructor(message) {
    super('BUSINESS_RULE_ERROR', message, 400);
  }
}

throw new BusinessRuleError('Requested seats are no longer available');
```

**Layer 2: Controller Layer** - Errors are caught but not formatted (let middleware handle it):

```javascript
// BookingController - does NOT format, just catches
try {
  const booking = await bookingService.createBooking(userId, data);
  res.status(201).json({ success: true, booking });
} catch (error) {
  // Re-throw to middleware, don't handle here
  throw error;
}
```

**Layer 3: Error Handler Middleware** - Centralized formatting and response:

```javascript
// error-handler.middleware.js
app.use((error, req, res, next) => {
  const { statusCode, response } = ErrorHandlerService.formatError(error);
  
  LoggerService.error(
    error.message,
    error,
    { 
      userId: req.user?.id,
      path: req.path,
      method: req.method,
      statusCode
    }
  );
  
  res.status(statusCode).json(response);
});
```

### Error Code Catalog

| Code | HTTP Status | Cause | Client Action | Example |
|------|-------------|-------|---------------|---------|
| VALIDATION_ERROR | 400 | Invalid input (seats, email, fare) | Show field error to user | "Seat number must be 1-100" |
| UNAUTHORIZED | 401 | Missing or invalid session | Redirect to login page | "Session expired. Please log in again." |
| FORBIDDEN | 403 | User lacks permission (accessing other user's data) | Show permission denied message | "You cannot access another user's bookings." |
| NOT_FOUND | 404 | Resource doesn't exist (booking ID, route) | Show "not found" message | "Booking TB20240615001 not found." |
| BUSINESS_RULE_ERROR | 400 | Business logic violation (no seats, invalid transition) | Show context-specific message | "No seats available. Please select fewer seats." |
| PAYMENT_ERROR | 400 | Payment processing failed | Retry payment or contact support | "Payment gateway temporarily unavailable. Try again." |
| INTERNAL_ERROR | 500 | Unexpected server error | Show generic retry message | "Something went wrong. Please try again later." |

### Error Propagation Flow

```
Service Layer (Logic)
  │
  ├─ ValidationError thrown
  │   └─ CustomValidator.validate() fails
  │
  ├─ AuthorizationError thrown
  │   └─ booking.customerId !== userId
  │
  ├─ NotFoundError thrown
  │   └─ repository.findById() returns null
  │
  ├─ BusinessRuleError thrown
  │   └─ Booking status cannot transition
  │
  └─ Unexpected Error (database crash, etc.)
      └─ Generic Error caught by middleware

         ↓ (middleware catches all)

Error Handler Middleware
  │
  ├─ Categorize error type
  ├─ Map to HTTP status code
  ├─ Log with full context
  ├─ Format standardized response
  └─ Send response to client

         ↓

Client Receives:
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly message",
    "statusCode": 400,
    "details": { ... field-specific errors ... }
  }
}
```

### Error Response Format

**Standard Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descriptive message for end user",
    "statusCode": 400,
    "details": {
      "field": "seat_number",
      "error": "must be between 1 and 50"
    }
  }
}
```

**Validation Error Response** (multiple field errors):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid booking data",
    "statusCode": 400,
    "details": [
      { "field": "seats", "error": "must contain 1-10 seats" },
      { "field": "fare", "error": "must be greater than 0" },
      { "field": "passengers", "error": "must provide passenger names" }
    ]
  }
}
```

### Error Logging and Correlation IDs

**Structured Logging** (development):
```javascript
// LoggerService.error() example
LoggerService.error(
  'Booking creation failed - insufficient seats',
  error,
  {
    correlationId: req.id,
    userId: req.user.id,
    busId: bookingData.busId,
    requestedSeats: bookingData.seats.length,
    availableSeats: 3,
    timestamp: new Date().toISOString()
  }
);
```

**Log Output**:
```
[ERROR] 2024-06-15T10:30:45Z | Booking creation failed - insufficient seats
  ├─ correlationId: req-12345-67890
  ├─ userId: user-507f1f77bcf86cd799439011
  ├─ busId: bus-507f1f77bcf86cd799439012
  ├─ requestedSeats: 5
  ├─ availableSeats: 3
  ├─ error.code: BUSINESS_RULE_ERROR
  └─ stack: Error: Requested seats no longer available at...
```

**Correlation ID Usage** (future enhancement for tracing):
- Include `X-Correlation-ID` header in all requests
- Attach to all logs for the request lifecycle
- Use for debugging multi-step operations
- Example: `X-Correlation-ID: req-12345-67890`

### Client Error vs Server Error Handling

**Client Error** (4xx - client's fault):
- User provided invalid data
- User lacks permission
- Resource doesn't exist
- User's request violates business rules

**Client Response**:
- Show specific error message
- Allow user to fix and retry
- Example: "Email field is required"

**Server Error** (5xx - server's fault):
- Database connection failed
- Unexpected exception in code
- Third-party service unavailable

**Server Response**:
- Show generic message: "Something went wrong. Please try again later."
- Log full error details with correlation ID
- Alert operations team
- Example: Hide internal error details from user

---

## Testing Strategy

Comprehensive testing across unit, integration, and end-to-end levels ensures correctness, reliability, and maintainability.

### Testing Pyramid and Coverage

```
        /\
       /E2E\           5-10% of tests
      /tests\        
     /______\
    /        \
   /Integration\    15-25% of tests
  /  tests      \
 /____________\
/              \
/ Unit Tests &   \  65-80% of tests
/ Property Tests  \
/________________\
```

**Coverage Targets**:
- **Unit Tests**: ≥ 80% line coverage for service layer
- **Integration Tests**: ≥ 60% coverage for API endpoints
- **Property-Based Tests**: All serialization/transformation logic
- **E2E Tests**: Critical user workflows (booking, cancellation, profile)

### Unit Test Structure and Mocking Strategy

**Unit Test Example**: BookingService with mocked dependencies

```javascript
// test/unit/services/booking.service.test.js
describe('BookingService', () => {
  let bookingService;
  let mockRepository;
  let mockBusService;
  let mockNotificationService;

  beforeEach(() => {
    // Mock dependencies
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      update: jest.fn()
    };

    mockBusService = {
      reserveSeats: jest.fn(),
      releaseSeats: jest.fn(),
      checkAvailability: jest.fn()
    };

    mockNotificationService = {
      sendBookingConfirmation: jest.fn()
    };

    bookingService = new BookingService(
      mockRepository,
      mockBusService,
      mockNotificationService
    );
  });

  describe('createBooking', () => {
    it('creates booking with validated data and cash_on_trip method', async () => {
      const userId = new ObjectId();
      const bookingData = {
        busId: new ObjectId(),
        seats: [10, 11, 12],
        fare: 150.00,
        paymentMethod: 'cash_on_trip',
        departureDate: new Date('2024-06-15')
      };

      mockRepository.create.mockResolvedValue({
        _id: new ObjectId(),
        customerId: userId,
        ...bookingData,
        status: 'confirmed'
      });

      const result = await bookingService.createBooking(userId, bookingData);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: userId,
          status: 'confirmed',
          paymentMethod: 'cash_on_trip'
        })
      );
      expect(result.status).toBe('confirmed');
    });

    it('throws VALIDATION_ERROR if seats array is empty', async () => {
      const userId = new ObjectId();
      const invalidData = { seats: [], fare: 100, paymentMethod: 'cash_on_trip' };

      await expect(
        bookingService.createBooking(userId, invalidData)
      ).rejects.toThrow(ValidationError);
    });

    it('reserves seats via BusService and rolls back on failure', async () => {
      const userId = new ObjectId();
      const bookingData = {
        busId: new ObjectId(),
        seats: [10, 11],
        fare: 100,
        paymentMethod: 'cash_on_trip',
        departureDate: new Date('2024-06-15')
      };

      mockBusService.reserveSeats.mockRejectedValue(
        new BusinessRuleError('No seats available')
      );

      await expect(
        bookingService.createBooking(userId, bookingData)
      ).rejects.toThrow(BusinessRuleError);

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getBookingsByCustomer - User Isolation', () => {
    it('enforces user isolation - only returns authenticated user bookings', async () => {
      const userId = new ObjectId();
      const bookings = [
        { _id: new ObjectId(), customerId: userId }
      ];

      mockRepository.find.mockResolvedValue(bookings);

      const result = await bookingService.getBookingsByCustomer(userId);

      // Verify query includes userId filter
      expect(mockRepository.find).toHaveBeenCalledWith({
        customerId: userId
      });
      expect(result).toHaveLength(1);
      expect(result[0].customerId.toString()).toBe(userId.toString());
    });
  });
});
```

### Integration Test Setup and Data Seeding

**Integration Test Example**: API endpoint with test database

```javascript
// test/integration/setup.js - Shared test infrastructure
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  // Use in-memory MongoDB for tests
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear all collections
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const collection of collections) {
    await mongoose.connection.db.collection(collection.name).deleteMany({});
  }
});

// test/integration/booking.integration.test.js
const request = require('supertest');
const app = require('../../server');

describe('POST /bookings - Integration', () => {
  it('creates booking and maintains user isolation', async () => {
    // Create test users
    const user1 = await User.create({
      googleId: 'google_user_1',
      email: 'user1@example.com',
      name: 'User One'
    });

    const user2 = await User.create({
      googleId: 'google_user_2',
      email: 'user2@example.com',
      name: 'User Two'
    });

    // Create test bus and route
    const bus = await Bus.create({
      operatorName: 'TestBus Co',
      busType: 'AC',
      totalSeats: 50,
      routes: []
    });

    const route = await Route.create({
      source: 'NYC',
      destination: 'BOS',
      departureTime: '08:00',
      arrivalTime: '14:30',
      departureDate: new Date('2024-06-15'),
      busId: bus._id,
      fare: 50.00
    });

    // User1 creates booking
    const bookingResponse = await request(app)
      .post('/bookings')
      .set('X-User-Id', user1.googleId)
      .send({
        busId: bus._id.toString(),
        routeId: route._id.toString(),
        seats: [10, 11],
        passengers: [
          { name: 'John Doe', seat: 10 },
          { name: 'Jane Doe', seat: 11 }
        ],
        fare: 100.00,
        paymentMethod: 'cash_on_trip'
      });

    expect(bookingResponse.status).toBe(201);
    const bookingId = bookingResponse.body.booking._id;

    // User2 tries to access User1's booking - should fail
    const unauthorizedResponse = await request(app)
      .get(`/bookings/${bookingId}`)
      .set('X-User-Id', user2.googleId);

    expect(unauthorizedResponse.status).toBe(403);
    expect(unauthorizedResponse.body.error.code).toBe('FORBIDDEN');

    // User1 can access their own booking
    const authorizedResponse = await request(app)
      .get(`/bookings/${bookingId}`)
      .set('X-User-Id', user1.googleId);

    expect(authorizedResponse.status).toBe(200);
    expect(authorizedResponse.body.booking._id).toBe(bookingId);
  });
});
```

### Property-Based Test Examples

**Test 1: Booking Serialization Round-Trip**

```javascript
// test/property-based/serialization.test.js
const fc = require('fast-check');

describe('Booking Serialization (Property-Based)', () => {
  const arbitraryBooking = () =>
    fc.record({
      customerId: fc.hexadecimal({ minLength: 24, maxLength: 24 }),
      busId: fc.hexadecimal({ minLength: 24, maxLength: 24 }),
      seats: fc.array(
        fc.integer({ min: 1, max: 50 }),
        { minLength: 1, maxLength: 5, uniqueBy: (x) => x }
      ),
      fare: fc.tuple(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 0, max: 99 })
      ).map(([dollars, cents]) => dollars + cents / 100),
      status: fc.constantFrom('pending', 'confirmed', 'completed'),
      paymentMethod: fc.constantFrom('cash_on_trip', 'online', 'card')
    });

  test('Serialization preserves booking data across JSON round-trip', () => {
    fc.assert(
      fc.property(arbitraryBooking(), (booking) => {
        // Feature: tedbus-service-oriented-refactor, Property 1: Serialization round-trip
        
        const serialized = JSON.stringify(booking);
        const deserialized = JSON.parse(serialized);

        // All fields should be preserved
        expect(deserialized.customerId).toBe(booking.customerId);
        expect(deserialized.busId).toBe(booking.busId);
        expect(deserialized.seats).toEqual(booking.seats);
        expect(deserialized.status).toBe(booking.status);
      }),
      { numRuns: 100 }
    );
  });
});
```

**Test 2: Seat Availability Invariant**

```javascript
// test/property-based/seat-availability.test.js
describe('Seat Availability Invariant (Property-Based)', () => {
  const arbitraryBusOccupancy = () =>
    fc.record({
      totalSeats: fc.integer({ min: 10, max: 100 }),
      bookedSeats: fc.integer({ min: 0, max: 100 })
    }).filter(({ totalSeats, bookedSeats }) => bookedSeats <= totalSeats);

  test('Available seats never negative', () => {
    fc.assert(
      fc.property(arbitraryBusOccupancy(), ({ totalSeats, bookedSeats }) => {
        // Feature: tedbus-service-oriented-refactor, Property 1: Seat availability invariant
        
        const availableSeats = totalSeats - bookedSeats;
        expect(availableSeats).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });
});
```

### E2E Test Scenarios

**E2E Test Example**: Complete booking workflow

```javascript
// test/e2e/booking-workflow.e2e.test.js
describe('E2E: Complete Booking Workflow', () => {
  let page;
  let browser;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    await page.close();
  });

  test('User completes cash-on-trip booking workflow', async () => {
    // Step 1: Navigate to home
    await page.goto('http://localhost:4200');
    
    // Step 2: Search buses
    await page.fill('[data-testid="source"]', 'New York');
    await page.fill('[data-testid="destination"]', 'Boston');
    await page.fill('[data-testid="departure-date"]', '2024-06-15');
    await page.click('[data-testid="search-button"]');

    // Step 3: Verify results
    await page.waitForSelector('[data-testid="bus-card"]');
    const busCount = await page.locator('[data-testid="bus-card"]').count();
    expect(busCount).toBeGreaterThan(0);

    // Step 4: Select bus and seats
    await page.click('[data-testid="bus-card"]:first-child [data-testid="select-seats"]');
    await page.click('[data-testid="seat-10"]');
    await page.click('[data-testid="seat-11"]');
    await page.click('[data-testid="continue-button"]');

    // Step 5: Enter passenger details
    await page.fill('[data-testid="passenger-0-name"]', 'John Doe');
    await page.fill('[data-testid="passenger-0-email"]', 'john@example.com');
    await page.click('[data-testid="continue-button"]');

    // Step 6: Select cash-on-trip
    await page.click('[data-testid="payment-method-cash"]');
    const cardFieldsVisible = await page.isVisible('[data-testid="card-number"]');
    expect(cardFieldsVisible).toBeFalsy();

    // Step 7: Confirm booking
    await page.click('[data-testid="confirm-booking-button"]');

    // Step 8: Verify success
    await page.waitForSelector('[data-testid="success-message"]');
    const successText = await page.textContent('[data-testid="success-message"]');
    expect(successText).toContain('booked successfully');

    // Step 9: Verify booking in profile
    await page.click('[data-testid="nav-profile"]');
    await page.waitForSelector('[data-testid="booking-card"]');
    const bookings = await page.locator('[data-testid="booking-card"]').count();
    expect(bookings).toBeGreaterThan(0);
  });

  test('User cannot access another user booking', async () => {
    // Create two users via API
    const user1Token = await apiHelper.authenticate('user1@example.com');
    const user2Token = await apiHelper.authenticate('user2@example.com');

    // User1 creates booking
    const bookingId = await apiHelper.createBooking(user1Token, bookingData);

    // User2 tries to access
    const context2 = await browser.newContext({
      storageState: { cookies: [{ name: 'token', value: user2Token }] }
    });
    const page2 = await context2.newPage();

    await page2.goto(`http://localhost:4200/bookings/${bookingId}`);
    await page2.waitForSelector('[data-testid="error-message"]');
    
    const errorText = await page2.textContent('[data-testid="error-message"]');
    expect(errorText).toMatch(/not found|not authorized/i);

    await context2.close();
  });
});
```

### Testing Checklist

**Before deployment, verify**:
- [ ] All unit tests pass: `npm run test:unit`
- [ ] All integration tests pass: `npm run test:integration`
- [ ] Property tests run 100+ iterations: `npm run test:property`
- [ ] Line coverage ≥ 80% for services: `npm run test:coverage`
- [ ] E2E tests pass on staging: `npm run test:e2e:staging`
- [ ] No console errors in browser tests
- [ ] Error logging works: Check logs for correlation IDs
- [ ] User isolation enforced: Cannot access other user data
- [ ] Performance acceptable: API responses < 500ms median

---

## Summary

This design translates TedBus requirements into a clean, maintainable, and secure backend architecture. Key principles:

1. **Service-oriented**: Clear domain services with single responsibilities
2. **Security-first**: User isolation enforced at every layer
3. **Error-handling**: Consistent, structured error responses
4. **Performance**: Caching, indexing, and query optimization
5. **Testability**: Dependency injection enables comprehensive testing
6. **Extensibility**: Layer separation enables future enhancements

The design balances pragmatism (no microservices, single database) with good architecture (clear layers, error handling, security), enabling the team to build, test, and maintain TedBus effectively.
