import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from './theme.service';

/**
 * Session storage key for storing authenticated user data.
 * Stores user object with structure: {name, email, picture, id, googleId}
 * This key is used across frontend and backend for authentication flow.
 */
const SESSION_KEY = 'Loggedinuser';
const GOOGLE_ID_KEY = 'googleId';

/**
 * User data interface stored in sessionStorage
 */
interface AuthenticatedUser {
  id: string;
  googleId: string;
  name: string;
  email: string;
  picture?: string;
  theme?: 'light' | 'dark';
  [key: string]: any;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:5001';

  // Emits the current user object (or null when logged out)
  private currentUserSubject = new BehaviorSubject<AuthenticatedUser | null>(
    this.loadUser()
  );

  /**
   * Observable of the logged-in user. Emits null when not signed in.
   * Components can subscribe to react to authentication state changes.
   */
  currentUser$: Observable<AuthenticatedUser | null> =
    this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private themeService: ThemeService
  ) {}

  /**
   * Synchronous: true if a user is currently stored in sessionStorage
   */
  get isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  /**
   * Synchronous: the current user object, or null if not authenticated
   */
  get currentUser(): AuthenticatedUser | null {
    return this.currentUserSubject.value;
  }

  /**
   * Login method - stores user data from backend response
   * Called after successful authentication with backend via POST /auth/login
   *
   * @param user - User object received from backend containing {id, googleId, name, email, picture}
   * Requirements: 2.1, 4.2, 4.4
   */
  login(user: AuthenticatedUser): void {
    if (!user || !user.id || !user.googleId) {
      console.error('Invalid user data for login');
      return;
    }

    // Store complete user object in sessionStorage
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));

    // Also store Google ID separately for easy header injection
    sessionStorage.setItem(GOOGLE_ID_KEY, user.googleId);

    // Update observable to notify subscribers
    this.currentUserSubject.next(user);

    // Sync theme preference from user profile
    if (user.theme && (user.theme === 'light' || user.theme === 'dark')) {
      this.themeService.setTheme(user.theme);
    }
  }

  /**
   * Logout method - clears all authentication data from sessionStorage
   * Called when user clicks logout or session expires
   *
   * Requirements: 2.1, 4.2
   */
  logout(): void {
    // Clear user data
    sessionStorage.removeItem(SESSION_KEY);

    // Clear Google ID
    sessionStorage.removeItem(GOOGLE_ID_KEY);

    // Note: DO NOT call sessionStorage.clear() as it would wipe
    // non-auth data like theme preferences, language settings, etc.

    // Update observable to notify subscribers
    this.currentUserSubject.next(null);
  }

  /**
   * Restore session on app initialization
   * Validates existing session storage data
   * If invalid, clears stale data
   * 
   * Called from app initialization (AppComponent.ngOnInit)
   * 
   * @returns Observable<boolean> - true if session restored, false otherwise
   * Requirements: 1.2 - Session restoration
   */
  restoreSession(): Observable<boolean> {
    const user = this.loadUser();
    if (!user) {
      return of(false);
    }

    // Session data exists in storage, user is already loaded
    // For future JWT validation, you would call backend here
    // For now, trust sessionStorage data
    return of(true);
  }

  /**
   * Get current authenticated user
   * Returns user object stored in sessionStorage or null if not authenticated
   *
   * @returns User object {id, googleId, name, email, picture} or null
   * Requirements: 2.1, 4.4
   */
  getCurrentUser(): AuthenticatedUser | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is authenticated
   * Synchronous method to check authentication status
   *
   * @returns true if user is authenticated, false otherwise
   * Requirements: 2.1, 4.2
   */
  isAuthenticated(): boolean {
    return this.isLoggedIn;
  }

  /**
   * Get Google ID for request header injection
   * Used by HTTP interceptor to inject X-User-Id header in requests
   * Backend validation middleware uses this for user identification
   *
   * @returns Google ID string for header injection, or null if not authenticated
   * Requirements: 4.2, 4.4
   */
  getGoogleIdForHeaderInjection(): string | null {
    const stored = sessionStorage.getItem(GOOGLE_ID_KEY);
    return stored || this.currentUserSubject.value?.googleId || null;
  }

  /**
   * Call after a successful Google Sign-In response has been stored
   * Alternative to login() for backward compatibility
   *
   * @param user - User object to store
   * @deprecated Use login() instead
   */
  setUser(user: AuthenticatedUser): void {
    this.login(user);
  }

  /**
   * Call on Sign Out
   * Alternative to logout() for backward compatibility
   *
   * @deprecated Use logout() instead
   */
  clearUser(): void {
    this.logout();
  }

  /**
   * Load user from sessionStorage on service initialization
   * Called on component load or page refresh
   *
   * @private
   * @returns User object from sessionStorage or null if not found/invalid
   */
  private loadUser(): AuthenticatedUser | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) {
        return null;
      }

      const user = JSON.parse(raw);

      // Validate user has required fields
      if (!user.id || !user.googleId || !user.email) {
        console.warn('Invalid user data in sessionStorage, clearing');
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(GOOGLE_ID_KEY);
        return null;
      }

      return user as AuthenticatedUser;
    } catch (error) {
      console.error('Error loading user from sessionStorage:', error);
      return null;
    }
  }
}
