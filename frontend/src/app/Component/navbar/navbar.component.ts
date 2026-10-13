import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../service/auth.service';
import { AuthAPIService } from '../../service/auth-api.service';
import { ThemeService } from '../../service/theme.service';
import { LanguageService, SUPPORTED_LANGUAGES, Language } from '../../service/language.service';
import { Router } from '@angular/router';

declare var google: any;

/**
 * NavbarComponent - Main navigation bar with Google Sign-In
 * Displays logo, navigation links, theme/language switchers
 * Shows Google Sign-In button when logged out
 * Shows user account menu when logged in
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    MatMenuModule, MatButtonModule, MatIconModule, MatBadgeModule,
    TranslateModule,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit, AfterViewInit {
  isloggedIn = false;
  isDark = false;
  languages: Language[] = SUPPORTED_LANGUAGES;
  currentLang = 'en';
  unreadCount = 0;

  constructor(
    private router: Router,
    private authService: AuthService,
    private authAPIService: AuthAPIService,
    public themeService: ThemeService,
    private languageService: LanguageService,
  ) {}

  ngOnInit(): void {
    // Subscribe to authentication state from AuthService
    this.authService.currentUser$.subscribe(user => {
      this.isloggedIn = user !== null;
    });
    this.themeService.theme$.subscribe(t => { this.isDark = t === 'dark'; });
    this.languageService.currentLang$.subscribe(l => { this.currentLang = l; });
  }

  ngAfterViewInit(): void {
    // Wait for Google GSI library to load before initializing
    this.waitForGSI(() => this.initGSI());
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  setLanguage(code: string): void {
    this.languageService.setLanguage(code);
  }

  /**
   * Wait for Google Sign-In JavaScript library to load
   * Retries up to 40 times (10 seconds total)
   * @private
   */
  private waitForGSI(cb: () => void, attempts = 0): void {
    if (typeof google !== 'undefined' && google?.accounts?.id) {
      cb();
    } else if (attempts < 40) {
      setTimeout(() => this.waitForGSI(cb, attempts + 1), 250);
    } else {
      console.warn('Google GSI library did not load. Sign-in button unavailable.');
    }
  }

  /**
   * Initialize Google Sign-In library
   * Sets up Google OAuth 2.0 client with credentials and callback
   * @private
   */
  private initGSI(): void {
    // Get Google Client ID - MUST match the one in Google Cloud Console
    // This is the CORRECT Client ID that's registered in your Google Cloud project
    const googleClientId = '791529522730-e08dj90ak5669aahirpe84c9ukuku8pd.apps.googleusercontent.com';

    google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response: any) => this.handleGoogleLogin(response),
    });
    
    // Render the Google Sign-In button
    this.renderGoogleButton();
  }

  /**
   * Render Google Sign-In button on the page
   * Button is placed in the element with id="google-btn"
   * @private
   */
  private renderGoogleButton(): void {
    const btn = document.getElementById('google-btn');
    if (btn) {
      google.accounts.id.renderButton(btn, {
        theme: 'outline',
        size: 'medium',
        shape: 'pill',
        width: 150,
      });
    }
  }

  /**
   * Decode JWT token to extract Google user data
   * Google returns an ID token that contains user information
   * @private
   */
  private decodeJWT(token: string): any {
    try {
      // Split token and decode payload
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch (error) {
      console.error('Failed to decode JWT token:', error);
      return null;
    }
  }

  /**
   * Handle Google Sign-In response
   * Called after user completes Google OAuth flow
   * Sends user data to backend for authentication/registration
   * @private
   */
  handleGoogleLogin(response: any): void {
    if (!response.credential) {
      console.error('No credential received from Google');
      return;
    }

    // Decode the JWT token to get Google user data
    const payload = this.decodeJWT(response.credential);
    if (!payload) {
      console.error('Failed to decode Google token');
      return;
    }

    // Send Google user data to backend for authentication
    this.authAPIService.loginWithGoogle(payload).subscribe({
      next: (response) => {
        // Backend returned authenticated user
        if (response.success && response.user) {
          // Store user in local session using AuthService
          this.authService.setUser(response.user);
          console.log('Google Sign-In successful:', response.user);
          // Redirect to home page or booking page
          this.router.navigate(['/']);
        } else {
          console.error('Authentication failed:', response);
        }
      },
      error: (error) => {
        console.error('Google Sign-In request failed:', error);
        // Show error message to user (implement toast/snackbar later)
        alert('Sign-in failed. Please try again.');
      }
    });
  }

  /**
   * Handle user logout
   * Clears session and redirects to home page
   */
  handleLogout(): void {
    // Call backend logout endpoint
    this.authAPIService.logout().subscribe({
      next: () => {
        // Clear local session
        if (typeof google !== 'undefined' && google?.accounts?.id) {
          google.accounts.id.disableAutoSelect();
        }
        this.authService.clearUser();
        this.router.navigate(['/']);
      },
      error: (error) => {
        console.error('Logout failed:', error);
        // Clear local session even if backend logout fails
        this.authService.clearUser();
        this.router.navigate(['/']);
      }
    });
  }

  navigate(route: string): void {
    this.router.navigate([route]);
  }
}
