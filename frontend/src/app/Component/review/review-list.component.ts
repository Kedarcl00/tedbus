/**
 * Review List Component - Container showing average rating, breakdown, and list of reviews
 */

import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ReviewService, Review, BusReviewsResponse } from '../../service/review.service';
import { AuthService } from '../../service/auth.service';
import { ReviewItemComponent } from './review-item.component';
import { ReviewFormComponent } from './review-form.component';

@Component({
  selector: 'app-review-list',
  standalone: true,
  imports: [CommonModule, MatIconModule, ReviewItemComponent, ReviewFormComponent],
  templateUrl: './review-list.component.html',
  styleUrls: ['./review-list.component.css']
})
export class ReviewListComponent implements OnInit, OnChanges {
  @Input() busId?: string;
  @Input() routeId?: string;
  @Input() userBookingId?: string; // If user has a completed booking for this bus/route

  reviews: Review[] = [];
  filteredReviews: Review[] = [];
  totalReviews: number = 0;
  averageRating: number = 0;
  distribution: { [key: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  isLoading: boolean = true;
  currentUserId?: string;
  currentUserRole?: string;
  canReview: boolean = false;
  userExistingReview?: Review | null = null;
  showEditForm: boolean = false;
  showCreateForm: boolean = false;
  activeFilter: string = 'all'; // 'all', '5', 'trusted'

  Math = Math;

  constructor(
    private reviewService: ReviewService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.authService.currentUser;
    if (user) {
      this.currentUserId = user['_id'] || user['id'] || user['googleId'];
      this.currentUserRole = user['role'] || '';
    }

    this.canReview = !!this.userBookingId;
    this.loadReviews();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['busId'] || changes['routeId'] || changes['userBookingId']) {
      this.canReview = !!this.userBookingId;
      this.loadReviews();
    }
  }

  loadReviews(): void {
    this.isLoading = true;
    const req$ = this.busId
      ? this.reviewService.getBusReviews(this.busId)
      : (this.routeId ? this.reviewService.getRouteReviews(this.routeId) : null);

    if (!req$) {
      this.isLoading = false;
      return;
    }

    req$.subscribe({
      next: (response: BusReviewsResponse) => {
        if (this.busId && this.routeId && (!response.reviews || response.reviews.length === 0)) {
          // Fallback to route reviews if this specific bus doesn't have reviews yet
          this.reviewService.getRouteReviews(this.routeId).subscribe({
            next: (routeResp: BusReviewsResponse) => {
              this.applyReviewResponse(routeResp);
            },
            error: () => {
              this.applyReviewResponse(response);
            }
          });
          return;
        }
        this.applyReviewResponse(response);
      },
      error: (err) => {
        console.error('Failed to load reviews:', err);
        this.isLoading = false;
      }
    });
  }

  private applyReviewResponse(response: BusReviewsResponse): void {
    this.reviews = response.reviews || [];
    this.totalReviews = response.totalReviews || 0;
    this.averageRating = response.averageRating || 0;
    this.distribution = response.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    // Check if user already reviewed
    if (this.currentUserId) {
      this.userExistingReview = this.reviews.find(
        r => String(r.userId) === String(this.currentUserId)
      ) || null;

      if (this.userExistingReview) {
        this.canReview = false;
      }
    }

    this.applyFilter(this.activeFilter);
    this.isLoading = false;
  }

  applyFilter(filter: string): void {
    this.activeFilter = filter;
    if (filter === '5') {
      this.filteredReviews = this.reviews.filter(r => r.rating === 5);
    } else if (filter === 'trusted') {
      this.filteredReviews = this.reviews.filter(r => r.isTrustedReviewer);
    } else {
      this.filteredReviews = [...this.reviews];
    }
  }

  getStarPercent(star: number): number {
    if (this.totalReviews === 0) return 0;
    const count = this.distribution[star] || 0;
    return Math.round((count / this.totalReviews) * 100);
  }

  onHelpfulClicked(reviewId: string): void {
    if (!this.currentUserId) return;

    this.reviewService.markHelpful(reviewId, this.currentUserId).subscribe({
      next: () => {
        this.loadReviews();
      },
      error: (err) => {
        console.error('Failed to mark helpful:', err);
      }
    });
  }

  onReportClicked(reviewId: string): void {
    if (!this.currentUserId) return;

    this.reviewService.reportReview(reviewId, this.currentUserId).subscribe({
      next: (res) => {
        if (res.hidden) {
          alert('This review has received multiple reports and has been hidden in accordance with community guidelines.');
        } else {
          alert('Review reported successfully. Thank you for keeping our community safe.');
        }
        this.loadReviews();
      },
      error: (err) => {
        console.error('Failed to report review:', err);
      }
    });
  }

  onEditClicked(reviewId: string): void {
    this.showEditForm = true;
    this.showCreateForm = false;
  }

  onDeleteClicked(reviewId: string): void {
    if (!this.currentUserId) return;

    this.reviewService.deleteReview(reviewId, this.currentUserId, this.currentUserRole).subscribe({
      next: () => {
        alert('Review deleted successfully.');
        this.loadReviews();
      },
      error: (err) => {
        alert('Failed to delete review: ' + (err.error?.error?.message || 'Unknown error'));
      }
    });
  }

  onModerateClicked(event: { id: string; hidden: boolean }): void {
    if (!this.currentUserId || this.currentUserRole !== 'moderator') return;

    this.reviewService.moderateReview(event.id, event.hidden, this.currentUserId, this.currentUserRole).subscribe({
      next: () => {
        alert(`Review ${event.hidden ? 'hidden' : 'unhidden'} successfully.`);
        this.loadReviews();
      },
      error: (err) => {
        alert('Failed to moderate review: ' + (err.error?.error?.message || 'Unknown error'));
      }
    });
  }

  onReviewSubmitted(): void {
    this.showCreateForm = false;
    this.canReview = false;
    this.loadReviews();
  }

  onReviewEdited(): void {
    this.showEditForm = false;
    this.loadReviews();
  }

  getRatingStars(): number[] {
    return Array(5).fill(0).map((_, i) => i + 1);
  }
}
