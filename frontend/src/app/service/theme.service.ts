import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { url } from '../config';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'tedbus_theme';
const API_URL = `${url}api`;

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private themeSubject = new BehaviorSubject<Theme>(this.resolveInitialTheme());
  theme$ = this.themeSubject.asObservable();

  constructor(private http: HttpClient) {}

  get isDark(): boolean { return this.themeSubject.value === 'dark'; }
  get currentTheme(): Theme { return this.themeSubject.value; }

  /** Call once at app startup (from AppComponent). */
  init(): void {
    this.applyTheme(this.themeSubject.value);
  }

  toggle(): void {
    this.setTheme(this.isDark ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    if (theme !== 'light' && theme !== 'dark') {
      theme = 'light';
    }
    localStorage.setItem(STORAGE_KEY, theme);
    this.themeSubject.next(theme);
    this.applyTheme(theme);

    // Update in-memory user object in sessionStorage if present
    const rawUser = sessionStorage.getItem('Loggedinuser');
    if (rawUser) {
      try {
        const u = JSON.parse(rawUser);
        u.theme = theme;
        sessionStorage.setItem('Loggedinuser', JSON.stringify(u));
      } catch (e) {}
    }

    // Persist to backend if user is authenticated
    this.persistThemeToBackend(theme);
  }

  private applyTheme(theme: Theme): void {
    const body = document.body;
    body.classList.remove('light-theme', 'dark-theme');
    body.classList.add(`${theme}-theme`);
    document.documentElement.setAttribute('data-theme', theme);
  }

  private resolveInitialTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;

    // Check user session
    const rawUser = sessionStorage.getItem('Loggedinuser');
    if (rawUser) {
      try {
        const u = JSON.parse(rawUser);
        if (u.theme === 'light' || u.theme === 'dark') {
          return u.theme;
        }
      } catch (e) {}
    }

    // Fall back to OS preference
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }

  /**
   * Persist theme preference to backend if user is authenticated
   */
  private persistThemeToBackend(theme: Theme): void {
    let userId = sessionStorage.getItem('googleId') || localStorage.getItem('X-User-Id');
    if (!userId) {
      const rawUser = sessionStorage.getItem('Loggedinuser');
      if (rawUser) {
        try {
          const u = JSON.parse(rawUser);
          userId = u.googleId || u.id || u._id;
        } catch (e) {}
      }
    }

    if (!userId) {
      // User not authenticated, skip backend persistence
      return;
    }

    const headers = new HttpHeaders({
      'X-User-Id': userId,
      'Content-Type': 'application/json',
    });

    this.http.put(`${API_URL}/users/profile`, { theme }, { headers })
      .pipe(
        catchError(err => {
          console.warn('Failed to persist theme to backend:', err);
          return [];
        })
      )
      .subscribe();
  }
}
