import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CommunityFeedComponent } from '../community-feed/community-feed.component';
import { ForumBoardComponent } from '../forum-board/forum-board.component';

@Component({
  selector: 'app-community-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, CommunityFeedComponent, ForumBoardComponent],
  template: `
    <div class="community-page">
      <div class="tabs">
        <button class="tab" [class.active]="tab === 'feed'" (click)="tab = 'feed'">
          <mat-icon>dynamic_feed</mat-icon> Feed
        </button>
        <button class="tab" [class.active]="tab === 'forum'" (click)="tab = 'forum'">
          <mat-icon>forum</mat-icon> Forum
        </button>
      </div>
      <app-community-feed *ngIf="tab === 'feed'"></app-community-feed>
      <app-forum-board   *ngIf="tab === 'forum'"></app-forum-board>
    </div>
  `,
  styles: [`
    .community-page { padding: 0; }
    .tabs {
      display: flex; gap: 4px; padding: 16px 16px 0;
      border-bottom: 2px solid #e0e0e0; margin-bottom: 8px;
    }
    .tab {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 20px; border: none; background: transparent;
      color: #666; cursor: pointer; font-size: 14px; border-radius: 6px 6px 0 0;
      border-bottom: 3px solid transparent; margin-bottom: -2px;
    }
    .tab.active { color: #d32f2f; border-bottom-color: #d32f2f; font-weight: 600; }
    .tab:hover:not(.active) { background: #f5f5f5; }
  `]
})
export class CommunityPageComponent {
  tab: 'feed' | 'forum' = 'feed';
}
