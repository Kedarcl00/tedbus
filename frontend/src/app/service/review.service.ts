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
  bookingId: string;
  busId: string;
  rating: number;
  reviewText: string;
  createdAt: Date;
  editedAt?: Date;
  helpful: string[];
  reported: string[];
  hidden: boolean;
  moderatedBy?: string;
}

export interface ReviewSubmitData {
  bookingId: string;
  busId: string;
  rating: number;
  reviewText: string;
}

export interface ReviewEditData {
  rating?: number;
  reviewText?: string;
}

export interface BusReviewsResponse {
  success: boolean;
  busId: string;
  totalReviews: number;
  averageRating: number;
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
  submitReview(data: ReviewSubmitData, userId: string): Observable<any> {
    return this.http.post(this.baseUrl, data, {
      headers: this.getHeaders(userId)
    });
  }

  /**
   * Edit an existing review (owner only, within 24h)
   */
  editReview(reviewId: string, data: ReviewEditData, userId: string): Observable<any> {
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
