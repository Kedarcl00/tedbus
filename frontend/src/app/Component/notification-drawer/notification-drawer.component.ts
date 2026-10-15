import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import {
  NotificationService,
  AppNotification,
  NotificationPreferences,
} from '../../service/notification.service';
import { AuthService } from '../../service/auth.service';

type DrawerTab = 'history' | 'preferences';
type NotifFilter = 'all' | 'journeys' | 'offers';

const JOURNEY_TYPES = ['BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'SCHEDULE_CHANGE', 'JOURNEY_REMINDER'];
const OFFER_TYPES   = ['PROMOTIONAL_OFFER'];

@Component({
  selector: 'app-notification-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, TranslateModule],
  styles: [`
    /* ── Drawer shell ───────────────────────────────────── */
    .notif-drawer {
      position: fixed; top: 0; right: 0;
      width: 380px; height: 100vh;
      background: var(--color-card);
      border-left: 1px solid var(--color-border);
      box-shadow: -4px 0 24px var(--color-shadow);
      z-index: 1100;
      display: flex; flex-direction: column;
      transform: translateX(100%);
      transition: transform .3s cubic-bezier(.4,0,.2,1);
    }
    .notif-drawer.open { transform: translateX(0); }

    /* ── Header ─────────────────────────────────────────── */
    .drawer-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
      flex-shrink: 0;
    }
    .drawer-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--color-text); }
    .drawer-actions { display: flex; gap: 6px; align-items: center; }
    .action-btn {
      background: none; border: none; cursor: pointer;
      color: var(--color-primary); font-size: 12px; padding: 4px 8px;
      border-radius: 4px; transition: background .2s;
    }
    .action-btn:hover { background: var(--color-surface-alt); }
    .close-btn {
      background: none; border: none; cursor: pointer;
      color: var(--color-text-muted); display: flex; align-items: center;
      border-radius: 4px; padding: 4px; transition: background .2s;
    }
    .close-btn:hover { background: var(--color-surface-alt); color: var(--color-text); }

    /* ── Tabs ───────────────────────────────────────────── */
    .tabs {
      display: flex;
      border-bottom: 1px solid var(--color-border);
      flex-shrink: 0;
    }
    .tab-btn {
      flex: 1; padding: 10px 0; border: none; background: none; cursor: pointer;
      font-size: 13px; color: var(--color-text-muted);
      border-bottom: 2px solid transparent; transition: all .2s;
    }
    .tab-btn.active { color: var(--color-primary); border-bottom-color: var(--color-primary); font-weight: 600; }
    .tab-btn:hover:not(.active) { background: var(--color-surface-alt); }

    /* ── Filter pills ───────────────────────────────────── */
    .filters {
      display: flex; gap: 6px; padding: 10px 14px;
      border-bottom: 1px solid var(--color-border);
      flex-shrink: 0;
    }
    .filter-pill {
      padding: 3px 12px; border-radius: 12px; border: 1px solid var(--color-border);
      background: none; cursor: pointer; font-size: 12px; color: var(--color-text-muted);
      transition: all .2s;
    }
    .filter-pill.active {
      background: var(--color-primary); color: #fff;
      border-color: var(--color-primary);
    }
    .filter-pill:hover:not(.active) { background: var(--color-surface-alt); }

    /* ── Notification list ──────────────────────────────── */
    .notif-list { flex: 1; overflow-y: auto; }
    .notif-empty {
      padding: 48px 16px; text-align: center;
      color: var(--color-text-muted); font-size: 14px;
    }
    .notif-empty mat-icon { font-size: 40px; height: 40px; width: 40px; margin-bottom: 8px; opacity: .4; }

    .notif-item {
      padding: 12px 14px; border-bottom: 1px solid var(--color-border);
      cursor: pointer; transition: background .15s;
      display: flex; flex-direction: column; gap: 4px;
    }
    .notif-item:hover { background: var(--color-surface-alt); }
    .notif-item.unread { background: color-mix(in srgb, var(--color-primary) 6%, var(--color-card)); }
    .notif-item:last-child { border-bottom: none; }

    .notif-row-top {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;
    }
    .notif-title { font-size: 13px; font-weight: 600; color: var(--color-text); flex: 1; }
    .unread-dot { color: var(--color-primary); font-size: 8px; flex-shrink: 0; margin-top: 4px; }

    .notif-body { font-size: 12px; color: var(--color-text-muted); line-height: 1.4; }

    .notif-row-bottom {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px;
    }
    .notif-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }

    .badge {
      display: inline-flex; align-items: center; gap: 2px;
      padding: 1px 7px; border-radius: 8px; font-size: 10px; font-weight: 500;
    }
    .badge-channel {
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      color: var(--color-primary);
    }
    .badge-delivered { background: #e8f5e9; color: #2e7d32; }
    .badge-sent      { background: #e3f2fd; color: #1565c0; }
    .badge-pending   { background: #fff8e1; color: #f57f17; }
    .badge-failed    { background: #fce4ec; color: #c62828; }

    .notif-time { font-size: 10px; color: var(--color-text-muted); }

    .retry-btn {
      background: none; border: 1px solid var(--color-error, #c62828); color: var(--color-error, #c62828);
      border-radius: 4px; padding: 1px 8px; font-size: 10px; cursor: pointer;
      transition: all .2s;
    }
    .retry-btn:hover { background: #fce4ec; }
    .retry-btn:disabled { opacity: .5; cursor: not-allowed; }

    /* ── Preferences panel ──────────────────────────────── */
    .prefs-panel {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .prefs-section-title {
      font-size: 11px; font-weight: 700; letter-spacing: .8px;
      text-transform: uppercase; color: var(--color-text-muted);
      margin: 4px 0 2px;
    }
    .pref-row {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 12px 14px; border-radius: 8px;
      background: var(--color-surface-alt);
      gap: 12px;
    }
    .pref-info { flex: 1; }
    .pref-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
    .pref-desc { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; line-height: 1.4; }

    /* Toggle switch */
    .toggle-wrap { display: flex; align-items: center; flex-shrink: 0; }
    .toggle-switch {
      position: relative; width: 40px; height: 22px; display: inline-block;
    }
    .toggle-switch input { display: none; }
    .toggle-slider {
      position: absolute; inset: 0; background: #ccc;
      border-radius: 22px; cursor: pointer; transition: background .2s;
    }
    .toggle-slider:before {
      content: ''; position: absolute;
      width: 16px; height: 16px; border-radius: 50%;
      background: #fff; top: 3px; left: 3px; transition: transform .2s;
    }
    .toggle-switch input:checked + .toggle-slider { background: var(--color-primary); }
    .toggle-switch input:checked + .toggle-slider:before { transform: translateX(18px); }
    .toggle-switch input:disabled + .toggle-slider { opacity: .5; cursor: not-allowed; }

    .save-prefs-btn {
      background: var(--color-primary); color: #fff;
      border: none; border-radius: 8px; padding: 10px;
      font-size: 14px; font-weight: 500; cursor: pointer;
      width: 100%; margin-top: 8px; transition: opacity .2s;
    }
    .save-prefs-btn:hover { opacity: .9; }
    .save-prefs-btn:disabled { opacity: .6; cursor: not-allowed; }

    .prefs-success {
      text-align: center; color: #2e7d32; font-size: 13px;
      padding: 8px; border-radius: 6px; background: #e8f5e9;
    }
  `],
  template: `
    <aside class="notif-drawer" [class.open]="isOpen">

      <!-- Header -->
      <div class="drawer-header">
        <h3 class="drawer-title">{{ 'NOTIFICATIONS.TITLE' | translate }}</h3>
        <div class="drawer-actions">
          <button *ngIf="activeTab === 'history'" class="action-btn" (click)="markAllRead()">
            {{ 'NOTIFICATIONS.MARK_ALL_READ' | translate }}
          </button>
          <button class="close-btn" (click)="close.emit()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn" [class.active]="activeTab === 'history'" (click)="switchTab('history')">
          {{ 'NOTIFICATIONS.TAB_HISTORY' | translate }}
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'preferences'" (click)="switchTab('preferences')">
          {{ 'NOTIFICATIONS.TAB_PREFERENCES' | translate }}
        </button>
      </div>

      <!-- ── HISTORY TAB ── -->
      <ng-container *ngIf="activeTab === 'history'">
        <!-- Filters -->
        <div class="filters">
          <button class="filter-pill" [class.active]="activeFilter === 'all'" (click)="setFilter('all')">
            {{ 'NOTIFICATIONS.FILTER_ALL' | translate }}
          </button>
          <button class="filter-pill" [class.active]="activeFilter === 'journeys'" (click)="setFilter('journeys')">
            {{ 'NOTIFICATIONS.FILTER_JOURNEYS' | translate }}
          </button>
          <button class="filter-pill" [class.active]="activeFilter === 'offers'" (click)="setFilter('offers')">
            {{ 'NOTIFICATIONS.FILTER_OFFERS' | translate }}
          </button>
        </div>

        <!-- Notification list -->
        <div class="notif-list">
          <div *ngIf="loading" style="display:flex;justify-content:center;padding:40px">
            <mat-spinner diameter="32"></mat-spinner>
          </div>

          <div *ngIf="!loading && filteredNotifications.length === 0" class="notif-empty">
            <div><mat-icon>notifications_off</mat-icon></div>
            {{ 'NOTIFICATIONS.EMPTY' | translate }}
          </div>

          <div *ngFor="let n of filteredNotifications"
               class="notif-item"
               [class.unread]="!n.read"
               (click)="onItemClick(n)">

            <div class="notif-row-top">
              <span class="notif-title">{{ n.title }}</span>
              <span *ngIf="!n.read" class="unread-dot">●</span>
            </div>

            <p class="notif-body">{{ n.body }}</p>

            <div class="notif-row-bottom">
              <div class="notif-meta">
                <!-- Channel badge -->
                <span class="badge badge-channel">
                  <mat-icon style="font-size:10px;height:10px;width:10px">
                    {{ channelIcon(n.channel) }}
                  </mat-icon>
                  {{ n.channel }}
                </span>

                <!-- Status badge -->
                <span class="badge" [ngClass]="statusClass(n.status)">
                  {{ statusLabel(n.status) | translate }}
                </span>
              </div>

              <div style="display:flex;gap:6px;align-items:center">
                <!-- Retry button for failed notifications -->
                <button *ngIf="n.status === 'failed'"
                        class="retry-btn"
                        [disabled]="retryingIds.has(n._id)"
                        (click)="retryOne($event, n)">
                  {{ retryingIds.has(n._id) ? ('NOTIFICATIONS.RETRYING' | translate) : ('NOTIFICATIONS.RETRY' | translate) }}
                </button>
                <span class="notif-time">{{ n.createdAt | date:'d MMM, h:mm a' }}</span>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ── PREFERENCES TAB ── -->
      <ng-container *ngIf="activeTab === 'preferences'">
        <div class="prefs-panel">
          <p class="prefs-section-title">{{ 'NOTIFICATIONS.CHANNELS' | translate }}</p>

          <!-- In-App -->
          <div class="pref-row">
            <div class="pref-info">
              <div class="pref-label">{{ 'NOTIFICATIONS.CHANNEL_IN_APP' | translate }}</div>
              <div class="pref-desc">Get instant alerts inside the TedBus app</div>
            </div>
            <div class="toggle-wrap">
              <label class="toggle-switch">
                <input type="checkbox" [(ngModel)]="prefs.inApp">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <!-- Email -->
          <div class="pref-row">
            <div class="pref-info">
              <div class="pref-label">{{ 'NOTIFICATIONS.CHANNEL_EMAIL' | translate }}</div>
              <div class="pref-desc">Receive booking confirmations and alerts on your email</div>
            </div>
            <div class="toggle-wrap">
              <label class="toggle-switch">
                <input type="checkbox" [(ngModel)]="prefs.email">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <!-- Push -->
          <div class="pref-row">
            <div class="pref-info">
              <div class="pref-label">{{ 'NOTIFICATIONS.CHANNEL_PUSH' | translate }}</div>
              <div class="pref-desc">Browser push notifications (requires permission)</div>
            </div>
            <div class="toggle-wrap">
              <label class="toggle-switch">
                <input type="checkbox" [(ngModel)]="prefs.push">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <p class="prefs-section-title" style="margin-top:8px">Content Preferences</p>

          <!-- Promotional -->
          <div class="pref-row">
            <div class="pref-info">
              <div class="pref-label">{{ 'NOTIFICATIONS.PROMOTIONAL' | translate }}</div>
              <div class="pref-desc">{{ 'NOTIFICATIONS.PROMOTIONAL_DESC' | translate }}</div>
            </div>
            <div class="toggle-wrap">
              <label class="toggle-switch">
                <input type="checkbox" [(ngModel)]="prefs.promotional">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div *ngIf="prefsSaved" class="prefs-success">
            ✓ {{ 'NOTIFICATIONS.PREFERENCES_SAVED' | translate }}
          </div>

          <button class="save-prefs-btn"
                  [disabled]="savingPrefs"
                  (click)="savePreferences()">
            {{ savingPrefs ? 'Saving…' : ('BUTTONS.SAVE' | translate) }}
          </button>
        </div>
      </ng-container>

    </aside>
  `,
})
export class NotificationDrawerComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  activeTab: DrawerTab = 'history';
  activeFilter: NotifFilter = 'all';

  notifications: AppNotification[] = [];
  loading = false;

  prefs: NotificationPreferences = { email: true, push: false, inApp: true, promotional: true };
  savingPrefs = false;
  prefsSaved = false;

  retryingIds = new Set<string>();

  private subs: Subscription[] = [];

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.notificationService.notifications$.subscribe(list => {
        this.notifications = list;
      })
    );
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private get userId(): string | null {
    const user = this.authService.currentUser;
    return user?.['_id'] || user?.['id'] || null;
  }

  private loadData(): void {
    const uid = this.userId;
    if (!uid) return;

    this.loading = true;
    this.notificationService.load(uid).subscribe({
      next: () => { this.loading = false; },
      error: () => { this.loading = false; },
    });

    this.notificationService.getPreferences(uid).subscribe({
      next: p => {
        const defaults: NotificationPreferences = { email: true, push: false, inApp: true, promotional: true };
        this.prefs = { ...defaults, ...p };
      },
      error: () => {},
    });
  }

  switchTab(tab: DrawerTab): void {
    this.activeTab = tab;
    this.prefsSaved = false;
  }

  setFilter(f: NotifFilter): void {
    this.activeFilter = f;
  }

  get filteredNotifications(): AppNotification[] {
    if (this.activeFilter === 'journeys') {
      return this.notifications.filter(n => JOURNEY_TYPES.includes(n.type));
    }
    if (this.activeFilter === 'offers') {
      return this.notifications.filter(n => OFFER_TYPES.includes(n.type));
    }
    return this.notifications;
  }

  onItemClick(n: AppNotification): void {
    if (!n.read) {
      const uid = this.userId;
      if (uid) {
        this.notificationService.markOneRead(n._id).subscribe();
      }
    }
  }

  markAllRead(): void {
    const uid = this.userId;
    if (uid) {
      this.notificationService.markAllRead(uid).subscribe();
    }
  }

  retryOne(event: Event, n: AppNotification): void {
    event.stopPropagation();
    this.retryingIds.add(n._id);
    this.notificationService.retryNotification(n._id).subscribe({
      next: () => {
        this.retryingIds.delete(n._id);
        // Refresh list
        const uid = this.userId;
        if (uid) this.notificationService.load(uid).subscribe();
      },
      error: () => { this.retryingIds.delete(n._id); },
    });
  }

  savePreferences(): void {
    const uid = this.userId;
    if (!uid) return;
    this.savingPrefs = true;
    this.prefsSaved = false;
    this.notificationService.updatePreferences(uid, this.prefs).subscribe({
      next: () => {
        this.savingPrefs = false;
        this.prefsSaved = true;
        setTimeout(() => { this.prefsSaved = false; }, 3000);
      },
      error: () => { this.savingPrefs = false; },
    });
  }

  /* ── Helpers ──────────────────────────────────────────── */
  channelIcon(channel: string): string {
    switch (channel) {
      case 'email': return 'email';
      case 'push':  return 'notifications_active';
      default:      return 'notifications';
    }
  }

  statusClass(status: string): string {
    switch (status) {
      case 'delivered': return 'badge-delivered';
      case 'sent':      return 'badge-sent';
      case 'failed':    return 'badge-failed';
      default:          return 'badge-pending';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'delivered': return 'NOTIFICATIONS.STATUS_DELIVERED';
      case 'sent':      return 'NOTIFICATIONS.STATUS_SENT';
      case 'failed':    return 'NOTIFICATIONS.STATUS_FAILED';
      default:          return 'NOTIFICATIONS.STATUS_PENDING';
    }
  }
}
