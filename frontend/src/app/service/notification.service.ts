import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { url } from '../config';

export interface AppNotification {
  _id: string;
  userId: string;
  channel: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  delivered: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private base = `${url}api/v1/notifications`;
  private _notifications = new BehaviorSubject<AppNotification[]>([]);
  notifications$ = this._notifications.asObservable();

  get unreadCount(): number {
    return this._notifications.value.filter(n => !n.read).length;
  }

  constructor(private http: HttpClient) {}

  load(userId: string) {
    return this.http.get<AppNotification[]>(`${this.base}?userId=${userId}`).pipe(
      tap(list => this._notifications.next(list))
    );
  }

  markAllRead(userId: string) {
    return this.http.patch(`${this.base}/read`, { userId }).pipe(
      tap(() => {
        const updated = this._notifications.value.map(n => ({ ...n, read: true }));
        this._notifications.next(updated);
      })
    );
  }
}
