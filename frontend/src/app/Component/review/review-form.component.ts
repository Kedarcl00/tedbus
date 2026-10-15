/**
 * Review Form Component - Form for submitting and editing reviews
 */

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ReviewService, Review } from '../../service/review.service';
import { AuthService } from '../../service/auth.service';

@Component({
  selector: 'app-review-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './review-form.component.html',
  styleUrls: ['./review-form.component.css']
})
export class ReviewFormComponent implements OnInit, OnChanges {
  @Input() busId?: string;
  @Input() routeId?: string;
  @Input() bookingId!: string;
  @Input() existingReview?: Review | null;
  @Input() canReview: boolean = true;
  @Output() reviewSubmitted = new EventEmitter<void>();
  @Output() reviewEdited = new EventEmitter<void>();

  rating: number = 0;
  reviewText: string = '';
  hoveredRating: number = 0;
  errorMessage: string = '';
  successMessage: string = '';
  isSubmitting: boolean = false;
  isEditMode: boolean = false;
  canEdit: boolean = true;
  hoursLeft: number = 24;

  constructor(
    private reviewService: ReviewService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['existingReview']) {
      this.initForm();
    }
  }

  private initForm(): void {
    if (this.existingReview) {
      this.isEditMode = true;
      this.rating = this.existingReview.rating || 0;
      this.reviewText = this.existingReview.reviewText || '';

      // Check if within 24h edit window
      const timeSinceCreation = Date.now() - new Date(this.existingReview.createdAt).getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      this.canEdit = timeSinceCreation <= twentyFourHours;
      const remainMs = twentyFourHours - timeSinceCreation;
      this.hoursLeft = Math.max(0, Math.ceil(remainMs / (60 * 60 * 1000)));
    } else {
      this.isEditMode = false;
      this.rating = 0;
      this.reviewText = '';
      this.canEdit = true;
    }
  }

  setRating(star: number): void {
    if (this.isEditMode && !this.canEdit) return;
    this.rating = star;
  }

  setHoveredRating(star: number): void {
    if (this.isEditMode && !this.canEdit) return;
    this.hoveredRating = star;
  }

  clearHover(): void {
    this.hoveredRating = 0;
  }

  submitReview(): void {
    this.errorMessage = '';
    this.successMessage = '';

    // Validation
    if (this.rating < 1 || this.rating > 5) {
      this.errorMessage = 'Please select a rating between 1 and 5 stars';
      return;
    }

    if (this.reviewText.trim().length < 20) {
      this.errorMessage = 'Review must be at least 20 characters long';
      return;
    }

    const user = this.authService.currentUser;
    const userId = user ? (user['_id'] || user['id'] || user['googleId']) : null;
    if (!userId) {
      this.errorMessage = 'You must be logged in to submit a review';
      return;
    }

    this.isSubmitting = true;

    if (this.isEditMode && this.existingReview) {
      if (!this.canEdit) {
        this.errorMessage = 'Reviews can only be edited within 24 hours of submission. Ratings cannot be changed after this window.';
        this.isSubmitting = false;
        return;
      }

      // Edit existing review
      this.reviewService.editReview(
        this.existingReview._id!,
        {
          rating: this.rating,
          reviewText: this.reviewText.trim()
        },
        userId
      ).subscribe({
        next: () => {
          this.successMessage = 'Review updated successfully!';
          this.isSubmitting = false;
          setTimeout(() => {
            this.reviewEdited.emit();
          }, 1200);
        },
        error: (err) => {
          this.errorMessage = err.error?.error?.message || err.error?.message || 'Failed to update review';
          this.isSubmitting = false;
        }
      });
    } else {
      // Submit new review
      this.reviewService.submitReview(
        {
          bookingId: this.bookingId,
          busId: this.busId,
          routeId: this.routeId,
          rating: this.rating,
          reviewText: this.reviewText.trim()
        },
        userId
      ).subscribe({
        next: () => {
          this.successMessage = 'Review submitted successfully! Thank you for your feedback.';
          this.isSubmitting = false;
          this.rating = 0;
          this.reviewText = '';
          setTimeout(() => {
            this.reviewSubmitted.emit();
          }, 1200);
        },
        error: (err) => {
          this.errorMessage = err.error?.error?.message || err.error?.message || 'Failed to submit review';
          this.isSubmitting = false;
        }
      });
    }
  }
}
