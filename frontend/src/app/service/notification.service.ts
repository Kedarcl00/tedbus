import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { url } from '../config';

export interface AppNotification {
  _id: string;
  userId: string;
  channel: 'in-app' | 'email' | 'push' | string;
  type: string;
  title: string;
  body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  read: boolean;
  delivered: boolean;
  language?: string;
  failureReason?: string;
  retryCount?: number;
  metadata?: any;
  createdAt: string;
  deliveredAt?: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  promotional: boolean;
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

  load(userId: string, filter?: { type?: string; channel?: string; status?: string }): Observable<AppNotification[]> {
    let params = new HttpParams().set('userId', userId);
    if (filter?.type) params = params.set('type', filter.type);
    if (filter?.channel) params = params.set('channel', filter.channel);
    if (filter?.status) params = params.set('status', filter.status);

    return this.http.get<AppNotification[]>(this.base, { params }).pipe(
      tap(list => this._notifications.next(list))
    );
  }

  markAllRead(userId: string): Observable<any> {
    return this.http.patch(`${this.base}/read`, { userId }).pipe(
      tap(() => {
        const updated = this._notifications.value.map(n => ({ ...n, read: true }));
        this._notifications.next(updated);
      })
    );
  }

  markOneRead(id: string): Observable<AppNotification> {
    return this.http.patch<AppNotification>(`${this.base}/${id}/read`, {}).pipe(
      tap(updated => {
        const list = this._notifications.value.map(n => n._id === id ? { ...n, read: true } : n);
        this._notifications.next(list);
      })
    );
  }

  retryNotification(id: string): Observable<any> {
    return this.http.post(`${this.base}/retry/${id}`, {});
  }

  getPreferences(userId: string): Observable<NotificationPreferences> {
    return this.http.get<NotificationPreferences>(`${this.base}/preferences`, {
      params: { userId }
    });
  }

  updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Observable<any> {
    return this.http.put(`${this.base}/preferences`, {
      userId,
      ...preferences
    });
  }

  triggerEvent(userId: string, eventType: string, data: any = {}, channels?: string[]): Observable<any> {
    return this.http.post(`${this.base}/trigger-event`, {
      userId,
      eventType,
      data,
      channels
    });
  }
}
