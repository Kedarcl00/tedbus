import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { Post, Comment, CommunityService } from '../../../service/community.service';
import { AuthService } from '../../../service/auth.service';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslateModule],
  template: `
    <div class="post-card" [class.hidden-post]="post.hidden" [class.popular-card]="isPopular">
      <div *ngIf="post.hidden" style="color:var(--color-text-muted); font-style:italic; margin-bottom:8px">
        {{ 'COMMUNITY.HIDDEN' | translate }}
      </div>
      <ng-container *ngIf="!post.hidden">
        <div class="post-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="author-avatar">{{ post.authorName.charAt(0).toUpperCase() }}</div>
            <div>
              <span class="post-author">{{ post.authorName }}</span>
              <span class="post-date">{{ post.createdAt | date:'MMM d, y, h:mm a' }}</span>
            </div>
          </div>
          <!-- Popular badge -->
          <div *ngIf="isPopular" class="popular-badge">
            <mat-icon style="font-size:14px; width:14px; height:14px; vertical-align:middle">whatshot</mat-icon>
            {{ 'COMMUNITY.POPULAR' | translate }}
          </div>
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
          <h3 class="post-title">{{ post.title }}</h3>
          <p class="post-body">{{ post.body }}</p>

          <!-- Image display -->
          <div *ngIf="post.imageUrl" class="post-image-container">
            <img [src]="post.imageUrl" alt="Post image" class="post-image" />
          </div>

          <!-- Tags -->
          <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:6px" *ngIf="post.tags && post.tags.length">
            <span *ngFor="let tag of post.tags" class="tag-pill">
              #{{ tag }}
            </span>
          </div>

          <!-- Post Actions Bar -->
          <div class="post-actions">
            <button class="action-btn" [class.liked]="isLiked()" (click)="like.emit(post._id)">
              <mat-icon class="action-icon">favorite</mat-icon>
              {{ isLiked() ? ('COMMUNITY.LIKED' | translate) : ('COMMUNITY.LIKE' | translate) }}
              ({{ post.likes ? post.likes.length : 0 }})
            </button>

            <button class="action-btn" [class.active-comments]="showComments" (click)="toggleComments()">
              <mat-icon class="action-icon">chat_bubble_outline</mat-icon>
              {{ 'COMMUNITY.COMMENTS' | translate }} ({{ comments.length }})
            </button>

            <!-- Social Share Menu Button -->
            <div class="share-container">
              <button class="action-btn" (click)="toggleShareMenu()">
                <mat-icon class="action-icon">share</mat-icon>
                {{ 'COMMUNITY.SHARE' | translate }} ({{ post.shareCount || 0 }})
              </button>

              <!-- Share Dropdown -->
              <div *ngIf="showShareMenu" class="share-dropdown">
                <button class="share-option" (click)="shareWhatsApp()">
                  <span class="share-icon whatsapp-icon">💬</span> WhatsApp
                </button>
                <button class="share-option" (click)="shareTwitter()">
                  <span class="share-icon twitter-icon">🐦</span> X (Twitter)
                </button>
                <button class="share-option" (click)="shareFacebook()">
                  <span class="share-icon fb-icon">📘</span> Facebook
                </button>
                <button class="share-option" (click)="copyLink()">
                  <span class="share-icon link-icon">🔗</span> {{ copied ? 'Copied!' : 'Copy Link' }}
                </button>
              </div>
            </div>

            <!-- Edit and delete buttons (only for author) -->
            <button *ngIf="isAuthor()" class="action-btn author-btn" (click)="startEdit()" style="margin-left:auto">
              <mat-icon class="action-icon">edit</mat-icon>
              {{ 'COMMUNITY.EDIT_POST' | translate }}
            </button>
            <button *ngIf="isAuthor()" class="action-btn author-btn delete-btn" (click)="confirmDelete()">
              <mat-icon class="action-icon">delete</mat-icon>
              {{ 'COMMUNITY.DELETE_POST' | translate }}
            </button>

            <!-- Report button (for non-authors) -->
            <button *ngIf="!isAuthor()" class="action-btn report-btn" (click)="report.emit(post._id)" style="margin-left:auto">
              <mat-icon class="action-icon">flag</mat-icon>
              {{ 'COMMUNITY.REPORT' | translate }}
            </button>
          </div>

          <!-- Share feedback notification -->
          <div *ngIf="copied" class="copy-alert">
            ✓ Link copied to clipboard! Share it with friends.
          </div>

          <!-- Comments Section -->
          <div *ngIf="showComments" class="comments-section">
            <div class="comments-header">
              <h4>{{ 'COMMUNITY.COMMENTS' | translate }}</h4>
            </div>

            <!-- Comments List -->
            <div *ngIf="loadingComments" class="comments-loading">Loading replies...</div>

            <div *ngIf="!loadingComments && comments.length === 0" class="no-comments">
              No comments yet. Join the conversation!
            </div>

            <div class="comments-list" *ngIf="!loadingComments && comments.length > 0">
              <div *ngFor="let c of comments" class="comment-item">
                <div class="comment-header">
                  <span class="comment-author">{{ c.authorName }}</span>
                  <span class="comment-time">{{ c.createdAt | date:'shortDate' }}</span>
                  <button class="comment-report-btn" (click)="reportComment(c._id)" title="Report inappropriate comment">
                    <mat-icon style="font-size:13px; width:13px; height:13px;">flag</mat-icon>
                  </button>
                </div>
                <div class="comment-body">{{ c.body }}</div>
              </div>
            </div>

            <!-- Add Comment Input Box -->
            <div class="add-comment-box" *ngIf="authService.currentUser">
              <textarea [(ngModel)]="newCommentText" rows="2" class="form-textarea"
                [placeholder]="'COMMUNITY.ADD_COMMENT' | translate"></textarea>
              <div style="display:flex; justify-content:flex-end; margin-top:8px;">
                <button class="btn-primary" [disabled]="submittingComment || !newCommentText.trim()" (click)="addComment()">
                  {{ submittingComment ? 'Submitting...' : 'Reply' }}
                </button>
              </div>
            </div>

            <div *ngIf="!authService.currentUser" class="login-to-comment">
              Please sign in to like and comment on community stories.
            </div>
          </div>
        </ng-container>
      </ng-container>
    </div>
  `,
  styles: [`
    .post-card {
      background: var(--color-card, #ffffff);
      border: 1px solid var(--color-border, #e0e0e0);
      border-radius: 8px;
      padding: 18px 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      position: relative;
    }
    .popular-card {
      border-left: 4px solid #ff5722;
    }
    .popular-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #fbe9e7;
      color: #d84315;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .post-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .author-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #d32f2f;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
    }
    .post-author {
      font-weight: 600;
      color: var(--color-text, #333);
      font-size: 14px;
      display: block;
    }
    .post-date {
      font-size: 11px;
      color: var(--color-text-muted, #888);
    }
    .post-title {
      margin: 0 0 8px;
      font-size: 17px;
      color: var(--color-text, #212121);
      font-weight: 600;
    }
    .post-body {
      color: var(--color-text, #424242);
      line-height: 1.5;
      font-size: 14px;
      margin: 0 0 10px;
      white-space: pre-wrap;
    }
    .post-image-container {
      margin: 12px 0;
      border-radius: 8px;
      overflow: hidden;
      max-height: 400px;
      background: #f5f5f5;
    }
    .post-image {
      width: 100%;
      max-height: 400px;
      object-fit: cover;
      display: block;
    }
    .tag-pill {
      background: #f0f4f8;
      color: #1976d2;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .post-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--color-border, #f0f0f0);
      flex-wrap: wrap;
    }
    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: transparent;
      border: 1px solid transparent;
      color: #555;
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      transition: all 0.2s ease;
    }
    .action-btn:hover {
      background: #f5f5f5;
      color: #d32f2f;
    }
    .action-btn.liked {
      color: #d32f2f;
      font-weight: 600;
    }
    .action-btn.liked .action-icon {
      color: #d32f2f;
    }
    .action-btn.active-comments {
      background: #e3f2fd;
      color: #1565c0;
    }
    .action-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .share-container {
      position: relative;
    }
    .share-dropdown {
      position: absolute;
      bottom: 38px;
      left: 0;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.15);
      z-index: 20;
      padding: 6px 0;
      min-width: 160px;
    }
    .share-option {
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      padding: 8px 14px;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .share-option:hover {
      background: #f5f5f5;
    }
    .copy-alert {
      margin-top: 8px;
      font-size: 12px;
      color: #2e7d32;
      background: #e8f5e9;
      padding: 6px 12px;
      border-radius: 4px;
    }
    .comments-section {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px dashed var(--color-border, #e0e0e0);
    }
    .comments-header h4 {
      margin: 0 0 10px;
      font-size: 14px;
      color: var(--color-text-muted, #666);
    }
    .comments-loading, .no-comments, .login-to-comment {
      font-size: 13px;
      color: #888;
      padding: 8px 0;
    }
    .comments-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 14px;
    }
    .comment-item {
      background: #f9f9f9;
      padding: 8px 12px;
      border-radius: 6px;
      border-left: 3px solid #1976d2;
    }
    .comment-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .comment-author {
      font-weight: 600;
      font-size: 12px;
      color: #333;
    }
    .comment-time {
      font-size: 11px;
      color: #999;
    }
    .comment-report-btn {
      margin-left: auto;
      background: transparent;
      border: none;
      color: #bbb;
      cursor: pointer;
      padding: 0;
    }
    .comment-report-btn:hover { color: #d32f2f; }
    .comment-body {
      font-size: 13px;
      color: #444;
      line-height: 1.4;
    }
    .add-comment-box {
      margin-top: 10px;
    }
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
      font-weight: 600;
    }
    .btn-primary:disabled { opacity: .6; cursor: default; }
    .btn-secondary {
      background: #f5f5f5; color: #333; border: 1px solid #bdbdbd;
      padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px;
    }
  `]
})
export class PostCardComponent implements OnInit {
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

  // Comments
  showComments = false;
  comments: Comment[] = [];
  loadingComments = false;
  newCommentText = '';
  submittingComment = false;

  // Social Share
  showShareMenu = false;
  copied = false;

  constructor(
    public authService: AuthService,
    private communityService: CommunityService
  ) {}

  ngOnInit(): void {
    // Pre-fetch comment count
    this.communityService.getComments(this.post._id).subscribe({
      next: (c) => this.comments = c,
      error: () => {}
    });
  }

  get isPopular(): boolean {
    const likesCount = this.post.likes ? this.post.likes.length : 0;
    const shareCount = this.post.shareCount || 0;
    return likesCount >= 3 || (likesCount >= 1 && shareCount >= 2);
  }

  isLiked(): boolean {
    const user = this.authService.currentUser;
    if (!user || !this.post.likes) return false;
    return this.post.likes.includes(user.id) ||
           this.post.likes.includes(user.googleId) ||
           this.post.likes.includes(user['_id']);
  }

  isAuthor(): boolean {
    const user = this.authService.currentUser;
    if (!user) return false;
    return user.id === this.post.authorId ||
           user.googleId === this.post.authorId ||
           user['_id'] === this.post.authorId;
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
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;
    this.delete.emit(this.post._id);
  }

  // Comments Handling
  toggleComments(): void {
    this.showComments = !this.showComments;
    if (this.showComments && this.comments.length === 0) {
      this.loadComments();
    }
  }

  loadComments(): void {
    this.loadingComments = true;
    this.communityService.getComments(this.post._id).subscribe({
      next: (c) => {
        this.comments = c;
        this.loadingComments = false;
      },
      error: () => {
        this.loadingComments = false;
      }
    });
  }

  addComment(): void {
    if (!this.newCommentText.trim()) return;
    const user = this.authService.currentUser;
    if (!user) {
      alert('Please sign in to comment.');
      return;
    }

    this.submittingComment = true;
    this.communityService.createComment({
      userId: user.id || user.googleId,
      authorName: user.name,
      postId: this.post._id,
      body: this.newCommentText.trim(),
    }).subscribe({
      next: (created) => {
        this.comments.push(created);
        this.newCommentText = '';
        this.submittingComment = false;
      },
      error: (err) => {
        alert(err?.message || 'Could not post comment. You may need a completed booking first.');
        this.submittingComment = false;
      }
    });
  }

  reportComment(commentId: string): void {
    const user = this.authService.currentUser;
    if (!user) {
      alert('Please sign in to report a comment.');
      return;
    }
    if (!confirm('Report this comment as inappropriate?')) return;
    this.communityService.reportComment(commentId, user.id || user.googleId).subscribe({
      next: ({ hidden }) => {
        if (hidden) {
          this.comments = this.comments.filter(c => c._id !== commentId);
        } else {
          alert('Comment reported for moderation review.');
        }
      }
    });
  }

  // Social Share Handling
  toggleShareMenu(): void {
    this.showShareMenu = !this.showShareMenu;
  }

  shareWhatsApp(): void {
    const text = encodeURIComponent(`Check out this bus journey story "${this.post.title}" on TedBus: ${window.location.origin}/community?post=${this.post._id}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    this.showShareMenu = false;
    this.share.emit(this.post._id);
  }

  shareTwitter(): void {
    const text = encodeURIComponent(`Check out "${this.post.title}" on TedBus Community!`);
    const link = encodeURIComponent(`${window.location.origin}/community?post=${this.post._id}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${link}`, '_blank');
    this.showShareMenu = false;
    this.share.emit(this.post._id);
  }

  shareFacebook(): void {
    const link = encodeURIComponent(`${window.location.origin}/community?post=${this.post._id}`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${link}`, '_blank');
    this.showShareMenu = false;
    this.share.emit(this.post._id);
  }

  copyLink(): void {
    const link = `${window.location.origin}/community?post=${this.post._id}`;
    navigator.clipboard.writeText(link).then(() => {
      this.copied = true;
      this.showShareMenu = false;
      setTimeout(() => this.copied = false, 3000);
    });
    this.share.emit(this.post._id);
  }
}
