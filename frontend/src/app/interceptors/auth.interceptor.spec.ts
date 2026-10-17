import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { HttpClient, HttpRequest } from '@angular/common/http';
import { AuthService } from '../service/auth.service';

/**
 * Test suite for authInterceptor
 *
 * Validates that the HTTP interceptor correctly injects Google ID in request headers
 * for authenticated requests and handles unauthenticated requests gracefully.
 *
 *
 * Note: These tests verify the core logic that the authInterceptor implements:
 * 1. Get Google ID from AuthService when user is authenticated
 * 2. Inject X-User-Id header in requests if user is authenticated
 * 3. Don't inject header if user is not authenticated
 * 4. Don't override existing X-User-Id header
 * 
 * The interceptor is registered in app.config.ts with withInterceptors([authInterceptor])
 */
describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  let authService: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);

    // Clear sessionStorage before each test
    sessionStorage.clear();
  });

  afterEach(() => {
    // Verify that all HTTP requests have been handled
    httpTestingController.verify();
    sessionStorage.clear();
  });

  describe('AuthService header injection support', () => {
    it('should retrieve Google ID from AuthService when user is logged in', () => {
      // Google ID from session for header injection
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      authService.login(testUser);

      const googleId = authService.getGoogleIdForHeaderInjection();
      expect(googleId).toBe('google_123');
    });

    it('should return null when user is not authenticated', () => {
      const googleId = authService.getGoogleIdForHeaderInjection();
      expect(googleId).toBeNull();
    });

    it('should return null after logout', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      authService.login(testUser);
      expect(authService.getGoogleIdForHeaderInjection()).toBe('google_123');

      authService.logout();
      expect(authService.getGoogleIdForHeaderInjection()).toBeNull();
    });

    it('should handle user login/logout/relogin cycles', () => {
      // User 1 logs in
      const user1 = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(user1);
      expect(authService.getGoogleIdForHeaderInjection()).toBe('google_123');

      // User 1 logs out
      authService.logout();
      expect(authService.getGoogleIdForHeaderInjection()).toBeNull();

      // User 2 logs in
      const user2 = {
        id: '456',
        googleId: 'google_456',
        name: 'Jane Smith',
        email: 'jane@example.com',
      };
      authService.login(user2);
      expect(authService.getGoogleIdForHeaderInjection()).toBe('google_456');
    });
  });

  describe('HTTP interceptor integration - GET requests', () => {
    it('should include X-User-Id header in GET request when authenticated', () => {
      // Google ID header injection in requests
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(testUser);

      httpClient.get('/api/bookings').subscribe();

      const req = httpTestingController.expectOne('/api/bookings');
      // The interceptor should have injected this header
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      req.flush([]);
    });

    it('should NOT include X-User-Id header in GET request when not authenticated', () => {
      // No injection for unauthenticated requests
      httpClient.get('/api/buses').subscribe();

      const req = httpTestingController.expectOne('/api/buses');
      expect(req.request.headers.has('X-User-Id')).toBe(false);
      req.flush([]);
    });
  });

  describe('HTTP interceptor integration - POST requests', () => {
    it('should include X-User-Id header in POST request when authenticated', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(testUser);

      const payload = { busId: 'BUS001', seats: [1, 2] };
      httpClient.post('/api/bookings', payload).subscribe();

      const req = httpTestingController.expectOne('/api/bookings');
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      expect(req.request.body).toEqual(payload);
      req.flush({});
    });

    it('should preserve request body while injecting header', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(testUser);

      const payload = {
        busId: 'BUS001',
        seats: [12, 13, 14],
        passengers: [{ name: 'John', age: 30 }],
        paymentMethod: 'cash_on_trip',
      };

      httpClient.post('/api/bookings', payload).subscribe();

      const req = httpTestingController.expectOne('/api/bookings');
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      expect(req.request.body).toEqual(payload);
      req.flush({});
    });
  });

  describe('HTTP interceptor integration - PUT/DELETE requests', () => {
    beforeEach(() => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(testUser);
    });

    it('should include X-User-Id header in PUT request', () => {
      const payload = { status: 'confirmed' };
      httpClient.put('/api/bookings/123', payload).subscribe();

      const req = httpTestingController.expectOne('/api/bookings/123');
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      expect(req.request.method).toBe('PUT');
      req.flush({});
    });

    it('should include X-User-Id header in DELETE request', () => {
      httpClient.delete('/api/bookings/123').subscribe();

      const req = httpTestingController.expectOne('/api/bookings/123');
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });

    it('should include X-User-Id header in PATCH request', () => {
      const payload = { fare: 99.99 };
      httpClient.patch('/api/bookings/123', payload).subscribe();

      const req = httpTestingController.expectOne('/api/bookings/123');
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      expect(req.request.method).toBe('PATCH');
      req.flush({});
    });
  });

  describe('Header handling - preservation and no duplication', () => {
    it('should not override existing X-User-Id header', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(testUser);

      // Interceptor should check if header already exists
      httpClient
        .get('/api/bookings', {
          headers: { 'X-User-Id': 'custom_value' },
        })
        .subscribe();

      const req = httpTestingController.expectOne('/api/bookings');
      // Custom header should be preserved
      expect(req.request.headers.get('X-User-Id')).toBe('custom_value');
      req.flush({});
    });

    it('should preserve other headers while injecting X-User-Id', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(testUser);

      httpClient
        .get('/api/bookings', {
          headers: {
            'Accept': 'application/json',
            'Custom-Header': 'custom-value',
          },
        })
        .subscribe();

      const req = httpTestingController.expectOne('/api/bookings');
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      expect(req.request.headers.get('Accept')).toBe('application/json');
      expect(req.request.headers.get('Custom-Header')).toBe('custom-value');
      req.flush({});
    });
  });

  describe('Authentication state transitions with HTTP requests', () => {
    it('should inject header after login', () => {
      // Initially no header (no auth)
      httpClient.get('/api/bookings').subscribe();
      let req = httpTestingController.expectOne('/api/bookings');
      expect(req.request.headers.has('X-User-Id')).toBe(false);
      req.flush([]);

      // After login, header should be injected
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(testUser);

      httpClient.get('/api/bookings').subscribe();
      req = httpTestingController.expectOne('/api/bookings');
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      req.flush([]);
    });

    it('should stop injecting header after logout', () => {
      // User is logged in
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(testUser);

      // Verify header is injected
      httpClient.get('/api/bookings').subscribe();
      let req = httpTestingController.expectOne('/api/bookings');
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      req.flush([]);

      // User logs out
      authService.logout();

      // Header should not be injected
      httpClient.get('/api/bookings').subscribe();
      req = httpTestingController.expectOne('/api/bookings');
      expect(req.request.headers.has('X-User-Id')).toBe(false);
      req.flush([]);
    });

    it('should update header when different user logs in', () => {
      // User 1 logs in
      const user1 = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(user1);

      httpClient.get('/api/bookings').subscribe();
      let req = httpTestingController.expectOne('/api/bookings');
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      req.flush([]);

      // User 2 logs in
      authService.logout();
      const user2 = {
        id: '456',
        googleId: 'google_456',
        name: 'Jane Smith',
        email: 'jane@example.com',
      };
      authService.login(user2);

      httpClient.get('/api/bookings').subscribe();
      req = httpTestingController.expectOne('/api/bookings');
      expect(req.request.headers.get('X-User-Id')).toBe('google_456');
      req.flush([]);
    });
  });

  describe('URL and query parameter handling', () => {
    it('should handle requests with query parameters', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(testUser);

      httpClient.get('/api/bookings', { params: { page: '1', limit: '10' } })
        .subscribe();

      const req = httpTestingController.expectOne(
        '/api/bookings?page=1&limit=10'
      );
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      req.flush([]);
    });

    it('should handle special characters in URL', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(testUser);

      const bookingId = 'booking-with-special-chars_123';
      httpClient.get(`/api/bookings/${bookingId}`).subscribe();

      const req = httpTestingController.expectOne(
        `/api/bookings/${bookingId}`
      );
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      req.flush({});
    });

    it('should preserve URL and method with injected header', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(testUser);

      httpClient.post('/api/bookings/confirm', {}).subscribe();

      const req = httpTestingController.expectOne('/api/bookings/confirm');
      expect(req.request.url).toBe('/api/bookings/confirm');
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      req.flush({});
    });
  });

  describe('Auth header compliance validation', () => {
    it('validates authenticated user ID from request context', () => {
      // User isolation - authenticated user ID from request context
      const testUser = {
        id: 'user_123',
        googleId: 'google_id_123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      authService.login(testUser);

      // Verify Google ID is available and correctly injected
      expect(authService.getGoogleIdForHeaderInjection()).toBe('google_id_123');

      httpClient.get('/api/bookings/my').subscribe();
      const req = httpTestingController.expectOne('/api/bookings/my');
      expect(req.request.headers.get('X-User-Id')).toBe('google_id_123');
      req.flush([]);
    });

    it('validates Google ID validation from session', () => {
      // Authentication middleware - Google user ID validation from session
      const testUser = {
        id: 'user_456',
        googleId: 'google_id_456',
        name: 'Jane Smith',
        email: 'jane@example.com',
      };

      authService.login(testUser);

      // Google ID should be available in session
      expect(authService.getGoogleIdForHeaderInjection()).toBe('google_id_456');

      // Backend middleware will validate this header
      httpClient.get('/api/users/profile').subscribe();
      const req = httpTestingController.expectOne('/api/users/profile');
      expect(req.request.headers.get('X-User-Id')).toBe('google_id_456');
      req.flush({});
    });

    it('validates Google ID header injection in requests', () => {
      // User isolation - Google ID header injection in requests
      const testUser = {
        id: 'user_789',
        googleId: 'google_id_789',
        name: 'Bob Johnson',
        email: 'bob@example.com',
      };

      authService.login(testUser);

      // Test various protected endpoints
      const endpoints = [
        '/api/bookings',
        '/api/users/profile',
        '/api/bookings/123',
      ];

      endpoints.forEach((endpoint) => {
        httpClient.get(endpoint).subscribe();
        const req = httpTestingController.expectOne(endpoint);
        expect(req.request.headers.get('X-User-Id')).toBe('google_id_789');
        req.flush({});
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple sequential requests with same user', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(testUser);

      // Multiple requests in sequence
      for (let i = 0; i < 3; i++) {
        httpClient.get(`/api/bookings/${i}`).subscribe();
        const req = httpTestingController.expectOne(`/api/bookings/${i}`);
        expect(req.request.headers.get('X-User-Id')).toBe('google_123');
        req.flush({});
      }
    });

    it('should handle large payloads with header injection', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      authService.login(testUser);

      const largePayload = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          data: 'x'.repeat(100),
        })),
      };

      httpClient.post('/api/bulk-operation', largePayload).subscribe();

      const req = httpTestingController.expectOne('/api/bulk-operation');
      expect(req.request.headers.get('X-User-Id')).toBe('google_123');
      expect(req.request.body.items.length).toBe(1000);
      req.flush({});
    });

    it('should handle public endpoints without authentication', () => {
      // Public endpoints should not have X-User-Id header
      httpClient.get('/api/buses').subscribe();
      const req = httpTestingController.expectOne('/api/buses');
      expect(req.request.headers.has('X-User-Id')).toBe(false);
      req.flush([]);
    });
  });
});
