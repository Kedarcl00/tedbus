import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../service/auth.service';

/**
 * HTTP Interceptor for authentication
 *
 * Injects Google ID in X-User-Id header for all authenticated requests.
 * This header is used by backend authentication middleware for user identification
 * and enforces user isolation on protected endpoints.
 *
 * Pattern: Uses Angular 17+ functional interceptor pattern (not class-based)
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
  const router = inject(Router);

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

  // Pass request to next handler and catch 401 errors
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle 401 Unauthorized errors - session expired or invalid
      if (error.status === 401) {
        console.warn('401 Unauthorized - clearing session and redirecting to login');
        
        // Clear stale authentication data
        authService.logout();
        
        // Redirect to home/login page
        router.navigate(['/'], { replaceUrl: true });
      }
      
      // Re-throw error for component-level handling
      return throwError(() => error);
    })
  );
};
