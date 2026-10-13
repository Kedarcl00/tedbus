import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../service/auth.service';

/**
 * Route guard for pages that require the user to be signed in.
 * Redirects unauthenticated visitors to the home page ( / ).
 *
 * Usage in app.routes.ts:
 *   { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard] }
 * 
 * Note: This guard performs a synchronous check of sessionStorage.
 * The HTTP interceptor will handle 401 errors from the backend if the
 * session is invalid/expired, clearing the session and redirecting to login.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Check if user is logged in (has valid session data in sessionStorage)
  const currentUser = auth.getCurrentUser();
  
  if (currentUser && currentUser.googleId && currentUser.email) {
    // Session data exists and has required fields
    return true;
  }

  // No valid session - redirect to home
  router.navigate(['/'], { replaceUrl: true });
  return false;
};
