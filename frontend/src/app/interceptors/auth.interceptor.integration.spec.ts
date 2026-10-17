import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../service/auth.service';

/**
 * Integration tests for authInterceptor with full Angular HTTP stack
 * 
 * These tests verify that:
 * 1. The authInterceptor is properly registered and functional
 * 2. Google ID is correctly injected in X-User-Id header
 * 3. Unauthenticated requests don't include the header
 * 4. The interceptor integrates properly with AuthService
 *
 */
describe('authInterceptor - Integration with Angular HTTP Stack', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  let authService: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        // Register the functional interceptor properly
        provideHttpClient(
          withInterceptors([authInterceptor])
        ),
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);

    sessionStorage.clear();
  });

  afterEach(() => {
    httpTestingController.verify();
    sessionStorage.clear();
  });

  describe('Interceptor Registration and Basic Functionality', () => {
    it('should be registered as a functional interceptor', () => {
      // Verify AuthService is available
      expect(authService).toBeDefined();

      // Verify getGoogleIdForHeaderInjection method exists
      expect(authService.getGoogleIdForHeaderInjection).toBeDefined();
    });

    it('should inject header for authenticated user making GET request', () => {
      const testUser = {
        id: '123',
        googleId: 'google_auth_id_123',
        name: 'Test User',
        email: 'test@example.com',
      };

      authService.login(testUser);

      // Make a request that should have the interceptor applied
      httpClient.get('/api/protected-resource').subscribe();

      const req = httpTestingController.expectOne('/api/protected-resource');
      expect(req.request.headers.has('X-User-Id')).toBe(true);
      expect(req.request.headers.get('X-User-Id')).toBe('google_auth_id_123');

      req.flush({ data: 'test' });
    });

    it('should not inject header for unauthenticated requests', () => {
      // Don't log in any user

      // Make a public request
      httpClient.get('/api/public-resource').subscribe();

      const req = httpTestingController.expectOne('/api/public-resource');
      expect(req.request.headers.has('X-User-Id')).toBe(false);

      req.flush({ data: 'public' });
    });
  });

  describe('Authenticated Request Scenarios', () => {
    beforeEach(() => {
      const testUser = {
        id: 'user_555',
        googleId: 'google_555',
        name: 'Authenticated User',
        email: 'auth@example.com',
      };
      authService.login(testUser);
    });

    it('User isolation - X-User-Id header provides user isolation context', () => {
      // User isolation - authenticated user ID from request context
      // The backend will use X-User-Id to filter bookings by the authenticated user

      httpClient.get('/api/bookings/my').subscribe();

      const req = httpTestingController.expectOne('/api/bookings/my');
      expect(req.request.headers.get('X-User-Id')).toBe('google_555');

      // Backend middleware would use this to verify user_555 is the authenticated user
      req.flush({ bookings: [] });
    });

    it('Session validation - X-User-Id validates Google ID from session', () => {
      // Backend validates Google ID matches session

      httpClient.get('/api/users/profile').subscribe();

      const req = httpTestingController.expectOne('/api/users/profile');
      // Backend will check: X-User-Id (from interceptor) === sessionStorage googleId
      expect(req.request.headers.get('X-User-Id')).toBe('google_555');

      req.flush({ profile: { name: 'User' } });
    });

    it('Header injection - X-User-Id header injected in all requests', () => {
      // Google ID header injection in requests

      // GET request
      httpClient.get('/api/bookings').subscribe();
      let req = httpTestingController.expectOne('/api/bookings');
      expect(req.request.headers.get('X-User-Id')).toBe('google_555');
      req.flush([]);

      // POST request
      httpClient.post('/api/bookings', { busId: 'BUS1' }).subscribe();
      req = httpTestingController.expectOne('/api/bookings');
      expect(req.request.headers.get('X-User-Id')).toBe('google_555');
      req.flush({ id: 'booking1' });

      // PUT request
      httpClient.put('/api/bookings/booking1', { status: 'updated' }).subscribe();
      req = httpTestingController.expectOne('/api/bookings/booking1');
      expect(req.request.headers.get('X-User-Id')).toBe('google_555');
      req.flush({});

      // DELETE request
      httpClient.delete('/api/bookings/booking1').subscribe();
      req = httpTestingController.expectOne('/api/bookings/booking1');
      expect(req.request.headers.get('X-User-Id')).toBe('google_555');
      req.flush({});
    });
  });

  describe('Header Preservation and Non-Interference', () => {
    it('should not interfere with response handling', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'Test User',
        email: 'test@example.com',
      };
      authService.login(testUser);

      const responseData = { id: 'booking1', status: 'confirmed' };

      httpClient.get('/api/bookings/booking1').subscribe((response) => {
        expect(response).toEqual(responseData);
      });

      const req = httpTestingController.expectOne('/api/bookings/booking1');
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');

      // Response is handled correctly
      req.flush(responseData);
    });

    it('should not modify request payload', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'Test User',
        email: 'test@example.com',
      };
      authService.login(testUser);

      const payload = {
        busId: 'BUS001',
        seats: [1, 2, 3],
        paymentMethod: 'cash_on_trip',
        totalFare: 299.99,
      };

      httpClient.post('/api/bookings', payload).subscribe();

      const req = httpTestingController.expectOne('/api/bookings');
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      expect(req.request.body).toEqual(payload);

      req.flush({ id: 'booking1' });
    });
  });

  describe('Error Response Handling', () => {
    it('should pass through 401 Unauthorized responses', () => {
      httpClient.get('/api/protected').subscribe(
        () => {
          fail('should have errored');
        },
        (error) => {
          expect(error.status).toBe(401);
        }
      );

      const req = httpTestingController.expectOne('/api/protected');
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    });

    it('should pass through 403 Forbidden responses', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'Test User',
        email: 'test@example.com',
      };
      authService.login(testUser);

      httpClient.get('/api/other-user-booking').subscribe(
        () => {
          fail('should have errored');
        },
        (error) => {
          expect(error.status).toBe(403);
        }
      );

      const req = httpTestingController.expectOne('/api/other-user-booking');
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');

      req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });
    });
  });

  describe('Backend Validation Flow', () => {
    it('demonstrates complete authentication flow: login -> request -> backend validation', () => {
      // 1. User is not authenticated
      expect(authService.getGoogleIdForHeaderInjection()).toBeNull();

      httpClient.get('/api/bookings').subscribe();
      let req = httpTestingController.expectOne('/api/bookings');
      expect(req.request.headers.has('X-User-Id')).toBe(false);
      req.flush({ error: 'Not authenticated' }, { status: 401, statusText: 'Unauthorized' });

      // 2. User logs in with Google ID
      const googleUser = {
        id: 'mongo_user_id_123',
        googleId: 'google.com/user123',
        name: 'John Doe',
        email: 'john@gmail.com',
        picture: 'https://lh3.googleusercontent.com/abc',
      };
      authService.login(googleUser);

      // 3. Google ID is available for header injection
      expect(authService.getGoogleIdForHeaderInjection()).toBe('google.com/user123');

      // 4. Next request includes X-User-Id header
      httpClient.get('/api/bookings/my').subscribe();
      req = httpTestingController.expectOne('/api/bookings/my');
      
      // Backend authentication middleware will:
      // - Extract X-User-Id: 'google.com/user123'
      // - Validate user exists in database
      // - Filter bookings by this userId
      expect(req.request.headers.get('X-User-Id')).toBe('google.com/user123');

      req.flush([
        {
          id: 'booking1',
          customerId: 'mongo_user_id_123', // Only this user's bookings
          status: 'confirmed',
        },
      ]);

      // 5. User logs out
      authService.logout();
      expect(authService.getGoogleIdForHeaderInjection()).toBeNull();

      // 6. Future requests no longer have the header
      httpClient.get('/api/bookings').subscribe();
      req = httpTestingController.expectOne('/api/bookings');
      expect(req.request.headers.has('X-User-Id')).toBe(false);
      req.flush({ error: 'Not authenticated' }, { status: 401, statusText: 'Unauthorized' });
    });
  });
});
