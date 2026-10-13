# RouteController Implementation

## Overview

This document describes the implementation of the RouteController for the TedBus service-oriented refactor. The RouteController provides read-only access to available bus routes through two public endpoints.

## Files Created

### 1. RouteService (`services/route.service.js`)
Service layer handling all route-related business logic.

**Methods:**
- `getRoutes()` - Retrieves all available routes
- `getRouteById(routeId)` - Retrieves a single route by ID

**Responsibilities:**
- Query Route model from MongoDB
- Transform route data into standardized format
- Handle NotFoundError when route doesn't exist
- Log errors with context

**Response Format:**
```javascript
{
  id: "507f1f77bcf86cd799439011",
  source: "New York",
  destination: "Boston", 
  duration: 240,        // in minutes
  distance: 215         // in km
}
```

### 2. RouteController (`controller/route.controller.js`)
Thin controller layer that handles HTTP requests and delegates to RouteService.

**Endpoints:**
1. **GET /routes** - Get all available routes
   - Returns array of routes with count
   - Status: 200 OK or 500 Internal Server Error
   - No authentication required

2. **GET /routes/:id** - Get single route by ID
   - Returns single route object
   - Status: 200 OK, 404 Not Found, or 500 Internal Server Error
   - No authentication required

**Response Format:**
```javascript
{
  success: true,
  data: [
    {
      id: "507f1f77bcf86cd799439011",
      source: "New York",
      destination: "Boston",
      duration: 240,
      distance: 215
    }
  ],
  count: 1,
  message: "Routes retrieved successfully"
}
```

**Error Response Format:**
```javascript
{
  success: false,
  error: {
    code: "NOT_FOUND",
    message: "Route not found",
    statusCode: 404,
    details: {}
  }
}
```

### 3. Route Definitions (`routes/route.js`)
Updated route definitions file with new endpoints.

**Changes:**
- Removed old endpoint: `GET /routes/:departure/:arrival/:date`
- Added new endpoints:
  - `GET /routes` - Get all routes
  - `GET /routes/:id` - Get route by ID
- Updated imports to use new RouteController

### 4. Test Files

#### `controller/route.controller.test.js`
Unit tests for RouteController using Jest.

**Test Coverage:**
- `getRoutes()` - Success case with multiple routes
- `getRoutes()` - Empty routes array
- `getRoutes()` - Error handling
- `getRouteById()` - Success case
- `getRouteById()` - Missing route ID (400 Bad Request)
- `getRouteById()` - Route not found (404 Not Found)
- `getRouteById()` - Database errors (500 Internal Server Error)

**Mocked Dependencies:**
- RouteService
- ErrorHandlerService

#### `services/route.service.test.js`
Unit tests for RouteService using Jest.

**Test Coverage:**
- `getRoutes()` - Multiple routes retrieval
- `getRoutes()` - Empty routes array
- `getRoutes()` - Handling missing location names
- `getRoutes()` - Database query failure
- `getRouteById()` - Valid route ID
- `getRouteById()` - Non-existent route (NotFoundError)
- `getRouteById()` - Database query failure
- `getRouteById()` - Handling missing location names

**Mocked Dependencies:**
- Route model

## Design Principles

### 1. Thin Controller Pattern
- RouteController only handles HTTP request/response
- All business logic delegated to RouteService
- Controllers use async/await with try/catch

### 2. Centralized Error Handling
- All errors caught and formatted by ErrorHandlerService
- Consistent error response format across all endpoints
- Proper HTTP status codes for each error type

### 3. Service Layer Isolation
- RouteService is a singleton instance
- No direct model access from controller
- All dependencies injected

### 4. No User Isolation Required
- Routes are public data
- No authentication middleware required
- No user ID filtering in queries

## Architecture Flow

```
HTTP Request
    ↓
Route Definition (routes/route.js)
    ↓
RouteController
    ├─ Validate input (if applicable)
    ├─ Call RouteService
    └─ Format and return response
    ↓
RouteService
    ├─ Query Route model
    ├─ Transform data to standard format
    └─ Throw structured errors
    ↓
Route Model (MongoDB)
```

## Error Handling

### Handled Errors

1. **NotFoundError (404)**
   - Route ID doesn't exist in database
   - Message: "Route not found"

2. **ValidationError (400)**
   - Missing route ID parameter
   - Message: "Route ID is required"

3. **Generic Error (500)**
   - Database connection failures
   - Unexpected errors
   - Logged with full context

### Error Logging
All errors are logged with context including:
- Action performed (getRoutes, getRouteById)
- Endpoint called (/routes, /routes/:id)
- Route ID (if applicable)
- Full error stack trace

## Integration Points

### Dependencies
- **ErrorHandlerService** - Error formatting and logging
- **Route Model** - MongoDB schema for routes
- **Express** - HTTP framework

### Required Models
- `Route` model must have fields:
  - `_id` - MongoDB ObjectId
  - `departureLocation` - Object with `name` field
  - `arrivalLocation` - Object with `name` field
  - `duration` - Number (travel time in minutes)
  - `distance` - Number (optional, distance in km)

### Middleware Chain
Routes are registered after:
1. CORS middleware
2. Body parser middleware

Routes are processed before:
1. Error handler middleware (catches unhandled errors)

## Usage Examples

### Get All Routes
```bash
curl -X GET http://localhost:5001/routes
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "source": "New York",
      "destination": "Boston",
      "duration": 240,
      "distance": 215
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "source": "Boston",
      "destination": "Philadelphia",
      "duration": 180,
      "distance": 135
    }
  ],
  "count": 2,
  "message": "Routes retrieved successfully"
}
```

### Get Single Route
```bash
curl -X GET http://localhost:5001/routes/507f1f77bcf86cd799439011
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "source": "New York",
    "destination": "Boston",
    "duration": 240,
    "distance": 215
  },
  "message": "Route details retrieved successfully"
}
```

### Route Not Found (404)
```bash
curl -X GET http://localhost:5001/routes/nonexistent-id
```

Response:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found",
    "statusCode": 404,
    "details": {}
  }
}
```

## Testing

### Running Unit Tests
```bash
npm test -- controller/route.controller.test.js
npm test -- services/route.service.test.js
```

### Test Requirements
- Jest testing framework
- Mock implementations for Route model and services
- All tests passing before deployment

## Performance Considerations

- Routes endpoint uses `.lean()` for read-only queries (faster)
- No N+1 queries (single queries for all routes or single route)
- No authentication overhead (public endpoints)
- Response time target: < 200ms for typical route queries

## Security Considerations

- No authentication required (routes are public data)
- No authorization checks needed
- Input validation on route ID (checked by MongoDB)
- Error messages don't leak internal details

## Future Enhancements

1. **Caching**
   - Cache all routes with 5-minute TTL
   - Invalidate cache when routes are created/updated

2. **Pagination**
   - Implement limit/offset for large route lists
   - Add count of total routes

3. **Filtering**
   - Filter routes by source/destination
   - Filter by distance or duration ranges

4. **Sorting**
   - Sort by duration, distance, or name
   - Support ascending/descending order

5. **Search**
   - Full-text search on route names
   - Partial matching for locations

## Migration Notes

### Removed Endpoint
The old endpoint `GET /routes/:departure/:arrival/:date` has been removed.

**Migration Path:**
1. Frontend should call `GET /routes` to get all routes
2. Filter routes client-side by source/destination
3. Or implement backend filtering if needed

### Backward Compatibility
This is a breaking change. Frontend must be updated to:
1. Call `GET /routes` instead of old endpoint
2. Parse new response format
3. Handle new error response format

## References

- **Requirements**: Requirement 1.7 (Backend file structure organization)
- **Design Document**: Service-Oriented Architecture with thin controllers
- **Related Files**: 
  - BusController (similar pattern)
  - ErrorHandlerService (error formatting)
  - Custom error classes (error types)
