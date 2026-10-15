import {
  Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  RoutePlannerService,
  SavedRoute,
  RouteCalculation,
  RouteAlternative,
  RouteLocation,
} from '../../service/route-planner.service';
import { AuthService } from '../../service/auth.service';

interface Waypoint {
  address: string;
}

type SortMode   = 'recent' | 'frequent' | 'name';
type CompareKey = 'distance' | 'time' | 'traffic';

declare const L: any; // Leaflet global

@Component({
  selector: 'app-route-planner',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './route-planner.component.html',
  styleUrls: ['./route-planner.component.css'],
})
export class RoutePlannerComponent implements OnInit, AfterViewInit, OnDestroy {
  /* ── Inputs ─────────────────────────────────────────── */
  origin      = '';
  destination = '';
  waypoints: Waypoint[] = [];
  routeName   = '';

  /* ── Cities for autocomplete ────────────────────────── */
  cities: string[] = [];
  filteredOrigin: string[] = [];
  filteredDest: string[] = [];
  filteredWp: string[][] = [];
  showOriginDrop = false;
  showDestDrop   = false;
  showWpDrop: boolean[] = [];

  /* ── State ──────────────────────────────────────────── */
  isAuthenticated     = false;
  userId: string | null = null;
  isCalculating       = false;
  isSaving            = false;
  isLoadingSavedRoutes = false;
  isLoadingTraffic    = false;

  errorMessage   = '';
  successMessage = '';

  /* ── Results ────────────────────────────────────────── */
  calculatedRoute: RouteCalculation | null = null;
  selectedAltIndex = 0;
  compareKey: CompareKey = 'time';

  /* ── Saved routes ───────────────────────────────────── */
  savedRoutes: SavedRoute[] = [];
  savedRouteSort: SortMode = 'recent';

  /* ── Traffic ────────────────────────────────────────── */
  trafficUpdate: { congestionLevel: string; trafficDelay: string; trafficMessage: string } | null = null;
  lastTrafficRefresh: Date | null = null;

  /* ── Map ─────────────────────────────────────────────── */
  private map: any = null;
  private routeLayers: any[] = [];
  private markerLayers: any[] = [];
  leafletLoaded = false;

  /* ── RxJS ────────────────────────────────────────────── */
  private subs: Subscription[] = [];
  private trafficSub?: Subscription;
  private originSearch$ = new Subject<string>();
  private destSearch$   = new Subject<string>();

  constructor(
    private routePlannerService: RoutePlannerService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.isAuthenticated = this.authService.isAuthenticated();
    const user = this.authService.getCurrentUser();
    this.userId = user?.['_id'] || user?.id || null;

    if (this.isAuthenticated) {
      this.loadSavedRoutes();
    }

    // Load supported cities
    this.routePlannerService.getCities().subscribe({
      next: c => { this.cities = c; },
      error: () => {
        // Default fallback list
        this.cities = ['Mumbai','Delhi','Bangalore','Hyderabad','Chennai','Pune','Kolkata',
                       'Ahmedabad','Jaipur','Lucknow','Nagpur','Indore','Bhopal','Goa'];
      },
    });

    // Debounced autocomplete
    this.subs.push(
      this.originSearch$.pipe(debounceTime(200), distinctUntilChanged()).subscribe(q => {
        this.filteredOrigin = this.filterCities(q);
        this.showOriginDrop = this.filteredOrigin.length > 0;
      }),
      this.destSearch$.pipe(debounceTime(200), distinctUntilChanged()).subscribe(q => {
        this.filteredDest = this.filterCities(q);
        this.showDestDrop = this.filteredDest.length > 0;
      })
    );
  }

  ngAfterViewInit(): void {
    this.loadLeafletAndInit();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.trafficSub?.unsubscribe();
    if (this.map) { this.map.remove(); this.map = null; }
  }

  /* ── Leaflet map ─────────────────────────────────────── */
  private loadLeafletAndInit(): void {
    if (typeof (window as any).L !== 'undefined') {
      this.leafletLoaded = true;
      this.initMap();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      this.leafletLoaded = true;
      this.cdr.detectChanges();
      this.initMap();
    };
    document.head.appendChild(script);
  }

  private initMap(): void {
    if (this.map || !this.leafletLoaded) return;
    const el = document.getElementById('route-map');
    if (!el) return;

    this.map = L.map('route-map', { zoomControl: true }).setView([20.5937, 78.9629], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(this.map);
  }

  private clearMapLayers(): void {
    this.routeLayers.forEach(l => l.remove());
    this.markerLayers.forEach(m => m.remove());
    this.routeLayers = [];
    this.markerLayers = [];
  }

  private drawRouteOnMap(route: RouteCalculation, altIndex = 0): void {
    if (!this.map || !this.leafletLoaded) return;
    this.clearMapLayers();

    const selectedAlt = route.alternatives[altIndex];
    const polylinePoints = selectedAlt?.polyline?.length > 0 ? selectedAlt.polyline : route.polyline;

    if (polylinePoints && polylinePoints.length > 1) {
      // Draw de-selected alternatives first (grey)
      route.alternatives.forEach((alt, i) => {
        if (i === altIndex) return;
        const pts = alt.polyline?.map((p: any) => [p.lat, p.lng]) || [];
        if (pts.length > 1) {
          const layer = L.polyline(pts, {
            color: '#9e9e9e',
            weight: 3,
            opacity: 0.5,
            dashArray: '8 6',
          }).addTo(this.map);
          layer.bindTooltip(alt.label, { permanent: false });
          layer.on('click', () => { this.selectAlternative(i); });
          this.routeLayers.push(layer);
        }
      });

      // Draw selected route
      const color = this.congestionColor(route.congestionLevel);
      const pts = polylinePoints.map((p: any) => [p.lat, p.lng]);
      const mainLine = L.polyline(pts, { color, weight: 6, opacity: 0.85 }).addTo(this.map);
      mainLine.bindTooltip(
        `<b>${selectedAlt?.label || 'Route'}</b><br>${route.distance} · ${route.duration}<br>Traffic: ${route.trafficDelay}`,
        { sticky: true }
      );
      this.routeLayers.push(mainLine);
    }

    // Origin marker (green)
    if (route.origin.lat && route.origin.lng) {
      const m = L.circleMarker([route.origin.lat, route.origin.lng], {
        radius: 10, color: '#fff', weight: 2, fillColor: '#4caf50', fillOpacity: 1,
      }).addTo(this.map).bindPopup(`<b>From:</b> ${route.origin.address}`);
      this.markerLayers.push(m);
    }

    // Waypoint markers (blue)
    route.waypoints?.forEach((wp, i) => {
      if (wp.lat && wp.lng) {
        const m = L.circleMarker([wp.lat, wp.lng], {
          radius: 8, color: '#fff', weight: 2, fillColor: '#2196f3', fillOpacity: 1,
        }).addTo(this.map).bindPopup(`<b>Stop ${i + 1}:</b> ${wp.address}`);
        this.markerLayers.push(m);
      }
    });

    // Destination marker (red)
    if (route.destination.lat && route.destination.lng) {
      const m = L.circleMarker([route.destination.lat, route.destination.lng], {
        radius: 10, color: '#fff', weight: 2, fillColor: '#f44336', fillOpacity: 1,
      }).addTo(this.map).bindPopup(`<b>To:</b> ${route.destination.address}`);
      this.markerLayers.push(m);
    }

    // Fit map to route bounds
    if (route.origin.lat && route.destination.lat) {
      const bounds: [number, number][] = [
        [route.origin.lat, route.origin.lng!],
        [route.destination.lat, route.destination.lng!],
        ...( route.waypoints?.filter(w => w.lat).map(w => [w.lat!, w.lng!] as [number, number]) || [])
      ];
      if (bounds.length >= 2) {
        this.map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }

  private congestionColor(level: string): string {
    switch (level) {
      case 'high':     return '#f44336';
      case 'moderate': return '#ff9800';
      default:         return '#4caf50';
    }
  }

  /* ── Autocomplete ────────────────────────────────────── */
  filterCities(q: string): string[] {
    if (!q || q.length < 1) return [];
    const ql = q.toLowerCase();
    return this.cities.filter(c => c.toLowerCase().startsWith(ql)).slice(0, 8);
  }

  onOriginInput(): void     { this.originSearch$.next(this.origin); }
  onDestInput(): void       { this.destSearch$.next(this.destination); }
  onWpInput(i: number): void {
    const q = this.waypoints[i].address;
    this.filteredWp[i] = this.filterCities(q);
    this.showWpDrop[i] = this.filteredWp[i].length > 0;
  }

  selectOriginCity(city: string): void  { this.origin = city; this.showOriginDrop = false; }
  selectDestCity(city: string): void    { this.destination = city; this.showDestDrop = false; }
  selectWpCity(i: number, city: string): void {
    this.waypoints[i].address = city;
    this.showWpDrop[i] = false;
  }
  closeDropdowns(): void {
    setTimeout(() => {
      this.showOriginDrop = false;
      this.showDestDrop   = false;
      this.showWpDrop = this.showWpDrop.map(() => false);
    }, 180);
  }

  /* ── Waypoints ───────────────────────────────────────── */
  addWaypoint(): void {
    this.waypoints.push({ address: '' });
    this.filteredWp.push([]);
    this.showWpDrop.push(false);
  }
  removeWaypoint(i: number): void {
    this.waypoints.splice(i, 1);
    this.filteredWp.splice(i, 1);
    this.showWpDrop.splice(i, 1);
  }
  moveWaypointUp(i: number): void {
    if (i > 0) { [this.waypoints[i], this.waypoints[i - 1]] = [this.waypoints[i - 1], this.waypoints[i]]; }
  }
  moveWaypointDown(i: number): void {
    if (i < this.waypoints.length - 1) { [this.waypoints[i], this.waypoints[i + 1]] = [this.waypoints[i + 1], this.waypoints[i]]; }
  }

  /* ── Route calculation ───────────────────────────────── */
  calculateRoute(): void {
    this.errorMessage = '';
    this.successMessage = '';
    if (!this.origin.trim() || !this.destination.trim()) {
      this.errorMessage = 'Please enter both origin and destination';
      return;
    }

    this.isCalculating = true;
    this.calculatedRoute = null;

    const payload = {
      origin:      { address: this.origin },
      destination: { address: this.destination },
      waypoints:   this.waypoints.filter(w => w.address.trim()).map(w => ({ address: w.address })),
    };

    this.routePlannerService.calculateRoute(payload).subscribe({
      next: (result) => {
        this.calculatedRoute = result;
        this.selectedAltIndex = 0;
        this.isCalculating = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          if (!this.map) this.initMap();
          this.drawRouteOnMap(result, 0);
        }, 100);

        // Start live traffic polling
        this.trafficSub?.unsubscribe();
        this.startTrafficPolling();
      },
      error: (err) => {
        this.errorMessage = err?.error?.error || 'Failed to calculate route. Please check city names and try again.';
        this.isCalculating = false;
      },
    });
  }

  /* ── Alternative route selection ─────────────────────── */
  selectAlternative(i: number): void {
    this.selectedAltIndex = i;
    if (this.calculatedRoute) {
      this.drawRouteOnMap(this.calculatedRoute, i);
    }
  }

  get selectedAlternative(): RouteAlternative | null {
    return this.calculatedRoute?.alternatives?.[this.selectedAltIndex] ?? null;
  }

  /* ── Compare routes ─────────────────────────────────── */
  sortedAlternatives(): RouteAlternative[] {
    if (!this.calculatedRoute) return [];
    const alts = [...this.calculatedRoute.alternatives];
    if (this.compareKey === 'distance') {
      return alts.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    }
    if (this.compareKey === 'time') {
      return alts.sort((a, b) => this.durationToMin(a.duration) - this.durationToMin(b.duration));
    }
    // traffic = least delay
    return alts.sort((a, b) => this.delayToMin(a.trafficDelay) - this.delayToMin(b.trafficDelay));
  }

  private durationToMin(d: string): number {
    const hrMatch = d.match(/(\d+)\s*hr/);
    const minMatch = d.match(/(\d+)\s*min/);
    return (hrMatch ? parseInt(hrMatch[1]) * 60 : 0) + (minMatch ? parseInt(minMatch[1]) : 0);
  }
  private delayToMin(d: string): number {
    const m = d.match(/\+?(\d+)/);
    return m ? parseInt(m[1]) : 0;
  }

  /* ── Traffic ─────────────────────────────────────────── */
  private startTrafficPolling(): void {
    this.trafficSub = this.routePlannerService.liveTraffic(this.origin, this.destination).subscribe({
      next: (update) => {
        this.trafficUpdate = update;
        this.lastTrafficRefresh = new Date();
        this.cdr.detectChanges();
      },
    });
  }

  refreshTraffic(): void {
    if (!this.origin || !this.destination) return;
    this.isLoadingTraffic = true;
    this.routePlannerService.getTraffic(this.origin, this.destination).subscribe({
      next: (update) => {
        this.trafficUpdate = update;
        this.lastTrafficRefresh = new Date();
        this.isLoadingTraffic = false;
      },
      error: () => { this.isLoadingTraffic = false; },
    });
  }

  /* ── Save / Load / Delete ────────────────────────────── */
  saveRoute(): void {
    if (!this.isAuthenticated) { this.errorMessage = 'Please sign in to save routes'; return; }
    if (!this.routeName.trim()) { this.errorMessage = 'Please enter a name for this route'; return; }
    if (!this.calculatedRoute) { this.errorMessage = 'Please calculate the route first'; return; }

    this.isSaving = true;
    this.errorMessage = '';

    const route = {
      userId:          this.userId || undefined,
      name:            this.routeName,
      origin:          this.calculatedRoute.origin,
      destination:     this.calculatedRoute.destination,
      waypoints:       this.calculatedRoute.waypoints,
      distance:        this.calculatedRoute.distance,
      duration:        this.calculatedRoute.duration,
      trafficDelay:    this.calculatedRoute.trafficDelay,
      congestionLevel: this.calculatedRoute.congestionLevel,
      alternatives:    this.calculatedRoute.alternatives,
    };

    this.routePlannerService.saveRoute(route).subscribe({
      next: () => {
        this.successMessage = `Route "${this.routeName}" saved successfully!`;
        this.isSaving = false;
        this.routeName = '';
        this.loadSavedRoutes();
      },
      error: () => { this.errorMessage = 'Failed to save route.'; this.isSaving = false; },
    });
  }

  loadSavedRoutes(): void {
    this.isLoadingSavedRoutes = true;
    this.routePlannerService.getSavedRoutes(this.savedRouteSort).subscribe({
      next: (routes) => { this.savedRoutes = routes; this.isLoadingSavedRoutes = false; },
      error: () => { this.isLoadingSavedRoutes = false; },
    });
  }

  loadSavedRoute(route: SavedRoute): void {
    this.origin      = route.origin.address;
    this.destination = route.destination.address;
    this.waypoints   = (route.waypoints || []).map(w => ({ address: w.address }));
    this.routeName   = route.name;

    // Increment useCount
    if (route._id) {
      this.routePlannerService.incrementUseCount(route._id).subscribe();
    }

    if (route.distance && route.duration) {
      this.calculatedRoute = {
        origin:          route.origin,
        destination:     route.destination,
        waypoints:       route.waypoints || [],
        distance:        route.distance,
        duration:        route.duration,
        trafficDelay:    route.trafficDelay || '0 min',
        congestionLevel: (route.congestionLevel as any) || 'low',
        trafficMessage:  '',
        polyline:        [],
        alternatives:    route.alternatives || [],
        routeStats:      { distanceKm: 0, durationMin: 0, delayMin: 0, speedKmph: 0 },
        updatedAt:       route.updatedAt || route.createdAt,
      };

      setTimeout(() => {
        if (!this.map) this.initMap();
        if (this.calculatedRoute) this.drawRouteOnMap(this.calculatedRoute, 0);
      }, 100);
    }

    this.successMessage = `Loaded route: ${route.name}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteRoute(id: string): void {
    if (!confirm('Delete this saved route?')) return;
    this.routePlannerService.deleteRoute(id).subscribe({
      next: () => { this.successMessage = 'Route deleted'; this.loadSavedRoutes(); },
      error: () => { this.errorMessage = 'Failed to delete route'; },
    });
  }

  /* ── Helpers ─────────────────────────────────────────── */
  getWaypointsDisplay(wps: RouteLocation[] | undefined): string {
    return wps?.map(w => w.address).join(' → ') || '';
  }

  congestionClass(level: string | undefined): string {
    return RoutePlannerService.congestionClass(level);
  }

  congestionIcon(level: string | undefined): string {
    switch (level) {
      case 'high':     return 'traffic';
      case 'moderate': return 'warning';
      default:         return 'check_circle';
    }
  }

  altIndexOf(alt: RouteAlternative): number {
    return this.calculatedRoute?.alternatives?.indexOf(alt) ?? 0;
  }
}
