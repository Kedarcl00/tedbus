import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Customer } from '../model/customer.model';
import { url } from '../config';

/**
 * User profile interface with complete user information
 * Returned from GET /api/users/profile
 * Requirements: 2.3, 2.4
 */
export interface UserProfile extends Customer {
  id: string;
  phone?: string;
  picture?: string;
  dateOfBirth?: string;
  preferences?: UserPreferences;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * User preferences interface
 * Optional profile extension
 * Requirements: 2.3
 */
export interface UserPreferences {
  theme?: string;
  language?: string;
  notifications?: boolean;
  [key: string]: any;
}

/**
 * DTO for updating user profile
 * Sent to backend as PUT /api/users/profile request body
 * Requirements: 2.4
 */
export interface UpdateProfileDTO {
  name?: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
  picture?: string;
  preferences?: UserPreferences;
}

/**
 * Standard error response from backend
 * All errors follow this format per Requirement 3.1
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: any;
  };
}

/**
 * CustomerService - Frontend service for managing user profiles and preferences
 *
 * Responsibilities:
 * - Retrieve current user profile (GET /api/users/profile)
 * - Update user profile (PUT /api/users/profile)
 * - Retrieve user preferences (GET /api/users/preferences)
 * - Add new customer (POST /api/customer) [legacy method]
 *
 * Features:
 * - User isolation enforced server-side (X-User-Id header injected by interceptor)
 * - Comprehensive error handling with meaningful error messages
 * - Typed Observables for all API calls
 * - Support for both legacy and new API endpoints
 *
 * Requirements: 2.3, 2.4
 */
@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  // Legacy API endpoint
  private apiurl: string = url + 'customer/';
  
  // New API endpoints for user profiles
  private userProfileUrl: string = `${url}api/users/profile`;
  private userPreferencesUrl: string = `${url}api/users/preferences`;

  constructor(private http: HttpClient) { }

  /**
   * Get current user profile (authenticated user)
   *
   * Calls: GET /api/users/profile
   *
   * Backend enforces user isolation:
   * - Only returns profile of the authenticated user
   * - User ID from X-User-Id header (injected by interceptor)
   * - Returns 403 Forbidden if user tries to access another profile (via query param)
   *
   * @returns Observable<UserProfile> - Current user's complete profile
   *
   * Error scenarios:
   * - 401 Unauthorized: User not authenticated
   * - 403 Forbidden: Trying to access another user's profile
   * - 404 Not Found: Profile doesn't exist
   * - 500 Internal Server Error: Server error
   *
   * Example:
   * customerService.getProfile().subscribe({
   *   next: (profile) => console.log('Profile loaded:', profile),
   *   error: (error) => console.error('Failed to load profile:', error.message)
   * })
   *
   * Requirements: 2.3
   */
  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.userProfileUrl)
      .pipe(
        catchError(error => this.handleError(error, 'Failed to load profile'))
      );
  }

  /**
   * Update current user profile (authenticated user)
   *
   * Calls: PUT /api/users/profile
   *
   * Backend enforces user isolation:
   * - Only allows updates to authenticated user's profile
   * - User ID from X-User-Id header (injected by interceptor)
   * - Returns 403 Forbidden if trying to update another profile
   *
   * Request body (all fields optional):
   * {
   *   name?: string,
   *   gender?: string,
   *   dateOfBirth?: string,
   *   phone?: string,
   *   picture?: string,
   *   preferences?: {theme?, language?, notifications?, ...}
   * }
   *
   * @param updateData - Profile fields to update (partial update)
   * @returns Observable<UserProfile> - Updated user profile
   *
   * Error scenarios:
   * - 400 Bad Request: Invalid update data
   * - 401 Unauthorized: User not authenticated
   * - 403 Forbidden: Trying to update another user's profile
   * - 404 Not Found: Profile doesn't exist
   * - 500 Internal Server Error: Server error
   *
   * Example:
   * customerService.updateProfile({
   *   phone: '+1-555-0123',
   *   preferences: { theme: 'dark' }
   * }).subscribe({
   *   next: (profile) => console.log('Profile updated:', profile),
   *   error: (error) => console.error('Update failed:', error.message)
   * })
   *
   * Requirements: 2.4
   */
  updateProfile(updateData: UpdateProfileDTO): Observable<UserProfile> {
    return this.http.put<UserProfile>(this.userProfileUrl, updateData)
      .pipe(
        catchError(error => this.handleError(error, 'Failed to update profile'))
      );
  }

  /**
   * Get current user preferences
   *
   * Calls: GET /api/users/preferences
   *
   * Backend enforces user isolation:
   * - Only returns preferences of authenticated user
   *
   * @returns Observable<UserPreferences> - User's preference settings
   *
   * Requirements: 2.3 (optional)
   */
  getPreferences(): Observable<UserPreferences> {
    return this.http.get<UserPreferences>(this.userPreferencesUrl)
      .pipe(
        catchError(error => this.handleError(error, 'Failed to load preferences'))
      );
  }

  /**
   * Add new customer (legacy method for registration)
   *
   * Calls: POST /api/customer
   *
   * @param user - User object with name, email, id (googleId), picture
   * @returns Observable<Customer> - Created customer
   * @deprecated Use backend registration endpoint instead
   *
   * Requirements: 2.2 (legacy support)
   */
  addcustomermongo(user: any): Observable<Customer> {
    const customer: Customer = {
      name: user.name,
      email: user.email,
      googleId: user.id,
      profilepicture: user.picture
    }
    return this.http.post<Customer>(this.apiurl, customer)
      .pipe(
        catchError(error => this.handleError(error, 'Failed to add customer'))
      );
  }

  /**
   * Private error handler for HTTP errors
   *
   * Transforms HTTP error responses into meaningful error messages
   * Handles various error types:
   * - 400 Bad Request: Validation error, display field errors
   * - 401 Unauthorized: User not authenticated, redirect to login
   * - 403 Forbidden: User doesn't have permission (accessing another profile)
   * - 404 Not Found: Resource not found
   * - 500 Internal Server Error: Generic error message (never expose server details)
   *
   * Per Requirement 3.1, backend returns: {success: false, error: {code, message, statusCode, details}}
   *
   * @private
   * @param error - HttpErrorResponse from HTTP call
   * @param defaultMessage - Fallback message if backend error is unavailable
   * @returns Observable<never> - Throws error with transformed message
   *
   * Requirements: 3.1
   */
  private handleError(error: any, defaultMessage: string): Observable<never> {
    let errorMessage = defaultMessage;

    if (error instanceof HttpErrorResponse) {
      // Try to extract error message from backend API response
      if (error.error && error.error.error && error.error.error.message) {
        errorMessage = error.error.error.message;
      }
      // Fall back to HTTP status text if available
      else if (error.statusText && error.statusText !== 'Unknown Error') {
        errorMessage = error.statusText;
      }

      // Log full error for debugging (internal only)
      console.error('Customer API Error:', {
        status: error.status,
        statusText: error.statusText,
        message: errorMessage,
        details: error.error
      });

      // Return error with status code for UI handling
      return throwError(() => ({
        statusCode: error.status,
        message: errorMessage,
        details: error.error?.error?.details || null
      }));
    }

    // Network or other errors
    console.error('Unexpected error:', error);
    return throwError(() => ({
      statusCode: 500,
      message: defaultMessage,
      details: null
    }));
  }
}
