# CORS Configuration Documentation

## Overview

Cross-Origin Resource Sharing (CORS) is configured to allow the frontend application to make requests to the TedBus backend API from a different origin (domain/port).

## Configuration Details

### File Location
- **Main Middleware**: `src/middleware/cors.middleware.js`
- **Integration**: `src/server.js` (imported and used)
- **Environment Variables**: `.env` file

### Allowed Origins

**Development**:
```
http://localhost:4200  (default)
```
Can be overridden via the `FRONTEND_URL` environment variable.

**Production**:
Set `FRONTEND_URL` environment variable to your production frontend domain.

Example:
```
FRONTEND_URL=https://www.example.com
```

### Allowed Methods

The following HTTP methods are allowed in requests:
- `GET` - Retrieve data
- `POST` - Create new resources
- `PUT` - Update existing resources
- `DELETE` - Delete resources
- `OPTIONS` - Preflight requests (automatic)

### Allowed Headers

The following headers can be sent from the client:

1. **Content-Type**
   - Purpose: Specifies the media type of the request body
   - Value: Usually `application/json`
   - Required for: POST, PUT requests with JSON payloads

2. **Authorization**
   - Purpose: Carries authentication credentials
   - Value: Bearer token, OAuth token, or other auth scheme
   - Required for: Protected endpoints requiring authentication

3. **X-Google-ID**
   - Purpose: Custom header for Google user ID authentication
   - Value: The Google ID of the authenticated user
   - Required for: Custom authentication scheme using Google IDs

### Exposed Headers

The following headers are exposed to the client in responses:

1. **Content-Type** - Response media type
2. **X-Total-Count** - For pagination (total number of items)
3. **X-Request-ID** - For request tracking and debugging

### Credentials

**`credentials: true`** enables the following:
- Cookies can be sent with requests
- Authorization headers can be included
- Session information can be persisted

This is essential for maintaining user authentication state across requests.

## Security Considerations

### 1. Origin Whitelisting
- Only the specified frontend origin can make CORS requests
- Prevents unauthorized cross-origin requests from other domains
- Should be configured per environment (dev vs. production)

### 2. Credentials with CORS
- When credentials are enabled, the `Access-Control-Allow-Origin` header cannot be set to `*`
- Must specify an exact origin (which we do via environment variable)
- This prevents credentials from being leaked to unexpected origins

### 3. Header Whitelisting
- Only necessary headers are whitelisted to prevent abuse
- New headers should be added only when needed
- Reduces attack surface by limiting what clients can send

### 4. Preflight Caching
- Preflight requests are cached for 24 hours (86400 seconds)
- Reduces overhead for repeated requests
- Browser automatically handles preflight requests (OPTIONS)

## How CORS Works

### Preflight Request (for non-simple requests)

1. Browser sends OPTIONS preflight request:
   ```
   OPTIONS /bookings
   Origin: http://localhost:4200
   Access-Control-Request-Method: POST
   Access-Control-Request-Headers: Content-Type, Authorization
   ```

2. Server responds with CORS headers:
   ```
   Access-Control-Allow-Origin: http://localhost:4200
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
   Access-Control-Allow-Headers: Content-Type, Authorization, X-Google-ID
   Access-Control-Allow-Credentials: true
   Access-Control-Max-Age: 86400
   ```

3. Browser caches the response and makes actual request:
   ```
   POST /bookings
   Content-Type: application/json
   Authorization: Bearer <token>
   ```

### Simple Requests

Simple requests (GET, HEAD, POST with standard headers) skip preflight and go directly to the server.

## Testing CORS Configuration

### Using curl

```bash
# Test preflight request
curl -X OPTIONS http://localhost:3001/bookings \
  -H "Origin: http://localhost:4200" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -v

# Test actual request with credentials
curl -X POST http://localhost:3001/bookings \
  -H "Origin: http://localhost:4200" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"data":"value"}' \
  -v
```

### Using Chrome DevTools

1. Open DevTools (F12)
2. Go to Network tab
3. Make request from frontend app
4. Check response headers for `Access-Control-*` headers
5. Verify values match configuration

## Environment Configuration

### Development

```env
FRONTEND_URL=http://localhost:4200
CORS_CREDENTIALS=true
```

### Staging

```env
FRONTEND_URL=https://staging.example.com
CORS_CREDENTIALS=true
```

### Production

```env
FRONTEND_URL=https://www.example.com
CORS_CREDENTIALS=true
```

## Adding New Origins or Methods

To add a new origin or method:

1. Update `FRONTEND_URL` environment variable or modify `src/middleware/cors.middleware.js`
2. Add to `allowedHeaders` or `methods` array if needed
3. Restart the server
4. Test CORS with curl or browser DevTools

## Common CORS Errors

### Error: "Access to XMLHttpRequest at 'http://localhost:3001/...' from origin 'http://localhost:4200' has been blocked by CORS policy"

**Causes**:
- Frontend origin not in allowed origins list
- Missing required headers in request

**Solutions**:
- Verify `FRONTEND_URL` environment variable is correct
- Ensure request headers are included in `allowedHeaders`
- Check browser console for specific missing header

### Error: "Response to preflight request doesn't pass access control check"

**Causes**:
- Server not responding to OPTIONS request
- CORS middleware not properly registered
- Headers in request not matching allowed headers

**Solutions**:
- Verify CORS middleware is registered before other middleware
- Check that OPTIONS method is in allowed methods
- Verify required headers are in allowedHeaders list

## Reference

- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS Package](https://github.com/expressjs/cors)
- [OWASP: CORS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Origin_Resource_Sharing_Cheat_Sheet.html)
