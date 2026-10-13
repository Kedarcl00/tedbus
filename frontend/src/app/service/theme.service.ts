import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { catchError } from 'rxjs/operators';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'tedbus_theme';
const API_URL = 'http://localhost:3000/api';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private themeSubject = new BehaviorSubject<Theme>(this.resolveInitialTheme());
  theme$ = this.themeSubject.asObservable();

  constructor(private http: HttpClient) {}

  get isDark(): boolean { return this.themeSubject.value === 'dark'; }

  /** Call once at app startup (e.g. from AppComponent). */
  init(): void {
    this.applyTheme(this.themeSubject.value);
  }

  toggle(): void {
    this.setTheme(this.isDark ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    localStorage.setItem(STORAGE_KEY, theme);
    this.themeSubject.next(theme);
    this.applyTheme(theme);
    
    // Persist to backend if user is authenticated
    this.persistThemeToBackend(theme);
  }

  private applyTheme(theme: Theme): void {
    const body = document.body;
    body.classList.remove('light-theme', 'dark-theme');
    body.classList.add(`${theme}-theme`);
  }

  private resolveInitialTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
    // Fall back to OS preference
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  }

  /**
   * Persist theme preference to backend if user is authenticated
   * Checks for X-User-Id in localStorage or sessionStorage
   */
  private persistThemeToBackend(theme: Theme): void {
    const userId = localStorage.getItem('X-User-Id') || sessionStorage.getItem('X-User-Id');
    if (!userId) {
      // User not authenticated, skip backend persistence
      return;
    }

    const headers = new HttpHeaders({
      'X-User-Id': userId,
      'Content-Type': 'application/json'
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
