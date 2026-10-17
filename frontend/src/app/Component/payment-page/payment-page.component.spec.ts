/// <reference types="jasmine" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PaymentPageComponent } from './payment-page.component';
import { DataserviceService } from '../../service/dataservice.service';
import { BusService } from '../../service/bus.service';
import { BookingService } from '../../service/booking.service';
import { AuthService } from '../../service/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

describe('PaymentPageComponent', () => {
  let component: PaymentPageComponent;
  let fixture: ComponentFixture<PaymentPageComponent>;
  let mockRouter: any;
  let mockActivatedRoute: any;
  let mockDataService: any;
  let mockBusService: any;
  let mockBookingService: any;
  let mockAuthService: any;

  beforeEach(async () => {
    // Create mock services
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);
    mockActivatedRoute = {
      params: of({
        operatorname: 'Test Bus Company',
        selectedseat: [1, 2, 3],
        passemail: 'test@example.com',
        passphn: '1234567890',
        passisbuisness: false,
        passinsurance: false,
        seatprice: 500,
        busid: 'BUS001',
        busarrivaltime: 18,
        busdeparturetime: 10,
        passiscoviddonate: false,
      })
    };
    mockDataService = {
      currentdata: of({
        departureLocation: { name: 'City A' },
        arrivalLocation: { name: 'City B' },
        duration: '8 hours',
      }),
      passdata: of([
        { name: 'Passenger 1', gender: 'M', age: 30 },
        { name: 'Passenger 2', gender: 'F', age: 25 },
      ]),
    };
    mockBusService = jasmine.createSpyObj('BusService', ['addbusmongo']);
    mockBookingService = jasmine.createSpyObj('BookingService', ['createBooking']);
    mockAuthService = {
      currentUser: {
        _id: 'USER001',
        name: 'Test User',
        email: 'test@example.com',
      }
    };

    await TestBed.configureTestingModule({
      imports: [PaymentPageComponent, CommonModule, FormsModule, MatIconModule],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: DataserviceService, useValue: mockDataService },
        { provide: BusService, useValue: mockBusService },
        { provide: BookingService, useValue: mockBookingService },
        { provide: AuthService, useValue: mockAuthService },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Payment Method Selection', () => {
    it('should initialize with "online" as default payment method ', () => {
      expect(component.selectedPaymentMethod).toBe('online');
    });

    it('should allow selection of "cash_on_trip" payment method', () => {
      component.selectedPaymentMethod = 'cash_on_trip';
      expect(component.selectedPaymentMethod).toBe('cash_on_trip');
    });

    it('should allow toggling back to "online" payment method', () => {
      component.selectedPaymentMethod = 'cash_on_trip';
      component.selectedPaymentMethod = 'online';
      expect(component.selectedPaymentMethod).toBe('online');
    });
  });

  describe('Payment Form Visibility', () => {
    it('should show online payment section when selectedPaymentMethod is "online"', () => {
      fixture.detectChanges();
      component.selectedPaymentMethod = 'online';
      fixture.detectChanges();

      const onlineSection = fixture.nativeElement.querySelector('.online-payment-section');
      expect(onlineSection).toBeTruthy();
    });

    it('should hide cash on trip section when selectedPaymentMethod is "online"', () => {
      fixture.detectChanges();
      component.selectedPaymentMethod = 'online';
      fixture.detectChanges();

      const cashSection = fixture.nativeElement.querySelector('.cash-on-trip-section');
      expect(cashSection).toBeFalsy();
    });

    it('should show cash on trip section when selectedPaymentMethod is "cash_on_trip" ', () => {
      fixture.detectChanges();
      component.selectedPaymentMethod = 'cash_on_trip';
      fixture.detectChanges();

      const cashSection = fixture.nativeElement.querySelector('.cash-on-trip-section');
      expect(cashSection).toBeTruthy();
    });

    it('should hide online payment section when selectedPaymentMethod is "cash_on_trip"', () => {
      fixture.detectChanges();
      component.selectedPaymentMethod = 'cash_on_trip';
      fixture.detectChanges();

      const onlineSection = fixture.nativeElement.querySelector('.online-payment-section');
      expect(onlineSection).toBeFalsy();
    });
  });

  describe('Button Text and State', () => {
    it('should display "Proceed to Payment" button when online payment selected', () => {
      fixture.detectChanges();
      component.selectedPaymentMethod = 'online';
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.Payment__stripe__button');
      expect(button?.textContent).toContain('Proceed to Payment');
    });

    it('should display "Confirm Booking" button when cash on trip selected', () => {
      fixture.detectChanges();
      component.selectedPaymentMethod = 'cash_on_trip';
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.confirm-booking-button');
      expect(button?.textContent).toContain('Confirm Booking');
    });

    it('should disable buttons and show "Processing..." during submission', () => {
      component.isSubmitting = true;
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('button[type="button"]');
      buttons.forEach((btn: any) => {
        expect(btn.disabled).toBe(true);
        expect(btn.textContent).toContain('Processing...');
      });
    });
  });

  describe('Booking Creation with PaymentMethod ', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should call BookingService.createBooking() with correct payload when online payment', (done) => {
      component.selectedPaymentMethod = 'online';
      mockBookingService.createBooking.and.returnValue(of({
        id: 'BOOKING001',
        bookingReference: 'TB20240615001',
        status: 'confirmed',
        customerId: 'USER001',
        busId: 'BUS001',
        routeId: 'ROUTE001',
        seats: [],
        fare: 0,
        paymentMethod: 'online',
        departureDetails: {},
        arrivalDetails: {},
        duration: '',
        phoneNumber: '',
        bookingDate: '',
        passengerDetails: []
      }));

      component.makepayment();

      setTimeout(() => {
        expect(mockBookingService.createBooking).toHaveBeenCalled();
        const callArgs = mockBookingService.createBooking.calls.mostRecent().args[0];
        expect(callArgs.paymentMethod).toBe('online');
        done();
      }, 100);
    });

    it('should call BookingService.createBooking() with correct payload when cash on trip ', (done) => {
      component.selectedPaymentMethod = 'cash_on_trip';
      mockBookingService.createBooking.and.returnValue(of({
        id: 'BOOKING001',
        bookingReference: 'TB20240615001',
        status: 'confirmed',
        paymentMethod: 'cash_on_trip',
        customerId: 'USER001',
        busId: 'BUS001',
        routeId: 'ROUTE001',
        seats: [],
        fare: 0,
        departureDetails: {},
        arrivalDetails: {},
        duration: '',
        phoneNumber: '',
        bookingDate: '',
        passengerDetails: []
      }));

      component.makepayment();

      setTimeout(() => {
        expect(mockBookingService.createBooking).toHaveBeenCalled();
        const callArgs = mockBookingService.createBooking.calls.mostRecent().args[0];
        expect(callArgs.paymentMethod).toBe('cash_on_trip');
        done();
      }, 100);
    });

    it('should include all required fields in booking payload', (done) => {
      component.passseatarray = [1, 2, 3];
      component.passfare = 1500;
      component.phonenumber = '1234567890';
      component.busid = 'BUS001';
      component.routeId = 'ROUTE001';
      component.routedetails = {
        departureLocation: { name: 'City A' },
        arrivalLocation: { name: 'City B' },
        duration: '8 hours',
      };
      component.busdepauturetime = 10;
      component.busarrivaltime = 18;
      component.passengerdetails = [{ name: 'Passenger 1', gender: 'M', age: 30 }];

      mockBookingService.createBooking.and.returnValue(of({
        id: 'BOOKING001',
        bookingReference: 'TB20240615001',
        customerId: 'USER001',
        busId: 'BUS001',
        routeId: 'ROUTE001',
        seats: [1, 2, 3],
        fare: 1500,
        paymentMethod: 'online',
        departureDetails: {},
        arrivalDetails: {},
        duration: '',
        phoneNumber: '1234567890',
        bookingDate: '',
        passengerDetails: [{ name: 'Passenger 1', gender: 'M', age: 30 }]
      }));

      component.makepayment();

      setTimeout(() => {
        const callArgs = mockBookingService.createBooking.calls.mostRecent().args[0];
        expect(callArgs.busId).toBe('BUS001');
        expect(callArgs.routeId).toBe('ROUTE001');
        expect(callArgs.seats).toEqual([1, 2, 3]);
        expect(callArgs.fare).toBe(1500);
        expect(callArgs.passengers).toEqual([{ name: 'Passenger 1', gender: 'M', age: 30 }]);
        done();
      }, 100);
    });
  });

  describe('Successful Booking', () => {
    it('should show receipt modal on successful booking ', (done) => {
      component.selectedPaymentMethod = 'cash_on_trip';
      const mockResponse = {
        id: 'BOOKING001',
        bookingReference: 'TB20240615001',
        status: 'confirmed',
        customerId: 'USER001',
        busId: 'BUS001',
        routeId: 'ROUTE001',
        seats: [1, 2, 3],
        fare: 1500,
        paymentMethod: 'cash_on_trip',
        departureDetails: { city: 'City A', location: 'Location A', time: '10:00' },
        arrivalDetails: { city: 'City B', location: 'Location B', time: '18:00' },
        duration: '8 hours',
        phoneNumber: '1234567890',
        bookingDate: '2024-06-15',
        passengerDetails: []
      };

      mockBookingService.createBooking.and.returnValue(of(mockResponse));

      fixture.detectChanges();
      component.makepayment();

      setTimeout(() => {
        expect(component.showReceipt).toBe(true);
        expect(component.receiptData).toBeTruthy();
        expect(component.receiptData.bookingReference).toBe('TB20240615001');
        done();
      }, 100);
    });

    it('should include customer details in receipt data', (done) => {
      component.selectedPaymentMethod = 'cash_on_trip';
      const mockResponse = {
        id: 'BOOKING001',
        bookingReference: 'TB20240615001',
        status: 'confirmed',
        customerId: 'USER001',
        busId: 'BUS001',
        routeId: 'ROUTE001',
        seats: [1, 2, 3],
        fare: 1500,
        paymentMethod: 'cash_on_trip',
        departureDetails: { city: 'City A', location: 'Location A', time: '10:00' },
        arrivalDetails: { city: 'City B', location: 'Location B', time: '18:00' },
        duration: '8 hours',
        phoneNumber: '1234567890',
        bookingDate: '2024-06-15',
        passengerDetails: []
      };

      mockBookingService.createBooking.and.returnValue(of(mockResponse));

      fixture.detectChanges();
      component.makepayment();

      setTimeout(() => {
        expect(component.receiptData.customerName).toBe('Test User');
        expect(component.receiptData.customerEmail).toBe('test@example.com');
        done();
      }, 100);
    });
  });

  describe('Error Handling', () => {
    it('should display error message on booking failure ', (done) => {
      const mockError = { message: 'Booking failed due to server error' };
      mockBookingService.createBooking.and.returnValue(throwError(() => mockError));
      spyOn(window, 'alert');

      fixture.detectChanges();
      component.makepayment();

      setTimeout(() => {
        expect(component.errorMessage).toBe('Booking failed due to server error');
        done();
      }, 100);
    });

    it('should show fallback error message if no error message provided', (done) => {
      const mockError = {};
      mockBookingService.createBooking.and.returnValue(throwError(() => mockError));
      spyOn(window, 'alert');

      fixture.detectChanges();
      component.makepayment();

      setTimeout(() => {
        expect(component.errorMessage).toBe('Failed to create booking. Please try again.');
        done();
      }, 100);
    });

    it('should reset isSubmitting flag on error', (done) => {
      component.isSubmitting = true;
      const mockError = { message: 'Booking failed' };
      mockBookingService.createBooking.and.returnValue(throwError(() => mockError));
      spyOn(window, 'alert');

      fixture.detectChanges();
      component.makepayment();

      setTimeout(() => {
        expect(component.isSubmitting).toBe(false);
        done();
      }, 100);
    });

    it('should reset isSubmitting flag on success', (done) => {
      component.isSubmitting = true;
      const mockResponse = { id: 'BOOKING001', bookingReference: 'TB20240615001' };
      mockBookingService.createBooking.and.returnValue(of(mockResponse));
      spyOn(window, 'alert');

      fixture.detectChanges();
      component.makepayment();

      setTimeout(() => {
        expect(component.isSubmitting).toBe(false);
        done();
      }, 100);
    });
  });

  describe('Authentication Check', () => {
    it('should redirect to home if user is not authenticated', () => {
      mockAuthService.currentUser = null;
      // Don't call fixture.detectChanges() to avoid template rendering errors
      component.ngOnInit();
      component.makepayment();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should allow booking if user is authenticated', () => {
      mockAuthService.currentUser = { _id: 'USER001', name: 'Test User' };
      mockBookingService.createBooking.and.returnValue(of({ id: 'BOOKING001' }));
      fixture.detectChanges();
      component.makepayment();

      expect(mockBookingService.createBooking).toHaveBeenCalled();
    });
  });

  describe('Cash on Trip Display ', () => {
    it('should display cash on trip message with correct fare amount', () => {
      fixture.detectChanges();
      component.passfare = 1500;
      component.selectedPaymentMethod = 'cash_on_trip';
      fixture.detectChanges();

      const message = fixture.nativeElement.querySelector('.cash-on-trip-message-text');
      expect(message?.textContent).toContain('₹1500');
      expect(message?.textContent).toContain('Pay the driver');
    });

    it('should display payment method indicator on fare breakdown for cash on trip', () => {
      fixture.detectChanges();
      component.selectedPaymentMethod = 'cash_on_trip';
      fixture.detectChanges();

      const indicator = fixture.nativeElement.querySelector('.payment-method-indicator');
      expect(indicator).toBeTruthy();
      expect(indicator?.textContent).toContain('Cash on Trip');
    });

    it('should not display payment method indicator for online payment', () => {
      fixture.detectChanges();
      component.selectedPaymentMethod = 'online';
      fixture.detectChanges();

      const indicator = fixture.nativeElement.querySelector('.payment-method-indicator');
      expect(indicator).toBeFalsy();
    });
  });

  describe('Receipt Modal Functionality', () => {
    it('should show receipt modal when showReceipt is true', () => {
      component.showReceipt = true;
      component.receiptData = {
        bookingReference: 'TB123456',
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        fare: 1500
      };
      fixture.detectChanges();

      const modal = fixture.nativeElement.querySelector('.receipt-modal-overlay');
      expect(modal).toBeTruthy();
    });

    it('should hide receipt modal when showReceipt is false', () => {
      component.showReceipt = false;
      fixture.detectChanges();

      const modal = fixture.nativeElement.querySelector('.receipt-modal-overlay');
      expect(modal).toBeFalsy();
    });

    it('should close receipt modal and navigate to profile', () => {
      component.showReceipt = true;
      component.closeReceipt();

      expect(component.showReceipt).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile']);
    });

    it('should generate receipt HTML with booking details', () => {
      component.receiptData = {
        bookingReference: 'TB123456',
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        fare: 1500,
        seats: [1, 2, 3],
        passengers: [{ name: 'John Doe', age: 30, gender: 'M' }],
        routeDetails: {
          departureLocation: { name: 'Mumbai' },
          arrivalLocation: { name: 'Goa' },
          duration: '10 hours'
        },
        selectedDate: '2026-10-10',
        departureTime: '18:45',
        arrivalTime: '04:45',
        totalDistance: 590,
        paymentMethod: 'Cash on Trip',
        busId: {
          operatorName: 'Royal Travels',
          busType: 'AC',
          registrationNumber: 'MH01AB1234',
          amenities: ['Air Conditioning', 'Water Bottle']
        },
        createdAt: new Date().toISOString()
      };

      const html = (component as any).generateReceiptHTML();

      expect(html).toContain('TB123456');
      expect(html).toContain('Test User');
      expect(html).toContain('test@example.com');
      expect(html).toContain('₹1500');
      expect(html).toContain('Mumbai');
      expect(html).toContain('Goa');
    });
  });

  describe('Integration: Complete Booking Flow', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should maintain fare consistency from payment page to receipt', (done) => {
      const testFare = 2500;
      component.passfare = testFare;

      const mockBookingResponse = {
        booking: {
          _id: 'BOOKING001',
          bookingReference: 'TB20240615001',
          status: 'confirmed',
          customerId: 'USER001',
          busId: 'BUS001',
          fare: testFare, // Backend should persist the same fare
          seats: [1, 2, 3],
          paymentMethod: 'cash_on_trip',
          passengers: [{ name: 'John Doe', age: 30, gender: 'M' }],
          createdAt: new Date().toISOString()
        }
      };

      mockBookingService.createBooking.and.returnValue(of(mockBookingResponse));

      component.selectedPaymentMethod = 'cash_on_trip';
      component.makepayment();

      setTimeout(() => {
        // Verify that the receipt data contains the same fare
        expect(component.receiptData.fare).toBe(testFare);
        expect(component.showReceipt).toBe(true);
        done();
      }, 100);
    });

    it('should persist arrival time across booking workflow', (done) => {
      const testArrivalTime = 4;
      component.busarrivaltime = testArrivalTime;

      const mockBookingResponse = {
        booking: {
          _id: 'BOOKING001',
          bookingReference: 'TB20240615001',
          status: 'confirmed',
          busId: 'BUS001',
          arrivalTime: '04:45', // Arrival time as string from backend
          seats: [1],
          passengers: [{ name: 'Jane Doe', age: 25, gender: 'F' }],
          createdAt: new Date().toISOString()
        }
      };

      mockBookingService.createBooking.and.returnValue(of(mockBookingResponse));

      component.makepayment();

      setTimeout(() => {
        // Verify arrival time is preserved in receipt
        expect(component.receiptData.arrivalTime).toBe('04:45');
        done();
      }, 100);
    });

    it('should handle multiple seats and calculate total fare correctly', (done) => {
      const baseFarePerSeat = 500;
      const numberOfSeats = 3;
      const expectedTotal = baseFarePerSeat * numberOfSeats; // 1500

      component.passseatarray = [1, 2, 3];
      component.passfare = expectedTotal;

      const mockBookingResponse = {
        booking: {
          _id: 'BOOKING001',
          bookingReference: 'TB20240615001',
          fare: expectedTotal,
          seats: component.passseatarray,
          passengers: [
            { name: 'Passenger 1', age: 30, gender: 'M' },
            { name: 'Passenger 2', age: 25, gender: 'F' },
            { name: 'Passenger 3', age: 35, gender: 'M' }
          ],
          createdAt: new Date().toISOString()
        }
      };

      mockBookingService.createBooking.and.returnValue(of(mockBookingResponse));

      component.makepayment();

      setTimeout(() => {
        expect(component.receiptData.fare).toBe(expectedTotal);
        expect(component.receiptData.seats.length).toBe(3);
        expect(component.receiptData.passengers.length).toBe(3);
        done();
      }, 100);
    });

    it('should verify seat availability by checking booking response', (done) => {
      // Simulate selected seats
      component.passseatarray = [5, 6, 7];

      const mockBookingResponse = {
        booking: {
          _id: 'BOOKING001',
          bookingReference: 'TB20240615001',
          seats: [5, 6, 7], // Backend should confirm these exact seats
          status: 'confirmed',
          createdAt: new Date().toISOString()
        }
      };

      mockBookingService.createBooking.and.returnValue(of(mockBookingResponse));

      component.makepayment();

      setTimeout(() => {
        // Verify that the same seats are confirmed in booking
        expect(component.receiptData.seats).toEqual([5, 6, 7]);
        done();
      }, 100);
    });

    it('should display "Trip booked successfully" message for cash on trip', (done) => {
      component.selectedPaymentMethod = 'cash_on_trip';

      const mockBookingResponse = {
        booking: {
          _id: 'BOOKING001',
          bookingReference: 'TB20240615001',
          status: 'confirmed',
          paymentMethod: 'cash_on_trip',
          fare: 1500,
          createdAt: new Date().toISOString()
        }
      };

      mockBookingService.createBooking.and.returnValue(of(mockBookingResponse));

      component.makepayment();

      setTimeout(() => {
        expect(component.showReceipt).toBe(true);
        const receiptHTML = component.receiptHTML;
        expect(receiptHTML).toContain('Trip booked successfully');
        done();
      }, 100);
    });

    it('should include all required fields in MongoDB booking record', (done) => {
      const bookingPayload = {
        busId: 'BUS001',
        routeId: 'ROUTE001',
        seats: [1, 2],
        fare: 1200,
        paymentMethod: 'online',
        departureDate: '2024-10-15',
        passengers: [{ name: 'John', age: 30, gender: 'M' }],
        phoneNumber: '1234567890',
        departureDetails: {
          city: 'Mumbai',
          location: 'Central Station',
          date: '2024-10-15',
          time: 18
        },
        arrivalDetails: {
          city: 'Goa',
          location: 'Panjim Bus Stand',
          date: '2024-10-15',
          time: 4
        },
        duration: '10 hours'
      };

      const mockBookingResponse = {
        booking: {
          _id: 'BOOKING001',
          bookingReference: 'TB20240615001',
          customerId: 'USER001',
          busId: bookingPayload.busId,
          routeId: bookingPayload.routeId,
          seats: bookingPayload.seats,
          fare: bookingPayload.fare,
          paymentMethod: bookingPayload.paymentMethod,
          departureDetails: bookingPayload.departureDetails,
          arrivalDetails: bookingPayload.arrivalDetails,
          passengers: bookingPayload.passengers,
          status: 'confirmed',
          createdAt: new Date().toISOString()
        }
      };

      mockBookingService.createBooking.and.returnValue(of(mockBookingResponse));

      component.busid = bookingPayload.busId;
      component.routeId = bookingPayload.routeId;
      component.passseatarray = bookingPayload.seats;
      component.passfare = bookingPayload.fare;
      component.phonenumber = bookingPayload.phoneNumber;
      component.selecteddate = bookingPayload.departureDate;
      component.passengerdetails = bookingPayload.passengers;
      component.busdepauturetime = bookingPayload.departureDetails.time;
      component.busarrivaltime = bookingPayload.arrivalDetails.time;

      component.makepayment();

      setTimeout(() => {
        const callArgs = mockBookingService.createBooking.calls.mostRecent().args[0];
        
        // Verify all required fields are passed to backend
        expect(callArgs.busId).toBe(bookingPayload.busId);
        expect(callArgs.routeId).toBe(bookingPayload.routeId);
        expect(callArgs.seats).toEqual(bookingPayload.seats);
        expect(callArgs.fare).toBe(bookingPayload.fare);
        expect(callArgs.paymentMethod).toBe(bookingPayload.paymentMethod);
        expect(callArgs.departureDetails).toEqual(bookingPayload.departureDetails);
        expect(callArgs.arrivalDetails).toEqual(bookingPayload.arrivalDetails);
        expect(callArgs.duration).toBe(bookingPayload.duration);
        
        // Verify backend persisted all fields
        expect(component.receiptData.busId).toBe(bookingPayload.busId);
        expect(component.receiptData.routeId).toBe(bookingPayload.routeId);
        expect(component.receiptData.seats).toEqual(bookingPayload.seats);
        expect(component.receiptData.fare).toBe(bookingPayload.fare);
        
        done();
      }, 100);
    });

    it('should handle booking creation error and display error message', (done) => {
      const errorMessage = 'Bus not available for selected date';
      mockBookingService.createBooking.and.returnValue(
        throwError(() => new Error(errorMessage))
      );

      component.makepayment();

      setTimeout(() => {
        expect(component.isSubmitting).toBe(false);
        expect(component.errorMessage).toBe(errorMessage);
        expect(component.showReceipt).toBe(false);
        done();
      }, 100);
    });
  });
});