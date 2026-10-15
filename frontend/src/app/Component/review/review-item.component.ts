/**
 * Review Item Component - Individual review card display
 */

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Review } from '../../service/review.service';
import { AuthService } from '../../service/auth.service';

@Component({
  selector: 'app-review-item',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './review-item.component.html',
  styleUrls: ['./review-item.component.css']
})
export class ReviewItemComponent {
  @Input() review!: Review;
  @Input() currentUserId?: string;
  @Input() currentUserRole?: string;
  @Output() helpfulClicked = new EventEmitter<string>();
  @Output() reportClicked = new EventEmitter<string>();
  @Output() editClicked = new EventEmitter<string>();
  @Output() deleteClicked = new EventEmitter<string>();
  @Output() moderateClicked = new EventEmitter<{ id: string; hidden: boolean }>();

  constructor(private authService: AuthService) {}

  get isOwner(): boolean {
    if (!this.currentUserId || !this.review.userId) return false;
    return String(this.currentUserId) === String(this.review.userId);
  }

  get canEdit(): boolean {
    if (!this.isOwner) return false;
    const timeSinceCreation = Date.now() - new Date(this.review.createdAt).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return timeSinceCreation <= twentyFourHours;
  }

  get hoursLeftToEdit(): number {
    const elapsed = Date.now() - new Date(this.review.createdAt).getTime();
    const remainMs = (24 * 60 * 60 * 1000) - elapsed;
    return Math.max(0, Math.ceil(remainMs / (60 * 60 * 1000)));
  }

  get canDelete(): boolean {
    if (this.currentUserRole === 'moderator') return true;
    if (!this.isOwner) return false;
    const timeSinceCreation = Date.now() - new Date(this.review.createdAt).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return timeSinceCreation <= twentyFourHours;
  }

  get isModerator(): boolean {
    return this.currentUserRole === 'moderator';
  }

  get hasMarkedHelpful(): boolean {
    return this.currentUserId ? (this.review.helpful || []).includes(String(this.currentUserId)) : false;
  }

  get hasReported(): boolean {
    return this.currentUserId ? (this.review.reported || []).includes(String(this.currentUserId)) : false;
  }

  getRatingStars(): number[] {
    return Array(5).fill(0).map((_, i) => i + 1);
  }

  onHelpfulClick(): void {
    if (this.currentUserId && !this.hasMarkedHelpful) {
      this.helpfulClicked.emit(this.review._id!);
    }
  }

  onReportClick(): void {
    if (this.currentUserId && !this.hasReported) {
      this.reportClicked.emit(this.review._id!);
    }
  }

  onEditClick(): void {
    this.editClicked.emit(this.review._id!);
  }

  onDeleteClick(): void {
    if (confirm('Are you sure you want to delete this review?')) {
      this.deleteClicked.emit(this.review._id!);
    }
  }

  onModerateClick(): void {
    const action = this.review.hidden ? 'unhide' : 'hide';
    if (confirm(`Are you sure you want to ${action} this review?`)) {
      this.moderateClicked.emit({ id: this.review._id!, hidden: !this.review.hidden });
    }
  }
}
