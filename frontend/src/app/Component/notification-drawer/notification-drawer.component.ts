import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService, AppNotification } from '../../service/notification.service';
import { AuthService } from '../../service/auth.service';

@Component({
  selector: 'app-notification-drawer',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslateModule],
  template: `
    <aside class="notification-drawer" [class.open]="isOpen">
      <div style="padding:16px; border-bottom:1px solid var(--color-border);
                  display:flex; justify-content:space-between; align-items:center;">
        <h3 style="margin:0; color:var(--color-text)">{{ 'NOTIFICATIONS.TITLE' | translate }}</h3>
        <div style="display:flex; gap:8px; align-items:center">
          <button style="background:none; border:none; cursor:pointer;
                         color:var(--color-primary); font-size:13px;"
                  (click)="markAllRead()">
            {{ 'NOTIFICATIONS.MARK_ALL_READ' | translate }}
          </button>
          <button style="background:none; border:none; cursor:pointer;"
                  (click)="close.emit()">
            <mat-icon style="color:var(--color-text)">close</mat-icon>
          </button>
        </div>
      </div>

      <div *ngIf="notifications.length === 0"
           style="padding:32px 16px; text-align:center; color:var(--color-text-muted)">
        {{ 'NOTIFICATIONS.EMPTY' | translate }}
      </div>

      <div class="notification-item" [class.unread]="!n.read"
           *ngFor="let n of notifications">
        <div style="display:flex; justify-content:space-between; align-items:flex-start">
          <strong style="color:var(--color-text); font-size:14px">{{ n.title }}</strong>
          <span *ngIf="!n.read" class="notification-badge">●</span>
        </div>
        <p style="margin:4px 0 0; color:var(--color-text-muted); font-size:13px">{{ n.body }}</p>
        <span style="font-size:11px; color:var(--color-text-muted)">
          {{ n.createdAt | date:'MMM d, h:mm a' }}
        </span>
      </div>
    </aside>
  `,
})
export class NotificationDrawerComponent implements OnInit {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  notifications: AppNotification[] = [];

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.notificationService.notifications$.subscribe(list => {
      this.notifications = list;
    });
    const user = this.authService.currentUser;
    if (user?.['_id']) {
      this.notificationService.load(user['_id']).subscribe();
    }
  }

  markAllRead(): void {
    const user = this.authService.currentUser;
    if (user?.['_id']) {
      this.notificationService.markAllRead(user['_id']).subscribe();
    }
  }
}
