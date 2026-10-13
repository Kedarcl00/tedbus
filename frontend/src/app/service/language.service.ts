import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

export interface Language { code: string; label: string; flag: string; }

const STORAGE_KEY = 'tedbus_lang';
export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिन्दी',  flag: '🇮🇳' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private langSubject = new BehaviorSubject<string>(this.resolveInitialLang());
  currentLang$ = this.langSubject.asObservable();

  constructor(private translate: TranslateService) {}

  init(): void {
    const lang = this.langSubject.value;
    this.translate.addLangs(SUPPORTED_LANGUAGES.map(l => l.code));
    this.translate.setDefaultLang('en');
    this.translate.use(lang);
  }

  setLanguage(code: string): void {
    const valid = SUPPORTED_LANGUAGES.find(l => l.code === code);
    const resolved = valid ? code : 'en';
    localStorage.setItem(STORAGE_KEY, resolved);
    this.translate.use(resolved);
    this.langSubject.next(resolved);
  }

  private resolveInitialLang(): string {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.some(l => l.code === stored)) return stored;
    const browser = navigator.language?.split('-')[0];
    return SUPPORTED_LANGUAGES.some(l => l.code === browser) ? browser : 'en';
  }
}
