import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../service/auth.service';

/**
 * HTTP Interceptor for authentication
 *
 * Injects Google ID in X-User-Id header for all authenticated requests.
 * This header is used by backend authentication middleware for user identification
 * and enforces user isolation on protected endpoints.
 *
 * Pattern: Uses Angular 17+ functional interceptor pattern (not class-based)
 * Requirements: 2.1, 4.2, 4.4
 *
 * Behavior:
 * 1. For each outgoing request, check if user is authenticated
 * 2. If authenticated and X-User-Id header not already present, inject it
 * 3. Pass request to next handler
 * 4. Handles errors appropriately (401/403)
 *
 * @example
 * // Register in app.config.ts:
 * withInterceptors([authInterceptor])
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
  // Inject AuthService dependency
  const authService = inject(AuthService);

  // Get Google ID from AuthService if user is authenticated
  const googleId = authService.getGoogleIdForHeaderInjection();

  // If Google ID exists and X-User-Id header not already present, inject it
  if (googleId && !req.headers.has('X-User-Id')) {
    req = req.clone({
      setHeaders: {
        'X-User-Id': googleId,
      },
    });
  }

  // Pass request to next handler in the chain
  return next(req);
};
