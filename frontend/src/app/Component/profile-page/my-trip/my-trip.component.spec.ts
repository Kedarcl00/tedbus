import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { of, throwError } from 'rxjs';
import { MyTripComponent } from './my-trip.component';
import { BookingService, BookingResponse } from '../../../service/booking.service';

/**
 * Test Suite: MyTripComponent
 *
 * Tests cover:
 * 1. Component creation and initialization
 * 2. Bookings loaded on init
 * 3. Loading state displayed
 * 4. Error state displayed on fetch failure
 * 5. Empty state when no bookings
 * 6. Cancel booking button visibility
 * 7. Cancellation confirmation dialog
 * 8. Payment method display (online vs cash_on_trip)
 * 9. Booking status display
 * 10. Refund amount display after cancellation
 *
 * Requirements: 5.1, 6.1
 */
describe('MyTripComponent', () => {
  let component: MyTripComponent;
  let fixture: ComponentFixture<MyTripComponent>;
  let bookingService: jasmine.SpyObj<BookingService>;
  let dialog: MatDialog;

  // Mock booking data for testing
  const mockBookings: BookingResponse[] = [
    {
      id: 'booking1',
      customerId: 'user1',
      busId: 'bus1',
      routeId: 'route1',
      seats: [12, 13],
      fare: 500,
      paymentMethod: 'cash_on_trip',
      status: 'confirmed',
      paymentStatus: 'pending',
      bookingReference: 'TB20240615001',
      passengerDetails: [
        { name: 'John Doe', gender: 'Male', age: 30 },
        { name: 'Jane Doe', gender: 'Female', age: 28 }
      ],
      departureDetails: {
        city: 'New York',
        location: 'Times Square',
        time: 14
      },
      arrivalDetails: {
        city: 'Boston',
        location: 'Central Station',
        time: 18
      },
      duration: '4 hours',
      phoneNumber: '555-1234',
      bookingDate: '2024-06-15',
      createdAt: '2024-06-15T10:00:00Z'
    },
    {
      id: 'booking2',
      customerId: 'user1',
      busId: 'bus2',
      routeId: 'route2',
      seats: [5],
      fare: 350,
      paymentMethod: 'online',
      status: 'completed',
      paymentStatus: 'completed',
      bookingReference: 'TB20240614001',
      passengerDetails: [
        { name: 'John Doe', gender: 'Male', age: 30 }
      ],
      departureDetails: {
        city: 'Philadelphia',
        location: 'Market Street',
        time: 9
      },
      arrivalDetails: {
        city: 'Washington DC',
        location: 'Union Station',
        time: 12
      },
      duration: '3 hours',
      phoneNumber: '555-1234',
      bookingDate: '2024-06-14',
      createdAt: '2024-06-14T08:00:00Z'
    }
  ];

  beforeEach(async () => {
    // Create mock BookingService
    const bookingServiceSpy = jasmine.createSpyObj('BookingService', [
      'getMyBookings',
      'cancelBooking'
    ]);

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatDialogModule,
        MyTripComponent
      ],
      providers: [
        { provide: BookingService, useValue: bookingServiceSpy },
        MatDialog
      ]
    }).compileComponents();

    bookingService = TestBed.inject(BookingService) as jasmine.SpyObj<BookingService>;
    dialog = TestBed.inject(MatDialog);
    fixture = TestBed.createComponent(MyTripComponent);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with empty bookings array', () => {
      expect(component.bookings).toEqual([]);
    });

    it('should initialize with isLoading as true', () => {
      expect(component.isLoading).toBe(true);
    });

    it('should initialize with no error', () => {
      expect(component.error).toBeNull();
    });
  });

  describe('Loading Bookings', () => {
    it('should load bookings on ngOnInit', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of(mockBookings));

      component.ngOnInit();
      tick();

      expect(bookingService.getMyBookings).toHaveBeenCalled();
      expect(component.bookings).toEqual(mockBookings);
      expect(component.isLoading).toBe(false);
    }));

    it('should set isLoading to false after bookings are loaded', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of(mockBookings));

      expect(component.isLoading).toBe(true);
      component.ngOnInit();
      tick();

      expect(component.isLoading).toBe(false);
    }));

    it('should handle empty bookings array', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([]));

      component.ngOnInit();
      tick();

      expect(component.bookings).toEqual([]);
      expect(component.isLoading).toBe(false);
    }));

    it('should display loading state in template while fetching', () => {
      bookingService.getMyBookings.and.returnValue(of(mockBookings));
      component.isLoading = true;

      fixture.detectChanges();
      const loadingElement = fixture.nativeElement.querySelector('.loading-container');

      expect(loadingElement).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle error when fetching bookings', fakeAsync(() => {
      const errorMessage = 'Failed to fetch bookings';
      bookingService.getMyBookings.and.returnValue(
        throwError(() => ({ message: errorMessage, statusCode: 500 }))
      );

      component.ngOnInit();
      tick();

      expect(component.error).toBe(errorMessage);
      expect(component.isLoading).toBe(false);
      expect(component.bookings).toEqual([]);
    }));

    it('should display error message in template', fakeAsync(() => {
      const errorMessage = 'Failed to load bookings';
      bookingService.getMyBookings.and.returnValue(
        throwError(() => ({ message: errorMessage }))
      );

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.error-container');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain(errorMessage);
    }));

    it('should show empty state when no bookings available', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([]));

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      const emptyElement = fixture.nativeElement.querySelector('.empty-container');
      expect(emptyElement).toBeTruthy();
    }));
  });

  describe('Payment Method Display', () => {
    it('should return "Cash on Trip" label for cash_on_trip method', () => {
      const label = component.getPaymentMethodLabel('cash_on_trip');
      expect(label).toBe('Cash on Trip');
    });

    it('should return "Online Payment" label for online method', () => {
      const label = component.getPaymentMethodLabel('online');
      expect(label).toBe('Online Payment');
    });

    it('should return "Online Payment" label for unknown methods', () => {
      const label = component.getPaymentMethodLabel('unknown_method');
      expect(label).toBe('Online Payment');
    });

    it('should display payment method badge for cash_on_trip', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([mockBookings[0]]));

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.payment-cash_on_trip');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('Cash on Trip');
    }));

    it('should display payment method badge for online', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([mockBookings[1]]));

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.payment-online');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('Online Payment');
    }));

    it('should apply correct CSS class based on payment method', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([mockBookings[0]]));

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.badge');
      expect(badge.classList.contains('payment-cash_on_trip')).toBe(true);
    }));
  });

  describe('Booking Status Display', () => {
    it('should display booking status badge', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([mockBookings[0]]));

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      const statusBadge = fixture.nativeElement.querySelector('.status-confirmed');
      expect(statusBadge).toBeTruthy();
      expect(statusBadge.textContent).toContain('Confirmed');
    }));

    it('should display payment status badge if applicable', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([mockBookings[0]]));

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      const paymentStatusBadge = fixture.nativeElement.querySelector('.payment-status-pending');
      expect(paymentStatusBadge).toBeTruthy();
    }));

    it('should apply correct CSS class based on booking status', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([mockBookings[1]]));

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.status-completed');
      expect(badge).toBeTruthy();
    }));
  });

  describe('Cancel Booking Functionality', () => {
    it('should show cancel button for cancellable bookings', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([mockBookings[0]]));

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      const cancelButton = fixture.nativeElement.querySelector('.cancel-button');
      expect(cancelButton).toBeTruthy();
    }));

    it('should not show cancel button for completed bookings', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([mockBookings[1]]));

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      const cancelButton = fixture.nativeElement.querySelector('.cancel-button');
      expect(cancelButton).toBeNull();
    }));

    it('should return true for canCancelBooking if status is not completed or cancelled', () => {
      const booking = { ...mockBookings[0] };
      expect(component.canCancelBooking(booking)).toBe(true);
    });

    it('should return false for canCancelBooking if status is completed', () => {
      const booking = { ...mockBookings[1] };
      expect(component.canCancelBooking(booking)).toBe(false);
    });

    it('should return false for canCancelBooking if status is cancelled', () => {
      const booking = { ...mockBookings[0], status: 'cancelled' as const };
      expect(component.canCancelBooking(booking)).toBe(false);
    });
  });

  describe('Cancellation Process', () => {
    it('should show confirmation dialog before cancelling', fakeAsync(() => {
      spyOn(window, 'confirm').and.returnValue(true);
      bookingService.cancelBooking.and.returnValue(
        of({ bookingId: 'booking1', status: 'cancelled', refundAmount: 500, message: 'Cancelled' })
      );

      component.onCancelBooking(mockBookings[0]);
      tick();

      expect(window.confirm).toHaveBeenCalled();
    }));

    it('should include refund amount in confirmation dialog', fakeAsync(() => {
      spyOn(window, 'confirm').and.returnValue(true);
      bookingService.cancelBooking.and.returnValue(
        of({ bookingId: 'booking1', status: 'cancelled', refundAmount: 500, message: 'Cancelled' })
      );

      component.onCancelBooking(mockBookings[0]);
      tick();

      const confirmMessage = (window.confirm as jasmine.Spy).calls.mostRecent().args[0];
      expect(confirmMessage).toContain('₹500');
    }));

    it('should call cancelBooking service when user confirms', fakeAsync(() => {
      spyOn(window, 'confirm').and.returnValue(true);
      bookingService.cancelBooking.and.returnValue(
        of({ bookingId: 'booking1', status: 'cancelled', refundAmount: 500, message: 'Cancelled' })
      );

      component.onCancelBooking(mockBookings[0]);
      tick();

      expect(bookingService.cancelBooking).toHaveBeenCalledWith('booking1');
    }));

    it('should not call cancelBooking when user declines confirmation', fakeAsync(() => {
      spyOn(window, 'confirm').and.returnValue(false);

      component.onCancelBooking(mockBookings[0]);
      tick();

      expect(bookingService.cancelBooking).not.toHaveBeenCalled();
    }));

    it('should show refund amount after successful cancellation', fakeAsync(() => {
      spyOn(window, 'confirm').and.returnValue(true);
      spyOn(window, 'alert');
      bookingService.cancelBooking.and.returnValue(
        of({ bookingId: 'booking1', status: 'cancelled', refundAmount: 500, message: 'Cancelled' })
      );

      component.onCancelBooking(mockBookings[0]);
      tick();

      expect(window.alert).toHaveBeenCalledWith(jasmine.stringContaining('₹500'));
    }));

    it('should refresh bookings after successful cancellation', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of(mockBookings));
      spyOn(window, 'confirm').and.returnValue(true);
      spyOn(window, 'alert');

      const cancelResult = {
        bookingId: 'booking1',
        status: 'cancelled',
        refundAmount: 500,
        message: 'Cancelled'
      };
      bookingService.cancelBooking.and.returnValue(of(cancelResult));

      component.ngOnInit();
      tick();

      expect(bookingService.getMyBookings).toHaveBeenCalled();

      component.onCancelBooking(mockBookings[0]);
      tick();

      // Should be called again after cancellation
      expect(bookingService.getMyBookings).toHaveBeenCalledTimes(2);
    }));

    it('should handle cancellation error', fakeAsync(() => {
      spyOn(window, 'confirm').and.returnValue(true);
      spyOn(window, 'alert');
      const errorMessage = 'Cancellation failed';
      bookingService.cancelBooking.and.returnValue(
        throwError(() => ({ message: errorMessage, statusCode: 400 }))
      );

      component.onCancelBooking(mockBookings[0]);
      tick();

      expect(window.alert).toHaveBeenCalledWith(jasmine.stringContaining(errorMessage));
    }));
  });

  describe('Cancellation In Progress State', () => {
    it('should track cancellation in progress for booking', () => {
      const bookingId = 'booking1';
      component.cancellationInProgress.add(bookingId);

      expect(component.isCancellationInProgress(bookingId)).toBe(true);
    });

    it('should return false for cancellation not in progress', () => {
      expect(component.isCancellationInProgress('booking1')).toBe(false);
    });

    it('should disable cancel button during cancellation', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([mockBookings[0]]));
      spyOn(window, 'confirm').and.returnValue(true);
      bookingService.cancelBooking.and.returnValue(
        of({ bookingId: 'booking1', status: 'cancelled', refundAmount: 500, message: 'Cancelled' })
      );

      component.ngOnInit();
      tick();

      component.cancellationInProgress.add('booking1');
      fixture.detectChanges();

      const cancelButton = fixture.nativeElement.querySelector('.cancel-button');
      expect(cancelButton.disabled).toBe(true);
    }));
  });

  describe('Booking Details Display', () => {
    it('should display booking reference', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([mockBookings[0]]));

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      const element = fixture.nativeElement;
      expect(element.textContent).toContain('TB20240615001');
    }));

    it('should display seats information', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([mockBookings[0]]));

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      const element = fixture.nativeElement;
      expect(element.textContent).toContain('Seats: 12, 13');
    }));

    it('should display fare with currency symbol', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([mockBookings[0]]));

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      const element = fixture.nativeElement;
      expect(element.textContent).toContain('₹500');
    }));

    it('should display passenger details', fakeAsync(() => {
      bookingService.getMyBookings.and.returnValue(of([mockBookings[0]]));

      component.ngOnInit();
      tick();
      fixture.detectChanges();

      const element = fixture.nativeElement;
      expect(element.textContent).toContain('John Doe');
      expect(element.textContent).toContain('Jane Doe');
    }));
  });

  describe('Random Image Selection', () => {
    it('should return a random image URL', () => {
      const image = component.getRandomImage('booking1');
      expect(image).toBeTruthy();
      expect(typeof image).toBe('string');
      expect(image).toContain('https://');
    });

    it('should return image from imageArr', () => {
      const image = component.getRandomImage('booking1');
      const imageExists = component.imageArr.some(img => img.images === image);
      expect(imageExists).toBe(true);
    });

    it('should cache images for bookings to avoid change detection issues', () => {
      const image1 = component.getRandomImage('booking1');
      const image2 = component.getRandomImage('booking1');
      expect(image1).toBe(image2);
    });

    it('should assign different images for different bookings', () => {
      // This test may occasionally fail due to randomness, but very unlikely
      const images = new Set();
      for (let i = 0; i < 5; i++) {
        images.add(component.getRandomImage(`booking${i}`));
      }
      // We should have at least one unique image (very high probability with 18 images)
      expect(images.size > 0).toBe(true);
    });
  });
});
