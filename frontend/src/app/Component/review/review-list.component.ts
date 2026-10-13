/**
 * Review List Component - Container showing average rating and list of reviews
 */

import { Component, Input, OnInit } from '@angular/core';
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
export class ReviewListComponent implements OnInit {
  @Input() busId!: string;
  @Input() userBookingId?: string; // If user has a completed booking for this bus

  reviews: Review[] = [];
  totalReviews: number = 0;
  averageRating: number = 0;
  isLoading: boolean = true;
  currentUserId?: string;
  currentUserRole?: string;
  canReview: boolean = false;
  userExistingReview?: Review | null = null;
  showEditForm: boolean = false;
  Math = Math; // Expose Math to template

  constructor(
    private reviewService: ReviewService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.authService.currentUser;
    if (user) {
      this.currentUserId = user['_id'];
      this.currentUserRole = user['role'] || '';
    }

    // Check if user can review (has completed booking but no existing review)
    this.canReview = !!this.userBookingId;

    this.loadReviews();
  }

  loadReviews(): void {
    this.isLoading = true;
    this.reviewService.getBusReviews(this.busId).subscribe({
      next: (response: BusReviewsResponse) => {
        this.reviews = response.reviews;
        this.totalReviews = response.totalReviews;
        this.averageRating = response.averageRating;
        
        // Check if user already reviewed this bus
        if (this.currentUserId) {
          this.userExistingReview = this.reviews.find(r => r.userId === this.currentUserId) || null;
          if (this.userExistingReview) {
            this.canReview = false; // Already reviewed
          }
        }
        
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load reviews:', err);
        this.isLoading = false;
      }
    });
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
      next: () => {
        alert('Review reported successfully. It will be reviewed by moderators.');
        this.loadReviews();
      },
      error: (err) => {
        console.error('Failed to report review:', err);
      }
    });
  }

  onEditClicked(reviewId: string): void {
    this.showEditForm = true;
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
    this.loadReviews();
    this.canReview = false;
  }

  onReviewEdited(): void {
    this.showEditForm = false;
    this.loadReviews();
  }

  getRatingStars(): number[] {
    return Array(5).fill(0).map((_, i) => i + 1);
  }
}
