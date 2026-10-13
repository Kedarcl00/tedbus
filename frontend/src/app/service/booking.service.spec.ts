import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BookingService, SearchFilters, Bus, CreateBookingDTO, BookingResponse, CancellationResult } from './booking.service';

describe('BookingService', () => {
  let service: BookingService;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:3001';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BookingService]
    });

    service = TestBed.inject(BookingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('searchBuses()', () => {
    it('should search buses with valid filters and return array', () => {
      const filters: SearchFilters = {
        source: 'NYC',
        destination: 'Boston',
        date: '2024-06-15',
        passengers: 2
      };

      const mockBuses: Bus[] = [
        {
          busId: 'BUS001',
          operatorName: 'Greyhound',
          departureTime: '08:00',
          arrivalTime: '14:30',
          fare: 45.99,
          availableSeats: 8,
          totalSeats: 50,
          busType: 'AC',
          amenities: ['WiFi', 'USB', 'Blanket']
        },
        {
          busId: 'BUS002',
          operatorName: 'MegaBus',
          departureTime: '10:00',
          arrivalTime: '16:00',
          fare: 39.99,
          availableSeats: 12,
          totalSeats: 50,
          busType: 'AC',
          amenities: ['WiFi', 'Charging']
        }
      ];

      service.searchBuses(filters).subscribe(buses => {
        expect(buses).toEqual(mockBuses);
        expect(buses.length).toBe(2);
        expect(buses[0].busId).toBe('BUS001');
      });

      const req = httpMock.expectOne(request => {
        return request.url === `${baseUrl}/api/buses/search` &&
               request.params.get('from') === 'NYC' &&
               request.params.get('to') === 'Boston' &&
               request.params.get('date') === '2024-06-15' &&
               request.params.get('passengers') === '2';
      });

      expect(req.request.method).toBe('GET');
      req.flush(mockBuses);
    });

    it('should handle empty search results', () => {
      const filters: SearchFilters = {
        source: 'SmallTown',
        destination: 'RemoteArea',
        date: '2024-06-15',
        passengers: 1
      };

      service.searchBuses(filters).subscribe(buses => {
        expect(buses).toEqual([]);
      });

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/buses/search`);
      req.flush([]);
    });

    it('should pass query parameters correctly', () => {
      const filters: SearchFilters = {
        source: 'LosAngeles',
        destination: 'SanFrancisco',
        date: '2024-12-25',
        passengers: 5
      };

      service.searchBuses(filters).subscribe();

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/buses/search`);
      expect(req.request.params.get('from')).toBe('LosAngeles');
      expect(req.request.params.get('to')).toBe('SanFrancisco');
      expect(req.request.params.get('date')).toBe('2024-12-25');
      expect(req.request.params.get('passengers')).toBe('5');
      req.flush([]);
    });

    it('should handle search error with meaningful message', () => {
      const filters: SearchFilters = {
        source: 'NYC',
        destination: 'Boston',
        date: '2024-06-15',
        passengers: 2
      };

      service.searchBuses(filters).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.statusCode).toBe(400);
          expect(error.message).toBe('Invalid search parameters');
        }
      );

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/buses/search`);
      req.flush(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid search parameters', statusCode: 400 } },
        { status: 400, statusText: 'Bad Request' }
      );
    });

    it('should handle network error', () => {
      const filters: SearchFilters = {
        source: 'NYC',
        destination: 'Boston',
        date: '2024-06-15',
        passengers: 2
      };

      service.searchBuses(filters).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.message).toBe('Failed to search buses');
        }
      );

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/buses/search`);
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('createBooking()', () => {
    it('should create booking with online payment method', () => {
      const bookingData: CreateBookingDTO = {
        busId: 'BUS001',
        routeId: 'ROUTE_NYC_BOS',
        seats: [12, 13, 14],
        fare: 135.97,
        paymentMethod: 'online',
        phoneNumber: '555-1234',
        departureDetails: { city: 'NYC', location: 'Times Square', time: '08:00' },
        arrivalDetails: { city: 'Boston', location: 'Downtown', time: '14:30' },
        duration: '6h 30m',
        passengers: [
          { name: 'John Doe', gender: 'M', age: 25 },
          { name: 'Jane Doe', gender: 'F', age: 23 }
        ]
      };

      const mockResponse: BookingResponse = {
        id: 'BOOKING_001',
        customerId: 'USER_123',
        busId: 'BUS001',
        routeId: 'ROUTE_NYC_BOS',
        seats: [12, 13, 14],
        fare: 135.97,
        paymentMethod: 'online',
        status: 'pending',
        bookingReference: 'TB20240615001',
        passengers: [
          { name: 'John Doe', gender: 'M', age: 25 },
          { name: 'Jane Doe', gender: 'F', age: 23 }
        ],
        departureDetails: { city: 'NYC', location: 'Times Square', time: '08:00' },
        arrivalDetails: { city: 'Boston', location: 'Downtown', time: '14:30' },
        duration: '6h 30m',
        phoneNumber: '555-1234',
        bookingDate: '2024-06-01'
      };

      service.createBooking(bookingData).subscribe(response => {
        expect(response.id).toBe('BOOKING_001');
        expect(response.paymentMethod).toBe('online');
        expect(response.status).toBe('pending');
        expect(response.bookingReference).toBe('TB20240615001');
      });

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(bookingData);
      req.flush(mockResponse);
    });

    it('should create booking with cash_on_trip payment method', () => {
      const bookingData: CreateBookingDTO = {
        busId: 'BUS001',
        routeId: 'ROUTE_NYC_BOS',
        seats: [12, 13],
        fare: 95.98,
        paymentMethod: 'cash_on_trip',
        phoneNumber: '555-1234',
        departureDetails: { city: 'NYC', location: 'Times Square', time: '08:00' },
        arrivalDetails: { city: 'Boston', location: 'Downtown', time: '14:30' },
        duration: '6h 30m',
        passengers: [
          { name: 'John Doe', gender: 'M', age: 25 }
        ]
      };

      const mockResponse: BookingResponse = {
        id: 'BOOKING_002',
        customerId: 'USER_123',
        busId: 'BUS001',
        routeId: 'ROUTE_NYC_BOS',
        seats: [12, 13],
        fare: 95.98,
        paymentMethod: 'cash_on_trip',
        status: 'confirmed',
        paymentStatus: 'pending',
        bookingReference: 'TB20240615002',
        passengers: [
          { name: 'John Doe', gender: 'M', age: 25 }
        ],
        departureDetails: { city: 'NYC', location: 'Times Square', time: '08:00' },
        arrivalDetails: { city: 'Boston', location: 'Downtown', time: '14:30' },
        duration: '6h 30m',
        phoneNumber: '555-1234',
        bookingDate: '2024-06-01'
      };

      service.createBooking(bookingData).subscribe(response => {
        expect(response.paymentMethod).toBe('cash_on_trip');
        expect(response.status).toBe('confirmed');
        expect(response.paymentStatus).toBe('pending');
      });

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings`);
      expect(req.request.body.paymentMethod).toBe('cash_on_trip');
      req.flush(mockResponse);
    });

    it('should handle validation error on booking creation', () => {
      const bookingData: CreateBookingDTO = {
        busId: 'BUS001',
        routeId: 'ROUTE_NYC_BOS',
        seats: [12, 13],
        fare: 95.98,
        paymentMethod: 'cash_on_trip',
        phoneNumber: '555-1234',
        departureDetails: { city: 'NYC', location: 'Times Square', time: '08:00' },
        arrivalDetails: { city: 'Boston', location: 'Downtown', time: '14:30' },
        duration: '6h 30m',
        passengers: [
          { name: 'John Doe', gender: 'M', age: 25 }
        ]
      };

      service.createBooking(bookingData).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.statusCode).toBe(400);
          expect(error.message.toLowerCase()).toContain('invalid');
        }
      );

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings`);
      req.flush(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid passenger data', statusCode: 400 } },
        { status: 400, statusText: 'Bad Request' }
      );
    });

    it('should handle insufficient seats error', () => {
      const bookingData: CreateBookingDTO = {
        busId: 'BUS001',
        routeId: 'ROUTE_NYC_BOS',
        seats: [1, 2, 3, 4, 5],
        fare: 200,
        paymentMethod: 'online',
        phoneNumber: '555-1234',
        departureDetails: { city: 'NYC', location: 'Times Square', time: '08:00' },
        arrivalDetails: { city: 'Boston', location: 'Downtown', time: '14:30' },
        duration: '6h 30m',
        passengers: [
          { name: 'John Doe', gender: 'M', age: 25 }
        ]
      };

      service.createBooking(bookingData).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.statusCode).toBe(400);
          expect(error.message).toContain('seats');
        }
      );

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings`);
      req.flush(
        { success: false, error: { code: 'BUSINESS_RULE_ERROR', message: 'No seats available', statusCode: 400 } },
        { status: 400, statusText: 'Bad Request' }
      );
    });
  });

  describe('getMyBookings()', () => {
    it('should retrieve user bookings', () => {
      const mockBookings: BookingResponse[] = [
        {
          id: 'BOOKING_001',
          customerId: 'USER_123',
          busId: 'BUS001',
          routeId: 'ROUTE_NYC_BOS',
          seats: [12, 13],
          fare: 95.98,
          paymentMethod: 'cash_on_trip',
          status: 'confirmed',
          bookingReference: 'TB20240615001',
          passengers: [{ name: 'John Doe', gender: 'M', age: 25 }],
          departureDetails: { city: 'NYC', location: 'Times Square', time: '08:00' },
          arrivalDetails: { city: 'Boston', location: 'Downtown', time: '14:30' },
          duration: '6h 30m',
          phoneNumber: '555-1234',
          bookingDate: '2024-06-15'
        },
        {
          id: 'BOOKING_002',
          customerId: 'USER_123',
          busId: 'BUS002',
          routeId: 'ROUTE_BOS_DC',
          seats: [5, 6],
          fare: 75.50,
          paymentMethod: 'online',
          status: 'completed',
          bookingReference: 'TB20240616001',
          passengers: [{ name: 'Jane Doe', gender: 'F', age: 28 }],
          departureDetails: { city: 'Boston', location: 'Downtown', time: '10:00' },
          arrivalDetails: { city: 'Washington DC', location: 'Union Station', time: '16:30' },
          duration: '6h 30m',
          phoneNumber: '555-5678',
          bookingDate: '2024-06-14'
        }
      ];

      service.getMyBookings().subscribe(bookings => {
        expect(bookings).toEqual(mockBookings);
        expect(bookings.length).toBe(2);
        expect(bookings[0].customerId).toBe('USER_123');
      });

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings/my`);
      expect(req.request.method).toBe('GET');
      req.flush(mockBookings);
    });

    it('should return empty array when user has no bookings', () => {
      service.getMyBookings().subscribe(bookings => {
        expect(bookings).toEqual([]);
      });

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings/my`);
      req.flush([]);
    });

    it('should handle unauthorized error (401)', () => {
      service.getMyBookings().subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.statusCode).toBe(401);
        }
      );

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings/my`);
      req.flush(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 } },
        { status: 401, statusText: 'Unauthorized' }
      );
    });
  });

  describe('getBookingDetails()', () => {
    it('should retrieve booking details with valid bookingId', () => {
      const bookingId = 'BOOKING_001';
      const mockBooking: BookingResponse = {
        id: 'BOOKING_001',
        customerId: 'USER_123',
        busId: 'BUS001',
        routeId: 'ROUTE_NYC_BOS',
        seats: [12, 13],
        fare: 95.98,
        paymentMethod: 'cash_on_trip',
        status: 'confirmed',
        bookingReference: 'TB20240615001',
        passengers: [{ name: 'John Doe', gender: 'M', age: 25 }],
        departureDetails: { city: 'NYC', location: 'Times Square', time: '08:00' },
        arrivalDetails: { city: 'Boston', location: 'Downtown', time: '14:30' },
        duration: '6h 30m',
        phoneNumber: '555-1234',
        bookingDate: '2024-06-15'
      };

      service.getBookingDetails(bookingId).subscribe(booking => {
        expect(booking).toEqual(mockBooking);
        expect(booking.id).toBe('BOOKING_001');
      });

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings/${bookingId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockBooking);
    });

    it('should handle 404 error when booking not found', () => {
      const bookingId = 'INVALID_ID';

      service.getBookingDetails(bookingId).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.statusCode).toBe(404);
          expect(error.message).toContain('not found');
        }
      );

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings/${bookingId}`);
      req.flush(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found', statusCode: 404 } },
        { status: 404, statusText: 'Not Found' }
      );
    });

    it('should handle 403 error when user is not booking owner', () => {
      const bookingId = 'BOOKING_OTHER_USER';

      service.getBookingDetails(bookingId).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.statusCode).toBe(403);
        }
      );

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings/${bookingId}`);
      req.flush(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions', statusCode: 403 } },
        { status: 403, statusText: 'Forbidden' }
      );
    });
  });

  describe('cancelBooking()', () => {
    it('should cancel booking and return refund information', () => {
      const bookingId = 'BOOKING_001';
      const mockResult: CancellationResult = {
        bookingId: 'BOOKING_001',
        status: 'cancelled',
        refundAmount: 95.98,
        message: 'Booking cancelled successfully. Refund will be processed within 3-5 business days.'
      };

      service.cancelBooking(bookingId).subscribe(result => {
        expect(result.bookingId).toBe('BOOKING_001');
        expect(result.status).toBe('cancelled');
        expect(result.refundAmount).toBe(95.98);
      });

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings/${bookingId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(mockResult);
    });

    it('should handle 403 error when user is not booking owner', () => {
      const bookingId = 'BOOKING_OTHER_USER';

      service.cancelBooking(bookingId).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.statusCode).toBe(403);
        }
      );

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings/${bookingId}`);
      req.flush(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions', statusCode: 403 } },
        { status: 403, statusText: 'Forbidden' }
      );
    });

    it('should handle 404 error when booking not found', () => {
      const bookingId = 'INVALID_ID';

      service.cancelBooking(bookingId).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.statusCode).toBe(404);
        }
      );

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings/${bookingId}`);
      req.flush(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found', statusCode: 404 } },
        { status: 404, statusText: 'Not Found' }
      );
    });

    it('should handle error when booking cannot be cancelled', () => {
      const bookingId = 'BOOKING_COMPLETED';

      service.cancelBooking(bookingId).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.statusCode).toBe(400);
          expect(error.message.toLowerCase()).toContain('cannot');
        }
      );

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings/${bookingId}`);
      req.flush(
        { success: false, error: { code: 'BUSINESS_RULE_ERROR', message: 'Cannot cancel completed booking', statusCode: 400 } },
        { status: 400, statusText: 'Bad Request' }
      );
    });
  });

  describe('Error Handling', () => {
    it('should extract backend error message from API response', () => {
      const filters: SearchFilters = {
        source: 'NYC',
        destination: 'Boston',
        date: '2024-06-15',
        passengers: 2
      };

      service.searchBuses(filters).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.message).toBe('Custom backend error message');
        }
      );

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/buses/search`);
      req.flush(
        { success: false, error: { code: 'CUSTOM_ERROR', message: 'Custom backend error message', statusCode: 400 } },
        { status: 400, statusText: 'Bad Request' }
      );
    });

    it('should use HTTP status text as fallback error message', () => {
      const filters: SearchFilters = {
        source: 'NYC',
        destination: 'Boston',
        date: '2024-06-15',
        passengers: 2
      };

      service.searchBuses(filters).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.statusCode).toBe(500);
        }
      );

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/buses/search`);
      req.flush(null, { status: 500, statusText: 'Internal Server Error' });
    });

    it('should use default message when no backend error info available', () => {
      const filters: SearchFilters = {
        source: 'NYC',
        destination: 'Boston',
        date: '2024-06-15',
        passengers: 2
      };

      service.searchBuses(filters).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.message).toBe('Failed to search buses');
        }
      );

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/buses/search`);
      req.flush(null, { status: 500, statusText: 'Unknown Error' });
    });

    it('should include error details when available', () => {
      const bookingData: CreateBookingDTO = {
        busId: 'BUS001',
        routeId: 'ROUTE_NYC_BOS',
        seats: [12, 13],
        fare: 95.98,
        paymentMethod: 'cash_on_trip',
        phoneNumber: '555-1234',
        departureDetails: { city: 'NYC', location: 'Times Square', time: '08:00' },
        arrivalDetails: { city: 'Boston', location: 'Downtown', time: '14:30' },
        duration: '6h 30m',
        passengers: [
          { name: 'John Doe', gender: 'M', age: 25 }
        ]
      };

      service.createBooking(bookingData).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.details).toEqual({ field: 'age', issue: 'too young' });
        }
      );

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings`);
      req.flush(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            statusCode: 400,
            details: { field: 'age', issue: 'too young' }
          }
        },
        { status: 400, statusText: 'Bad Request' }
      );
    });
  });

  describe('User Isolation', () => {
    it('should call getMyBookings without explicit user parameter (auth handled by interceptor)', () => {
      service.getMyBookings().subscribe();

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/bookings/my`);
      // Verify no userId query parameter is sent (enforced server-side by interceptor)
      expect(req.request.params.get('userId')).toBeNull();
      req.flush([]);
    });

    it('should not include user ID in search request', () => {
      const filters: SearchFilters = {
        source: 'NYC',
        destination: 'Boston',
        date: '2024-06-15',
        passengers: 2
      };

      service.searchBuses(filters).subscribe();

      const req = httpMock.expectOne(request => request.url === `${baseUrl}/api/buses/search`);
      // Verify no userId parameter
      expect(req.request.params.get('userId')).toBeNull();
      req.flush([]);
    });
  });
});
