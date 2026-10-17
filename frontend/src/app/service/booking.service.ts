import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Booking } from '../model/booking.model';
import { url } from '../config';

/**
 * Search filters for bus search
 * Used in searchBuses() to query available buses with specific criteria
 */
export interface SearchFilters {
  source: string; // Departure city/location
  destination: string; // Arrival city/location
  date: string; // Travel date in YYYY-MM-DD format
  passengers: number; // Number of passengers
}

/**
 * Bus object returned from search
 * Contains all information needed for display and booking
 */
export interface Bus {
  busId: string;
  operatorName: string;
  departureTime: string; // HH:MM format
  arrivalTime: string; // HH:MM format
  fare: number;
  availableSeats: number;
  totalSeats: number;
  busType: string; // AC, Non-AC, Sleeper, etc.
  amenities: string[];
  routeId?: string;
  departureDetails?: TripDetails;
  arrivalDetails?: TripDetails;
  duration?: string;
}

/**
 * Trip details for departure/arrival
 */
export interface TripDetails {
  date?: string; // Travel date in YYYY-MM-DD format
  city: string;
  location: string;
  time: number | string;
}

/**
 * Passenger information for booking
 */
export interface Passenger {
  name: string;
  gender: string;
  age: number;
}

/**
 * DTO for creating a new booking
 * Sent to backend as POST /bookings request body
 */
export interface CreateBookingDTO {
  busId: string;
  routeId: string;
  seats: number[]; // Selected seat numbers
  fare: number;
  paymentMethod: 'cash_on_trip' | 'online' | string; // Payment method selected by user
  departureDate: string;  // Required by backend
  passengers: Passenger[];  // Backend expects 'passengers' not 'passengerDetails'
  phoneNumber?: string;  // Customer phone number
  departureDetails?: TripDetails;  // Departure location and time
  arrivalDetails?: TripDetails;  // Arrival location and time
  duration?: string;  // Journey duration
}

/**
 * Response from booking creation
 * Returned by backend after POST /bookings
 */
export interface BookingResponse {
  // MongoDB returns _id; 'id' may be present as an alias in some responses
  _id: string;
  id?: string;
  customerId: string;
  busId: any;
  routeId: any;
  seats: number[];
  fare: number;
  paymentMethod: 'cash_on_trip' | 'online' | string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  paymentStatus?: 'pending' | 'completed' | 'failed';
  bookingReference: string;
  // Backend stores as 'passengers', not 'passengerDetails'
  passengers: Passenger[];
  passengerDetails?: Passenger[];  // kept for backwards compat
  // Backend stores as 'departureLocation'/'arrivalLocation', not 'departureDetails'/'arrivalDetails'
  departureLocation?: { name?: string; city?: string; address?: string };
  arrivalLocation?: { name?: string; city?: string; address?: string };
  departureDetails?: TripDetails;  // kept for backwards compat
  arrivalDetails?: TripDetails;    // kept for backwards compat
  departureTime?: string;
  arrivalTime?: string;
  journeyDate?: string;
  duration: string;
  phoneNumber: string;
  bookingDate?: string;
  departureDate?: string;
  createdAt?: string;
}

/**
 * Cancellation result from DELETE /bookings/:id
 */
export interface CancellationResult {
  bookingId: string;
  status: string;
  refundAmount: number;
  message: string;
}

/**
 * Standard error response from backend * Standard error response format
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
 * BookingService - Frontend service for managing bus bookings
 *
 * Responsibilities:
 * - Search available buses (GET /api/buses/search)
 * - Create new bookings (POST /api/bookings)
 * - Retrieve user's bookings (GET /api/bookings/my)
 * - Get booking details (GET /api/bookings/:id)
 * - Cancel bookings (DELETE /api/bookings/:id)
 *
 * Features:
 * - Proper HTTP parameter handling for search queries
 * - Support for "Cash on Trip" payment method
 * - User isolation enforced server-side (X-User-Id header injected by interceptor)
 * - Comprehensive error handling with meaningful error messages
 * - Typed Observables for all API calls
 *
 */
@Injectable({
  providedIn: 'root'
})
export class BookingService {
  // API endpoints
  private apiUrl = url;
  private busSearchUrl = `${this.apiUrl}api/buses/search`;
  private bookingUrl = `${this.apiUrl}api/bookings`;
  private myBookingsUrl = `${this.bookingUrl}/my`;

  constructor(private http: HttpClient) { }

  /**
   * Search available buses with specified filters
   *
   * Calls: GET /api/buses/search?from=source&to=destination&date=YYYY-MM-DD&passengers=N
   *
   * @param filters - Search criteria {source, destination, date, passengers}
   * @returns Observable<Bus[]> - Array of available buses
   *
   * Example:
   * searchBuses({source: 'NYC', destination: 'Boston', date: '2024-06-15', passengers: 2})
   *
   */
  searchBuses(filters: SearchFilters): Observable<Bus[]> {
    let params = new HttpParams()
      .set('from', filters.source)
      .set('to', filters.destination)
      .set('date', filters.date)
      .set('passengers', filters.passengers.toString());

    return this.http.get<Bus[]>(this.busSearchUrl, { params })
      .pipe(
        catchError(error => this.handleError(error, 'Failed to search buses'))
      );
  }

  /**
   * Create a new booking
   *
   * Calls: POST /api/bookings
   *
   * Request body:
   * {
   *   busId: string,
   *   routeId: string,
   *   seats: number[],
   *   fare: number,
   *   paymentMethod: "cash_on_trip" | "online",
   *   phoneNumber: string,
   *   departureDetails: {city, location, time},
   *   arrivalDetails: {city, location, time},
   *   duration: string,
   *   passengerDetails: [{name, gender, age}, ...]
   * }
   *
   * Note: User ID is injected by auth interceptor (X-User-Id header)
   *
   * @param bookingData - Booking details to create
   * @returns Observable<BookingResponse> - Created booking with reference ID
   *
   * Example with "Cash on Trip":
   * createBooking({
   *   busId: 'BUS001',
   *   routeId: 'ROUTE_NYC_BOS',
   *   seats: [12, 13],
   *   fare: 95.98,
   *   paymentMethod: 'cash_on_trip',
   *   phoneNumber: '555-1234',
   *   ...
   * })
   *
   */
  createBooking(bookingData: CreateBookingDTO): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(this.bookingUrl, bookingData)
      .pipe(
        catchError(error => this.handleError(error, 'Failed to create booking'))
      );
  }

  /**
   * Retrieve current user's bookings
   *
   * Calls: GET /api/bookings/my
   *
   * Backend enforces user isolation:
   * - Only returns bookings created by the authenticated user
   * - User ID from X-User-Id header (injected by interceptor)
   * - Bookings ordered by departure date (descending)
   *
   * No parameters needed (auth handled by interceptor)
   *
   * @returns Observable<BookingResponse[]> - Array of user's bookings
   *
   */
  getMyBookings(): Observable<BookingResponse[]> {
    return this.http.get<BookingResponse[]>(this.myBookingsUrl)
      .pipe(
        catchError(error => this.handleError(error, 'Failed to retrieve bookings'))
      );
  }

  /**
   * Get details of a specific booking
   *
   * Calls: GET /api/bookings/:id
   *
   * Backend enforces user isolation:
   * - Returns 403 Forbidden if user is not the booking owner
   * - Returns 404 Not Found if booking doesn't exist
   *
   * @param bookingId - ID of the booking to retrieve
   * @returns Observable<BookingResponse> - Booking details
   *
   * Error scenarios:
   * - 403 Forbidden: User is not the booking owner
   * - 404 Not Found: Booking doesn't exist
   *
   */
  getBookingDetails(bookingId: string): Observable<BookingResponse> {
    const url = `${this.bookingUrl}/${bookingId}`;
    return this.http.get<BookingResponse>(url)
      .pipe(
        catchError(error => this.handleError(error, 'Failed to retrieve booking details'))
      );
  }

  /**
   * Cancel a booking
   *
   * Calls: DELETE /api/bookings/:id
   *
   * Backend enforces:
   * - Returns 403 Forbidden if user is not the booking owner
   * - Returns 404 Not Found if booking doesn't exist
   * - Checks if booking can be cancelled (not already completed/cancelled)
   * - Calculates and returns refund amount
   *
   * @param bookingId - ID of the booking to cancel
   * @returns Observable<CancellationResult> - Cancellation confirmation with refund info
   *
   * Error scenarios:
   * - 403 Forbidden: User is not the booking owner
   * - 404 Not Found: Booking doesn't exist
   * - 400 Bad Request: Booking cannot be cancelled (already completed, etc.)
   *
   */
  cancelBooking(bookingId: string): Observable<CancellationResult> {
    const url = `${this.bookingUrl}/${bookingId}`;
    return this.http.delete<CancellationResult>(url)
      .pipe(
        catchError(error => this.handleError(error, 'Failed to cancel booking'))
      );
  }

  /**
   * Private error handler for HTTP errors
   *
   * Transforms HTTP error responses into meaningful error messages
   * Handles various error types:
   * - 400 Bad Request: Validation error, display field errors
   * - 401 Unauthorized: User not authenticated, redirect to login
   * - 403 Forbidden: User doesn't have permission
   * - 404 Not Found: Resource not found
   * - 500 Internal Server Error: Generic error message (never expose server details)
   * * Standard backend response format: {success: false, error: {code, message, statusCode, details}}
   *
   * @private
   * @param error - HttpErrorResponse from HTTP call
   * @param defaultMessage - Fallback message if backend error is unavailable
   * @returns Observable<never> - Throws error with transformed message
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
      console.error('API Error:', {
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
      message: errorMessage,
      details: null
    }));
  }
}
