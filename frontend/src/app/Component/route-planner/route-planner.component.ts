import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoutePlannerService, SavedRoute, RouteCalculation, RouteLocation } from '../../service/route-planner.service';
import { AuthService } from '../../service/auth.service';

interface Waypoint {
  address: string;
  lat?: number;
  lng?: number;
}

@Component({
  selector: 'app-route-planner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './route-planner.component.html',
  styleUrls: ['./route-planner.component.css']
})
export class RoutePlannerComponent implements OnInit {
  origin: string = '';
  destination: string = '';
  waypoints: Waypoint[] = [];
  
  routeName: string = '';
  calculatedRoute: RouteCalculation | null = null;
  savedRoutes: SavedRoute[] = [];
  
  isAuthenticated = false;
  userId: string | null = null;
  
  isCalculating = false;
  isSaving = false;
  isLoadingSavedRoutes = false;
  
  errorMessage = '';
  successMessage = '';
  
  // Simple city list for autocomplete (can be expanded or loaded from backend)
  cities: string[] = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 
    'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
    'Surat', 'Kanpur', 'Nagpur', 'Indore', 'Thane',
    'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara'
  ];

  constructor(
    private routePlannerService: RoutePlannerService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.isAuthenticated = this.authService.isAuthenticated();
    const user = this.authService.getCurrentUser();
    this.userId = user?.id || null;
    
    if (this.isAuthenticated && this.userId) {
      this.loadSavedRoutes();
    }
  }

  addWaypoint(): void {
    this.waypoints.push({ address: '' });
  }

  removeWaypoint(index: number): void {
    this.waypoints.splice(index, 1);
  }

  moveWaypointUp(index: number): void {
    if (index > 0) {
      const temp = this.waypoints[index];
      this.waypoints[index] = this.waypoints[index - 1];
      this.waypoints[index - 1] = temp;
    }
  }

  moveWaypointDown(index: number): void {
    if (index < this.waypoints.length - 1) {
      const temp = this.waypoints[index];
      this.waypoints[index] = this.waypoints[index + 1];
      this.waypoints[index + 1] = temp;
    }
  }

  calculateRoute(): void {
    this.errorMessage = '';
    this.successMessage = '';
    
    if (!this.origin.trim() || !this.destination.trim()) {
      this.errorMessage = 'Please enter both origin and destination';
      return;
    }
    
    this.isCalculating = true;
    
    const payload = {
      origin: { address: this.origin },
      destination: { address: this.destination },
      waypoints: this.waypoints.filter(w => w.address.trim() !== '').map(w => ({ address: w.address }))
    };
    
    this.routePlannerService.calculateRoute(payload).subscribe({
      next: (result) => {
        this.calculatedRoute = result;
        this.isCalculating = false;
      },
      error: (err) => {
        this.errorMessage = 'Failed to calculate route. Please try again.';
        this.isCalculating = false;
        console.error('Route calculation error:', err);
      }
    });
  }

  saveRoute(): void {
    if (!this.isAuthenticated || !this.userId) {
      this.errorMessage = 'Please sign in to save routes';
      return;
    }
    
    if (!this.routeName.trim()) {
      this.errorMessage = 'Please enter a name for this route';
      return;
    }
    
    if (!this.calculatedRoute) {
      this.errorMessage = 'Please calculate the route first';
      return;
    }
    
    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    const route = {
      userId: this.userId,
      name: this.routeName,
      origin: { address: this.origin },
      destination: { address: this.destination },
      waypoints: this.waypoints.filter(w => w.address.trim() !== '').map(w => ({ address: w.address })),
      distance: this.calculatedRoute.distance,
      duration: this.calculatedRoute.duration
    };
    
    this.routePlannerService.saveRoute(route).subscribe({
      next: (saved) => {
        this.successMessage = 'Route saved successfully!';
        this.isSaving = false;
        this.routeName = '';
        this.loadSavedRoutes();
      },
      error: (err) => {
        this.errorMessage = 'Failed to save route. Please try again.';
        this.isSaving = false;
        console.error('Save route error:', err);
      }
    });
  }

  loadSavedRoutes(): void {
    if (!this.userId) return;
    
    this.isLoadingSavedRoutes = true;
    this.routePlannerService.getSavedRoutes().subscribe({
      next: (routes) => {
        this.savedRoutes = routes;
        this.isLoadingSavedRoutes = false;
      },
      error: (err) => {
        console.error('Failed to load saved routes:', err);
        this.isLoadingSavedRoutes = false;
      }
    });
  }

  deleteRoute(routeId: string): void {
    if (!confirm('Are you sure you want to delete this route?')) {
      return;
    }
    
    this.routePlannerService.deleteRoute(routeId).subscribe({
      next: () => {
        this.successMessage = 'Route deleted successfully';
        this.loadSavedRoutes();
      },
      error: (err) => {
        this.errorMessage = 'Failed to delete route';
        console.error('Delete route error:', err);
      }
    });
  }

  loadSavedRoute(route: SavedRoute): void {
    this.origin = route.origin.address || '';
    this.destination = route.destination.address || '';
    this.waypoints = (route.waypoints || []).map(w => ({ address: w.address || '' }));
    this.routeName = route.name;
    
    // Also restore calculated route if available
    if (route.distance && route.duration) {
      this.calculatedRoute = {
        distance: route.distance,
        duration: route.duration,
        alternatives: []
      };
    }
    
    this.successMessage = `Loaded route: ${route.name}`;
  }

  /**
   * Helper method to format waypoints for display in template
   * Angular templates don't allow arrow functions or complex expressions
   */
  getWaypointsDisplay(waypoints: RouteLocation[] | undefined): string {
    if (!waypoints || waypoints.length === 0) {
      return '';
    }
    return waypoints.map(w => w.address).join(', ');
  }
}
