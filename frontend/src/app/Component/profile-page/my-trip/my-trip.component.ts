import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { BookingService, BookingResponse } from '../../../service/booking.service';
import { ReviewService, Review } from '../../../service/review.service';
import { ReviewFormComponent } from '../../review/review-form.component';

@Component({
  selector: 'app-my-trip',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDialogModule, ReviewFormComponent],
  templateUrl: './my-trip.component.html',
  styleUrl: './my-trip.component.css',
})
export class MyTripComponent implements OnInit {
  // Bookings loaded from API
  bookings: BookingResponse[] = [];
  
  // Review integration state
  activeReviewBookingId: string | null = null;
  bookingReviews: Map<string, Review | null> = new Map();
  
  // Classified bookings
  currentBookings: BookingResponse[] = [];
  completedBookings: BookingResponse[] = [];

  // UI states
  isLoading: boolean = true;
  error: string | null = null;
  cancellationInProgress: Set<string> = new Set();

  // Bus images for display
  imageArr = [
    { _id: { $oid: '6049b8a97501a24470b9a526' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/2323/1087/GW/DL/6fNUIf.jpeg' },
    { _id: { $oid: '6049b8a97501a24470b9a527' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/2323/1087/GW/DL/6fNUIf.jpeg' },
    { _id: { $oid: '6049b8a97501a24470b9a528' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/9365/1087/GW/DL/hDsqel.jpeg' },
    { _id: { $oid: '6049b8a97501a24470b9a529' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/10/411/ST/L/penRe7.jpeg' },
    { _id: { $oid: '6049b8a97501a24470b9a52a' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/19449/814/FR/DL/PuizKJ.jpeg' },
    { _id: { $oid: '6049b8a97501a24470b9a52b' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/2323/450/OT/L/lejRej.jpeg' },
    { _id: { $oid: '6049b8a97501a24470b9a52c' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/2323/54/ST/DL/11XMg2.jpeg' },
    { _id: { $oid: '6049b8a97501a24470b9a52d' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/2323/16/OT/L/lejRej.jpeg' },
    { _id: { $oid: '6049b8a97501a24470b9a52e' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/2323/1087/GW/DL/6fNUIf.jpeg' },
    { _id: { $oid: '6049d3567501a24470b9a533' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/4957/54/FR/L/lejRej.jpeg' },
    { _id: { $oid: '604b8aedb3f0410d74d91bef' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/9365/1087/GW/DL/hDsqel.jpeg' },
    { _id: { $oid: '604b8aedb3f0410d74d91bf0' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/2323/1087/GW/DL/6fNUIf.jpeg' },
    { _id: { $oid: '604b8aedb3f0410d74d91bf1' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/2323/1087/GW/DL/6fNUIf.jpeg' },
    { _id: { $oid: '604b8aedb3f0410d74d91bf2' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/5483/35/FR/DL/AHGCEp.jpeg' },
    { _id: { $oid: '604b8aedb3f0410d74d91bf3' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/10/54/FR/L/lejRej.jpeg' },
    { _id: { $oid: '604b8aedb3f0410d74d91bf4' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/2323/420/SI/DL/RdzzBG.jpeg' },
    { _id: { $oid: '604b8aedb3f0410d74d91bf6' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/5483/35/FR/DL/AHGCEp.jpeg' },
    { _id: { $oid: '604b8aedb3f0410d74d91bf8' }, images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/2323/1087/GW/DL/6fNUIf.jpeg' },
  ];

  // Cache for booking images to ensure stable image display
  bookingImages: Map<string, string> = new Map();

  constructor(
    private bookingService: BookingService,
    private dialog: MatDialog,
    private reviewService: ReviewService
  ) {}

  ngOnInit(): void {
    this.loadBookings();
  }

  getBookingId(booking: BookingResponse): string {
    if (!booking) return '';
    return (booking._id || booking.id || '') as string;
  }

  getBusId(booking: BookingResponse): string {
    if (!booking) return '';
    if (typeof booking.busId === 'object' && booking.busId !== null) {
      return (booking.busId as any)._id || (booking.busId as any).id || '';
    }
    return String(booking.busId || '');
  }

  getRouteId(booking: BookingResponse): string {
    if (!booking) return '';
    if (typeof booking.routeId === 'object' && booking.routeId !== null) {
      return (booking.routeId as any)._id || (booking.routeId as any).id || '';
    }
    return String(booking.routeId || '');
  }

  toggleReview(booking: BookingResponse): void {
    const bookingId = this.getBookingId(booking);
    if (!bookingId) return;
    if (this.activeReviewBookingId === bookingId) {
      this.activeReviewBookingId = null;
    } else {
      this.activeReviewBookingId = bookingId;
      if (!this.bookingReviews.has(bookingId)) {
        this.reviewService.getBookingReview(bookingId).subscribe({
          next: (res) => {
            this.bookingReviews.set(bookingId, res.review);
          },
          error: () => {
            this.bookingReviews.set(bookingId, null);
          }
        });
      }
    }
  }

  onReviewSubmitted(bookingId: string): void {
    this.reviewService.getBookingReview(bookingId).subscribe({
      next: (res) => {
        this.bookingReviews.set(bookingId, res.review);
      }
    });
  }

  onReviewEdited(bookingId: string): void {
    this.reviewService.getBookingReview(bookingId).subscribe({
      next: (res) => {
        this.bookingReviews.set(bookingId, res.review);
      }
    });
  }

  /**
   * Load user's bookings from API
   *
   * Calls BookingService.getMyBookings()
   * - Server enforces user isolation via X-User-Id header (injected by auth interceptor)
   * - Returns only bookings created by authenticated user
   * - Ordered by departure date descending (upcoming trips first)
   *
   */
  private loadBookings(): void {
    this.isLoading = true;
    this.error = null;

    this.bookingService.getMyBookings().subscribe({
      next: (bookings: BookingResponse[]) => {
        this.bookings = bookings;
        
        // Classify bookings into current/upcoming and completed
        this.classifyBookings(bookings);
        
        // Pre-assign images to each booking to avoid change detection issues
        this.bookings.forEach((booking) => {
          if (!this.bookingImages.has(booking._id || booking.id || '')) {
            this.bookingImages.set(booking._id || booking.id || '', this.getRandomImageUrl());
          }
        });
        this.isLoading = false;
      },
      error: (error: any) => {
        // Extract error message from error object
        const errorMessage = error?.message || 'Failed to load bookings';
        this.error = errorMessage;
        this.isLoading = false;
        console.error('Error loading bookings:', error);
      }
    });
  }

  /**
   * Classify bookings into current/upcoming and completed
   * 
   * Current/Upcoming: Not completed, not cancelled, and journey date is today or future
   * Completed: Completed status, cancelled status, or journey date in the past
   * 
   * Note: This classification uses the browser's local timezone. If the server stores
   * dates in a different timezone, there may be a one-day discrepancy for bookings
   * near midnight. For production, consider server-side classification or UTC timestamps.
   * 
   * @param bookings - All bookings to classify
   *
   */
  private classifyBookings(bookings: BookingResponse[]): void {
    // Get today's date at midnight in local timezone
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    this.currentBookings = bookings.filter(b => {
      // Parse journey date - assumes date string is in ISO format or compatible
      const dateStr = b.journeyDate || b.departureDate || '';
      if (!dateStr) {
        // No date available - default to completed
        return false;
      }
      
      const journeyDate = new Date(dateStr);
      journeyDate.setHours(0, 0, 0, 0);
      
      // Current/upcoming: not completed/cancelled and date is today or future
      return (
        b.status !== 'completed' && 
        b.status !== 'cancelled' && 
        !isNaN(journeyDate.getTime()) &&
        journeyDate >= today
      );
    });
    
    this.completedBookings = bookings.filter(b => {
      // Parse journey date
      const dateStr = b.journeyDate || b.departureDate || '';
      if (!dateStr) {
        // No date available - default to completed if status is terminal
        return b.status === 'completed' || b.status === 'cancelled';
      }
      
      const journeyDate = new Date(dateStr);
      journeyDate.setHours(0, 0, 0, 0);
      
      // Completed: completed status, cancelled status, or past date
      return (
        b.status === 'completed' || 
        b.status === 'cancelled' ||
        (isNaN(journeyDate.getTime()) || journeyDate < today)
      );
    });
  }

  /**
   * Get a random bus image URL from the array
   * Internal method that returns a URL string
   *
   * @private
   * @returns Random bus image URL
   */
  private getRandomImageUrl(): string {
    const randomindex = Math.floor(Math.random() * this.imageArr.length);
    return this.imageArr[randomindex].images;
  }

  /**
   * Get a random bus image from the array
   * Used by template to display images
   *
   * @param bookingId - Booking ID to get cached image
   * @returns Random bus image URL
   */
  getRandomImage(bookingId: string): string {
    if (bookingId && !this.bookingImages.has(bookingId)) {
      this.bookingImages.set(bookingId, this.getRandomImageUrl());
    }
    return this.bookingImages.get(bookingId) || '';
  }

  /**
   * Get human-readable payment method label
   *
   * @param method - Payment method from booking (cash_on_trip or online)
   * @returns Formatted label for display
   *
   */
  getPaymentMethodLabel(method: string): string {
    if (method === 'cash_on_trip') {
      return 'Cash on Trip';
    }
    return 'Online Payment';
  }

  /**
   * Check if booking can be cancelled
   *
   * Bookings can only be cancelled if they are:
   * - Not completed
   * - Not already cancelled
   *
   * @param booking - Booking object
   * @returns True if booking can be cancelled
   */
  canCancelBooking(booking: BookingResponse): boolean {
    return booking.status !== 'completed' && booking.status !== 'cancelled';
  }

  /**
   * Handle cancel booking button click
   *
   * Shows a confirmation dialog with the refund amount
   * On confirmation, calls BookingService.cancelBooking()
   * Displays refund result and refreshes booking list
   *
   * @param booking - Booking to cancel
   *
   */
  onCancelBooking(booking: BookingResponse): void {
    // Show browser confirmation dialog with refund information
    // In a real app, this would be a custom Material dialog component
    const confirmMessage = `Are you sure you want to cancel this booking?\n\nYou will receive a refund of ₹${booking.fare} (minus any applicable cancellation charges).`;

    if (window.confirm(confirmMessage)) {
      // Mark this booking as cancellation in progress
      const bookingId = booking._id || booking.id || '';
      this.cancellationInProgress.add(bookingId);

      this.bookingService.cancelBooking(bookingId).subscribe({
        next: (result: any) => {
          // Show success message with refund amount
          alert(`Booking cancelled successfully!\n\nRefund Amount: ₹${result.refundAmount}`);

          // Refresh bookings list
          this.loadBookings();

          // Remove from in-progress set
          this.cancellationInProgress.delete(bookingId);
        },
        error: (error: any) => {
          // Show error message
          const errorMessage = error?.message || 'Failed to cancel booking';
          alert(`Cancellation failed: ${errorMessage}`);

          // Remove from in-progress set
          this.cancellationInProgress.delete(bookingId);

          console.error('Error cancelling booking:', error);
        }
      });
    }
  }

  /**
   * Check if cancellation is in progress for a booking
   *
   * @param bookingId - ID of booking
   * @returns True if cancellation is in progress
   */
  isCancellationInProgress(bookingId: string): boolean {
    return this.cancellationInProgress.has(bookingId);
  }
}
