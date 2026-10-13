import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { BusService } from '../../service/bus.service';
import { AuthService } from '../../service/auth.service';
import { CustomerService, UserProfile } from '../../service/customer.service';
import { Booking } from '../../model/booking.model';
import { MyTripComponent } from './my-trip/my-trip.component';

/**
 * ProfilePageComponent - User profile and bookings management page
 *
 * Responsibilities:
 * - Display user profile fetched from GET /api/users/profile
 * - Display user's bookings from BookingService
 * - Handle profile display with loading and error states
 * - Enforce user isolation (profile belongs to authenticated user)
 *
 * Layout:
 * - Left sidebar: Navigation (Trips, Profile, Wallet)
 * - Right panel: Content area for selected section
 *   - Trips: List of user's bookings (via MyTripComponent)
 *   - Profile: User profile information (name, email, DOB, gender, phone)
 *   - Wallet: Placeholder for future feature
 *
 * Data Flow:
 * 1. Component initializes
 * 2. AuthService validates user is logged in
 * 3. CustomerService.getProfile() fetches user profile from API
 * 4. BusService.getbusmongo() fetches user's bookings
 * 5. Profile and bookings displayed in respective sections
 *
 * Error Handling:
 * - Profile load error: Shows error message
 * - Booking load error: Logs error and shows empty list
 * - 401 Unauthorized: Would be handled by auth interceptor
 * - 403 Forbidden: Would indicate security violation (handled by interceptor)
 *
 * Requirements: 2.3, 2.4 (user profile isolation)
 */
@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslateModule, MyTripComponent],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.css',
})
export class ProfilePageComponent implements OnInit {
  // UI state
  selecteditem: string = 'trips';
  
  // Profile state - Requirements: 2.3, 2.4
  isLoading: boolean = true;
  profileError: string | null = null;
  userProfile: UserProfile | null = null;
  
  // Legacy properties (kept for backward compatibility during transition)
  currentcustomer: any = null;
  currentname: string = '';
  currentemail: string = '';

  /**
   * Handle sidebar navigation clicks
   * @param selected - Selected section: 'trips', 'profile', or 'wallet'
   */
  handlelistitemclick(selected: string): void {
    this.selecteditem = selected;
  }

  constructor(
    private busbooking: BusService,
    private authservice: AuthService,
    private customerService: CustomerService,
    private router: Router,
  ) {}

  /**
   * Component initialization
   *
   * Flow:
   * 1. Check if user is authenticated (defensive check)
   * 2. Load user profile from API (GET /api/users/profile)
   * 3. Load user's bookings from API (legacy BusService.getbusmongo)
   *
   * Requirements: 2.3, 2.4
   */
  ngOnInit(): void {
    // Defensive check: ensure user is authenticated
    // AuthGuard should already validate this, but good defensive practice
    const user = this.authservice.currentUser;
    if (!user) {
      this.router.navigate(['/']);
      return;
    }

    // Keep legacy properties for backward compatibility
    this.currentcustomer = user;
    this.currentname = user.name ?? '';
    this.currentemail = user.email ?? '';

    // Fetch user profile from API - Requirements: 2.3
    // The API enforces user isolation server-side (via X-User-Id header from interceptor)
    // User can only access their own profile (403 Forbidden if trying to access another)
    this.fetchUserProfile();
  }

  /**
   * Fetch current user profile from API
   *
   * Calls: GET /api/users/profile
   * - Backend enforces user isolation via X-User-Id header (injected by interceptor)
   * - Only returns authenticated user's profile
   * - Returns 403 Forbidden if user tries to access another profile
   * - Returns 404 Not Found if profile doesn't exist
   *
   * Requirements: 2.3, 2.4
   */
  private fetchUserProfile(): void {
    this.isLoading = true;
    this.profileError = null;

    this.customerService.getProfile().subscribe({
      next: (profile: UserProfile) => {
        this.userProfile = profile;
        this.isLoading = false;
        console.log('Profile loaded successfully:', profile);
      },
      error: (error: any) => {
        // Handle various error scenarios
        if (error.statusCode === 403) {
          this.profileError = 'Access denied: You do not have permission to view this profile';
        } else if (error.statusCode === 404) {
          this.profileError = 'Profile not found';
        } else if (error.statusCode === 401) {
          this.profileError = 'Please log in to view your profile';
          // Could redirect to login here if needed
        } else {
          this.profileError = error.message || 'Failed to load profile. Please try again later.';
        }
        this.isLoading = false;
        console.error('Error fetching profile:', error);
      },
    });
  }
}
