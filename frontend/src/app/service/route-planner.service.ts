import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, interval, switchMap, share } from 'rxjs';
import { url } from '../config';

export interface RouteLocation {
  lat?: number;
  lng?: number;
  address: string;
}

export interface RouteAlternative {
  label: string;
  distance: string;
  duration: string;
  trafficDelay: string;
  congestionLevel: 'low' | 'moderate' | 'high';
  polyline: Array<{ lat: number; lng: number }>;
  isSelected?: boolean;
}

export interface RouteStats {
  distanceKm: number;
  durationMin: number;
  delayMin: number;
  speedKmph: number;
}

export interface RouteCalculation {
  origin: RouteLocation;
  destination: RouteLocation;
  waypoints: RouteLocation[];
  distance: string;
  duration: string;
  trafficDelay: string;
  congestionLevel: 'low' | 'moderate' | 'high';
  trafficMessage: string;
  polyline: Array<{ lat: number; lng: number }>;
  alternatives: RouteAlternative[];
  routeStats: RouteStats;
  updatedAt: string;
}

export interface TrafficUpdate {
  congestionLevel: 'low' | 'moderate' | 'high';
  trafficDelay: string;
  trafficMessage: string;
  updatedAt: string;
}

export interface SavedRoute {
  _id: string;
  userId: string;
  name: string;
  origin: RouteLocation;
  destination: RouteLocation;
  waypoints?: RouteLocation[];
  distance: string;
  duration: string;
  trafficDelay?: string;
  congestionLevel?: string;
  alternatives?: RouteAlternative[];
  useCount?: number;
  createdAt: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class RoutePlannerService {
  private baseUrl = `${url}api/route-planner`;

  constructor(private http: HttpClient) {}

  /** Get list of supported city names */
  getCities(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/cities`);
  }

  /** Get user's saved routes */
  getSavedRoutes(sortBy: 'recent' | 'frequent' | 'name' = 'recent'): Observable<SavedRoute[]> {
    return this.http.get<SavedRoute[]>(`${this.baseUrl}/routes`, {
      params: { sortBy },
    });
  }

  /** Save a new route */
  saveRoute(route: Partial<SavedRoute> & { userId?: string }): Observable<SavedRoute> {
    return this.http.post<SavedRoute>(`${this.baseUrl}/routes`, route);
  }

  /** Increment use count when loading a saved route */
  incrementUseCount(routeId: string): Observable<SavedRoute> {
    return this.http.patch<SavedRoute>(`${this.baseUrl}/routes/${routeId}/use`, {});
  }

  /** Delete a saved route */
  deleteRoute(routeId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/routes/${routeId}`);
  }

  /** Calculate route with origin, destination, waypoints */
  calculateRoute(payload: {
    origin: RouteLocation;
    destination: RouteLocation;
    waypoints?: RouteLocation[];
  }): Observable<RouteCalculation> {
    return this.http.post<RouteCalculation>(`${this.baseUrl}/calculate`, payload);
  }

  /** Poll live traffic for an OD pair every 30 seconds */
  liveTraffic(origin: string, destination: string): Observable<TrafficUpdate> {
    return interval(30000).pipe(
      switchMap(() =>
        this.http.get<TrafficUpdate>(`${this.baseUrl}/traffic`, {
          params: { origin, destination },
        })
      ),
      share()
    );
  }

  /** One-shot traffic check */
  getTraffic(origin: string, destination: string): Observable<TrafficUpdate> {
    return this.http.get<TrafficUpdate>(`${this.baseUrl}/traffic`, {
      params: { origin, destination },
    });
  }

  /** Format helper: congestion → CSS class */
  static congestionClass(level: string | undefined): string {
    switch (level) {
      case 'high':     return 'traffic-high';
      case 'moderate': return 'traffic-moderate';
      default:         return 'traffic-low';
    }
  }
}
