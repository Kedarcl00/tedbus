/**
 * Review Service - Handles verified post-journey ratings and reviews
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { url } from '../config';

export interface Review {
  _id?: string;
  userId: string;
  userName?: string;
  userPicture?: string;
  isVerifiedUser?: boolean;
  isTrustedReviewer?: boolean;
  bookingId: string;
  busId?: string;
  routeId?: string;
  rating: number;
  reviewText: string;
  createdAt: Date | string;
  editedAt?: Date | string;
  helpful: string[];
  reported: string[];
  hidden: boolean;
  moderatedBy?: string;
}

export interface ReviewSubmitData {
  bookingId: string;
  busId?: string;
  routeId?: string;
  rating: number;
  reviewText: string;
}

export interface ReviewEditData {
  rating?: number;
  reviewText?: string;
}

export interface BusReviewsResponse {
  success: boolean;
  busId?: string;
  routeId?: string;
  totalReviews: number;
  averageRating: number;
  distribution?: { [key: number]: number };
  reviews: Review[];
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private baseUrl = `${url}api/reviews`;

  constructor(private http: HttpClient) {}

  /**
   * Get headers with X-User-Id
   */
  private getHeaders(userId?: string): HttpHeaders {
    let headers = new HttpHeaders();
    if (userId) {
      headers = headers.set('X-User-Id', userId);
    }
    return headers;
  }

  /**
   * Get headers with X-User-Id and X-User-Role
   */
  private getModeratorHeaders(userId: string, role: string): HttpHeaders {
    return new HttpHeaders()
      .set('X-User-Id', userId)
      .set('X-User-Role', role);
  }

  /**
   * Submit a new review
   */
  submitReview(data: ReviewSubmitData, userId?: string): Observable<any> {
    return this.http.post(this.baseUrl, data, {
      headers: this.getHeaders(userId)
    });
  }

  /**
   * Edit an existing review (owner only, within 24h)
   */
  editReview(reviewId: string, data: ReviewEditData, userId?: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/${reviewId}`, data, {
      headers: this.getHeaders(userId)
    });
  }

  /**
   * Delete a review (owner within 24h OR moderator)
   */
  deleteReview(reviewId: string, userId: string, role?: string): Observable<any> {
    const headers = role ? this.getModeratorHeaders(userId, role) : this.getHeaders(userId);
    return this.http.delete(`${this.baseUrl}/${reviewId}`, { headers });
  }

  /**
   * Get reviews for a bus (public)
   */
  getBusReviews(busId: string): Observable<BusReviewsResponse> {
    return this.http.get<BusReviewsResponse>(`${this.baseUrl}/bus/${busId}`);
  }

  /**
   * Get reviews for a route (public)
   */
  getRouteReviews(routeId: string): Observable<BusReviewsResponse> {
    return this.http.get<BusReviewsResponse>(`${this.baseUrl}/route/${routeId}`);
  }

  /**
   * Get review for a specific booking
   */
  getBookingReview(bookingId: string): Observable<{ success: boolean; review: Review | null }> {
    return this.http.get<{ success: boolean; review: Review | null }>(`${this.baseUrl}/booking/${bookingId}`);
  }

  /**
   * Mark a review as helpful
   */
  markHelpful(reviewId: string, userId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${reviewId}/helpful`, {}, {
      headers: this.getHeaders(userId)
    });
  }

  /**
   * Report a review
   */
  reportReview(reviewId: string, userId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${reviewId}/report`, {}, {
      headers: this.getHeaders(userId)
    });
  }

  /**
   * Moderate a review (moderator only)
   */
  moderateReview(reviewId: string, hidden: boolean, userId: string, role: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${reviewId}/moderate`, { hidden }, {
      headers: this.getModeratorHeaders(userId, role)
    });
  }
}
