import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { url } from '../config';

export interface RouteLocation {
  lat?: number;
  lng?: number;
  address: string;
}

export interface RouteCalculation {
  distance: string;
  duration: string;
  alternatives?: Array<{
    distance: string;
    duration: string;
  }>;
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
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class RoutePlannerService {
  private baseUrl = `${url}api/route-planner`;

  constructor(private http: HttpClient) {}

  /**
   * Get user's saved routes
   * Requires X-User-Id header (automatically injected by auth interceptor)
   */
  getSavedRoutes(): Observable<SavedRoute[]> {
    return this.http.get<SavedRoute[]>(`${this.baseUrl}/routes`);
  }

  /**
   * Save a new route
   * Requires X-User-Id header (automatically injected by auth interceptor)
   */
  saveRoute(route: Partial<SavedRoute>): Observable<SavedRoute> {
    return this.http.post<SavedRoute>(`${this.baseUrl}/routes`, route);
  }

  /**
   * Delete a saved route
   * Requires X-User-Id header (automatically injected by auth interceptor)
   */
  deleteRoute(routeId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/routes/${routeId}`);
  }

  /**
   * Calculate route with origin, destination, and optional waypoints
   * Returns distance, duration, and alternative routes
   */
  calculateRoute(payload: {
    origin: RouteLocation;
    destination: RouteLocation;
    waypoints?: RouteLocation[];
  }): Observable<RouteCalculation> {
    return this.http.post<RouteCalculation>(`${this.baseUrl}/calculate`, payload);
  }
}
