import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { Post, CommunityService } from '../../../service/community.service';
import { AuthService } from '../../../service/auth.service';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslateModule],
  template: `
    <div class="post-card" [class.hidden-post]="post.hidden">
      <div *ngIf="post.hidden" style="color:var(--color-text-muted); font-style:italic; margin-bottom:8px">
        {{ 'COMMUNITY.HIDDEN' | translate }}
      </div>
      <ng-container *ngIf="!post.hidden">
        <div class="post-header">
          <span class="post-author">{{ post.authorName }}</span>
          <span class="post-date">{{ post.createdAt | date:'MMM d, y' }}</span>
        </div>

        <!-- Edit mode -->
        <div *ngIf="isEditing" class="edit-form">
          <input class="form-input" [(ngModel)]="editTitle" placeholder="Title" />
          <textarea class="form-textarea" [(ngModel)]="editBody" rows="4" placeholder="Body"></textarea>
          <input class="form-input" [(ngModel)]="editTags" placeholder="Tags (comma-separated)" />
          <input class="form-input" [(ngModel)]="editImageUrl" [placeholder]="'COMMUNITY.POST_IMAGE' | translate" />
          <div class="edit-actions">
            <button class="btn-primary" (click)="saveEdit()" [disabled]="saving">
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
            <button class="btn-secondary" (click)="cancelEdit()">Cancel</button>
          </div>
        </div>

        <!-- View mode -->
        <ng-container *ngIf="!isEditing">
          <h3 style="margin:0 0 8px; color:var(--color-text)">{{ post.title }}</h3>
          <p class="post-body">{{ post.body }}</p>

          <!-- Image display -->
          <div *ngIf="post.imageUrl" style="margin-top:12px">
            <img [src]="post.imageUrl" alt="Post image" 
                 style="max-width:100%; border-radius:8px; display:block" />
          </div>

          <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px" *ngIf="post.tags?.length">
            <span *ngFor="let tag of post.tags"
                  style="background:var(--color-surface-alt); color:var(--color-text-muted);
                         padding:2px 8px; border-radius:12px; font-size:12px">
              #{{ tag }}
            </span>
          </div>

          <div class="post-actions">
            <button (click)="like.emit(post._id)">
              <mat-icon style="font-size:16px; vertical-align:middle">thumb_up</mat-icon>
              {{ 'COMMUNITY.LIKE' | translate }} ({{ post.likes?.length || 0 }})
            </button>
            <button (click)="comment.emit(post._id)">
              <mat-icon style="font-size:16px; vertical-align:middle">chat_bubble_outline</mat-icon>
              {{ 'COMMUNITY.COMMENT' | translate }}
            </button>
            <button (click)="share.emit(post._id)">
              <mat-icon style="font-size:16px; vertical-align:middle">share</mat-icon>
              {{ 'COMMUNITY.SHARE' | translate }}
            </button>

            <!-- Edit and delete buttons (only for author) -->
            <button *ngIf="isAuthor()" (click)="startEdit()" style="margin-left:auto">
              <mat-icon style="font-size:16px; vertical-align:middle">edit</mat-icon>
              {{ 'COMMUNITY.EDIT_POST' | translate }}
            </button>
            <button *ngIf="isAuthor()" (click)="confirmDelete()">
              <mat-icon style="font-size:16px; vertical-align:middle">delete</mat-icon>
              {{ 'COMMUNITY.DELETE_POST' | translate }}
            </button>

            <!-- Report button (for non-authors) -->
            <button *ngIf="!isAuthor()" (click)="report.emit(post._id)" style="margin-left:auto">
              <mat-icon style="font-size:16px; vertical-align:middle">flag</mat-icon>
              {{ 'COMMUNITY.REPORT' | translate }}
            </button>
          </div>
        </ng-container>
      </ng-container>
    </div>
  `,
  styles: [`
    .edit-form {
      display: flex; flex-direction: column; gap: 10px;
      margin-top: 8px; padding: 12px; background: #f9f9f9;
      border-radius: 6px;
    }
    .form-input, .form-textarea {
      width: 100%; padding: 8px 10px; border: 1px solid #bdbdbd;
      border-radius: 4px; font-size: 14px; box-sizing: border-box;
    }
    .form-textarea { resize: vertical; }
    .edit-actions { display: flex; gap: 8px; }
    .btn-primary {
      background: #d32f2f; color: #fff; border: none;
      padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px;
    }
    .btn-primary:disabled { opacity: .6; cursor: default; }
    .btn-secondary {
      background: #f5f5f5; color: #333; border: 1px solid #bdbdbd;
      padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px;
    }
  `]
})
export class PostCardComponent {
  @Input() post!: Post;
  @Output() like    = new EventEmitter<string>();
  @Output() comment = new EventEmitter<string>();
  @Output() share   = new EventEmitter<string>();
  @Output() report  = new EventEmitter<string>();
  @Output() edit    = new EventEmitter<string>();
  @Output() delete  = new EventEmitter<string>();
  @Output() postUpdated = new EventEmitter<Post>();

  isEditing = false;
  saving = false;
  editTitle = '';
  editBody = '';
  editTags = '';
  editImageUrl = '';

  constructor(
    private authService: AuthService,
    private communityService: CommunityService
  ) {}

  isAuthor(): boolean {
    const user = this.authService.currentUser;
    return !!user && user.id === this.post.authorId;
  }

  startEdit(): void {
    this.editTitle = this.post.title;
    this.editBody = this.post.body;
    this.editTags = this.post.tags?.join(', ') || '';
    this.editImageUrl = this.post.imageUrl || '';
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
  }

  saveEdit(): void {
    if (!this.editTitle.trim() || !this.editBody.trim()) return;
    
    this.saving = true;
    const tags = this.editTags.split(',').map(t => t.trim()).filter(Boolean);
    
    this.communityService.updatePost(this.post._id, {
      title: this.editTitle.trim(),
      body: this.editBody.trim(),
      tags,
      imageUrl: this.editImageUrl.trim() || null
    }).subscribe({
      next: updatedPost => {
        this.postUpdated.emit(updatedPost);
        this.isEditing = false;
        this.saving = false;
      },
      error: err => {
        alert(err?.message || 'Failed to update post');
        this.saving = false;
      }
    });
  }

  confirmDelete(): void {
    if (!confirm(this.getTranslation('COMMUNITY.DELETE_CONFIRM'))) return;
    this.delete.emit(this.post._id);
  }

  private getTranslation(key: string): string {
    // Fallback translation - Angular's TranslateService would be injected for real use
    const translations: Record<string, string> = {
      'COMMUNITY.DELETE_CONFIRM': 'Are you sure you want to delete this post? This cannot be undone.'
    };
    return translations[key] || key;
  }
}
