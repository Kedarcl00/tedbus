import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BusService } from '../../service/bus.service';
import { AuthService } from '../../service/auth.service';
import { CustomerService, UserProfile } from '../../service/customer.service';
import { Booking } from '../../model/booking.model';
import { MyTripComponent } from './my-trip/my-trip.component';
import { PostCardComponent } from '../community/post-card/post-card.component';
import { CommunityService, Post } from '../../service/community.service';

/**
 * ProfilePageComponent - User profile and bookings management page
 *
 * Responsibilities:
 * - Display user profile fetched from GET /api/users/profile
 * - Display user's bookings from BookingService
 * - Display user's community posts and activity
 * - Handle profile display with loading and error states
 * - Enforce user isolation (profile belongs to authenticated user)
 *
 * Layout:
 * - Left sidebar: Navigation (Trips, Profile, Community, Wallet)
 * - Right panel: Content area for selected section
 *   - Trips: List of user's bookings (via MyTripComponent)
 *   - Profile: User profile information (name, email, DOB, gender, phone)
 *   - Community: User's posts and interactions
 *   - Wallet: Placeholder for future feature
 */
@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslateModule, MyTripComponent, PostCardComponent],
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

  // Profile Edit state
  isEditing: boolean = false;
  isSaving: boolean = false;
  saveSuccessMessage: string | null = null;
  saveErrorMessage: string | null = null;
  editForm = {
    name: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
  };

  // Community Activity state
  userPosts: Post[] = [];
  loadingCommunity: boolean = false;
  totalLikesReceived: number = 0;
  
  // Legacy properties (kept for backward compatibility during transition)
  currentcustomer: any = null;
  currentname: string = '';
  currentemail: string = '';

  /**
   * Handle sidebar navigation clicks
   * @param selected - Selected section: 'trips', 'profile', 'community', or 'wallet'
   */
  handlelistitemclick(selected: string): void {
    this.selecteditem = selected;
    if (selected === 'community') {
      this.loadUserCommunityActivity();
    }
  }

  constructor(
    private busbooking: BusService,
    public authservice: AuthService,
    private customerService: CustomerService,
    private communityService: CommunityService,
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

  /**
   * Start editing profile
   */
  startEditing(): void {
    if (!this.userProfile) return;
    let dob = '';
    if (this.userProfile.dateOfBirth) {
      const d = new Date(this.userProfile.dateOfBirth);
      if (!isNaN(d.getTime())) {
        dob = d.toISOString().split('T')[0];
      }
    }
    this.editForm = {
      name: this.userProfile.name || '',
      phone: this.userProfile.phone || '',
      gender: this.userProfile.gender || '',
      dateOfBirth: dob,
    };
    this.saveSuccessMessage = null;
    this.saveErrorMessage = null;
    this.isEditing = true;
  }

  /**
   * Cancel profile editing
   */
  cancelEditing(): void {
    this.isEditing = false;
    this.saveErrorMessage = null;
  }

  /**
   * Save updated profile
   */
  saveProfile(): void {
    if (!this.editForm.name.trim()) {
      this.saveErrorMessage = 'Name cannot be empty';
      return;
    }

    this.isSaving = true;
    this.saveErrorMessage = null;
    this.saveSuccessMessage = null;

    const updateData = {
      name: this.editForm.name.trim(),
      phone: this.editForm.phone.trim(),
      gender: this.editForm.gender,
      dateOfBirth: this.editForm.dateOfBirth || undefined,
    };

    this.customerService.updateProfile(updateData).subscribe({
      next: (updatedProfile: UserProfile) => {
        this.userProfile = updatedProfile;
        this.currentname = updatedProfile.name || this.currentname;
        this.isSaving = false;
        this.isEditing = false;
        this.saveSuccessMessage = 'Profile updated successfully!';

        // Update sessionStorage user data so other components stay in sync
        const currentUserStr = sessionStorage.getItem('Loggedinuser');
        if (currentUserStr) {
          try {
            const parsed = JSON.parse(currentUserStr);
            parsed.name = updatedProfile.name;
            if (updatedProfile.phone) parsed.phone = updatedProfile.phone;
            sessionStorage.setItem('Loggedinuser', JSON.stringify(parsed));
          } catch (e) {
            console.error('Failed to update sessionStorage user', e);
          }
        }

        setTimeout(() => {
          this.saveSuccessMessage = null;
        }, 4000);
      },
      error: (err: any) => {
        this.isSaving = false;
        this.saveErrorMessage = err.message || 'Failed to update profile. Please try again.';
      },
    });
  }

  /**
   * Load current user's community posts and calculate interaction metrics
   */
  loadUserCommunityActivity(): void {
    const user = this.authservice.currentUser;
    if (!user) return;
    this.loadingCommunity = true;
    const authorId = user.id || user.googleId || user['_id'];

    this.communityService.getUserPosts(authorId).subscribe({
      next: ({ posts }) => {
        this.userPosts = posts || [];
        this.totalLikesReceived = this.userPosts.reduce(
          (sum, p) => sum + (p.likes ? p.likes.length : 0),
          0
        );
        this.loadingCommunity = false;
      },
      error: () => {
        this.loadingCommunity = false;
      }
    });
  }

  onDeleteUserPost(postId: string): void {
    this.communityService.deletePost(postId).subscribe({
      next: () => {
        this.userPosts = this.userPosts.filter(p => p._id !== postId);
        this.totalLikesReceived = this.userPosts.reduce(
          (sum, p) => sum + (p.likes ? p.likes.length : 0),
          0
        );
      }
    });
  }

  onUserPostUpdated(updatedPost: Post): void {
    const idx = this.userPosts.findIndex(p => p._id === updatedPost._id);
    if (idx !== -1) {
      this.userPosts[idx] = updatedPost;
    }
  }

  navigateToCommunity(): void {
    this.router.navigate(['/community']);
  }
}
