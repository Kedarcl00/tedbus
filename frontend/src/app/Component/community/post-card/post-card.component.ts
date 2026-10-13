import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { Post } from '../../../service/community.service';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslateModule],
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
        <h3 style="margin:0 0 8px; color:var(--color-text)">{{ post.title }}</h3>
        <p class="post-body">{{ post.body }}</p>

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
          <button (click)="report.emit(post._id)" style="margin-left:auto">
            <mat-icon style="font-size:16px; vertical-align:middle">flag</mat-icon>
            {{ 'COMMUNITY.REPORT' | translate }}
          </button>
        </div>
      </ng-container>
    </div>
  `,
})
export class PostCardComponent {
  @Input() post!: Post;
  @Output() like    = new EventEmitter<string>();
  @Output() comment = new EventEmitter<string>();
  @Output() share   = new EventEmitter<string>();
  @Output() report  = new EventEmitter<string>();
}
