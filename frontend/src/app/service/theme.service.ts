import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'tedbus_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private themeSubject = new BehaviorSubject<Theme>(this.resolveInitialTheme());
  theme$ = this.themeSubject.asObservable();

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
}
