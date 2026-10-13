import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { url } from '../config';

/**
 * AuthAPIService - HTTP client for backend authentication endpoints
 * Handles Google Sign-In login and other auth API calls to backend
 */
@Injectable({
  providedIn: 'root'
})
export class AuthAPIService {
  private apiUrl = url + 'auth/';

  constructor(private http: HttpClient) {}

  /**
   * Login with Google credentials
   * Sends Google user data to backend for authentication
   * Creates new user or retrieves existing user from database
   *
   * @param googleData - Data from Google Sign-In JWT payload
   * @returns Observable with authenticated user object
   */
  loginWithGoogle(googleData: any): Observable<any> {
    // Google JWT payload uses 'sub' for user ID, not 'id'
    const payload = {
      googleId: googleData.sub,      // ← CHANGED: sub instead of id
      name: googleData.name,
      email: googleData.email,
      picture: googleData.picture
    };
    return this.http.post<any>(`${this.apiUrl}login`, payload);
  }

  /**
   * Register with email and password
   * @param userData - User registration data
   * @returns Observable with created user object
   */
  register(userData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}register`, userData);
  }

  /**
   * Logout from backend
   * Clears session
   *
   * @returns Observable with logout result
   */
  logout(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}logout`, {});
  }

  /**
   * Get current authenticated user
   * Used after page refresh to restore session
   *
   * @returns Observable with current user object
   */
  getCurrentUser(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}me`);
  }
}
