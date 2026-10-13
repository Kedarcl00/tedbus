import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../service/auth.service';

/**
 * Route guard for pages that require the user to be signed in.
 * Redirects unauthenticated visitors to the home page ( / ).
 *
 * Usage in app.routes.ts:
 *   { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard] }
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn) {
    return true;
  }

  // Preserve the attempted URL so we can redirect back after login if needed
  router.navigate(['/'], { replaceUrl: true });
  return false;
};
