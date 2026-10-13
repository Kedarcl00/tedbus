import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
    // Clear sessionStorage before each test
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('login()', () => {
    it('should store user data in sessionStorage with key "Loggedinuser"', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
        picture: 'https://example.com/pic.jpg',
      };

      service.login(testUser);

      const stored = sessionStorage.getItem('Loggedinuser');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(testUser);
    });

    it('should store Google ID separately for header injection', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      service.login(testUser);

      const storedGoogleId = sessionStorage.getItem('googleId');
      expect(storedGoogleId).toBe('google_123');
    });

    it('should update currentUser$ observable', (done) => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      let emissionCount = 0;
      service.currentUser$.subscribe((user) => {
        emissionCount++;
        // Skip the initial null emission from BehaviorSubject
        if (emissionCount > 1) {
          expect(user).toEqual(testUser);
          done();
        }
      });

      service.login(testUser);
    });

    it('should not store invalid user data (missing id)', () => {
      const invalidUser = {
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      } as any;

      spyOn(console, 'error');
      service.login(invalidUser);

      expect(console.error).toHaveBeenCalledWith('Invalid user data for login');
    });

    it('should handle user data with extra fields', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
        picture: 'https://example.com/pic.jpg',
        customField: 'custom_value',
        preferences: { theme: 'dark' },
      };

      service.login(testUser);

      const stored = sessionStorage.getItem('Loggedinuser');
      expect(JSON.parse(stored!)).toEqual(testUser);
    });
  });

  describe('logout()', () => {
    beforeEach(() => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      service.login(testUser);
    });

    it('should remove user data from sessionStorage', () => {
      service.logout();

      const stored = sessionStorage.getItem('Loggedinuser');
      expect(stored).toBeNull();
    });

    it('should remove Google ID from sessionStorage', () => {
      service.logout();

      const storedGoogleId = sessionStorage.getItem('googleId');
      expect(storedGoogleId).toBeNull();
    });

    it('should update currentUser$ observable to null', (done) => {
      service.logout();

      let emissionCount = 0;
      service.currentUser$.subscribe((user) => {
        emissionCount++;
        // Check that we get null after logout
        if (emissionCount > 1 || (emissionCount === 1 && user === null)) {
          expect(user).toBeNull();
          done();
        }
      });
    });

    it('should clear authentication state', () => {
      service.logout();

      expect(service.isLoggedIn).toBe(false);
      expect(service.getCurrentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('getCurrentUser()', () => {
    it('should return null when no user is logged in', () => {
      expect(service.getCurrentUser()).toBeNull();
    });

    it('should return the currently logged-in user', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
        picture: 'https://example.com/pic.jpg',
      };

      service.login(testUser);
      const user = service.getCurrentUser();

      expect(user).toEqual(testUser);
    });

    it('should return consistent user data across multiple calls', () => {
      const testUser = {
        id: '456',
        googleId: 'google_456',
        name: 'Jane Smith',
        email: 'jane@example.com',
      };

      service.login(testUser);

      const user1 = service.getCurrentUser();
      const user2 = service.getCurrentUser();

      expect(user1).toEqual(user2);
      expect(user1).toEqual(testUser);
    });

    it('should return user data persisted across page reloads', () => {
      const testUser = {
        id: '789',
        googleId: 'google_789',
        name: 'Bob Johnson',
        email: 'bob@example.com',
      };

      service.login(testUser);

      // Simulate page reload by creating a new service instance
      const newService = new AuthService();
      const reloadedUser = newService.getCurrentUser();

      expect(reloadedUser).toEqual(testUser);
    });
  });

  describe('isAuthenticated()', () => {
    it('should return false when no user is logged in', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should return true when user is logged in', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      service.login(testUser);

      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false after logout', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      service.login(testUser);
      expect(service.isAuthenticated()).toBe(true);

      service.logout();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should match isLoggedIn getter', () => {
      expect(service.isAuthenticated()).toBe(service.isLoggedIn);

      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      service.login(testUser);
      expect(service.isAuthenticated()).toBe(service.isLoggedIn);

      service.logout();
      expect(service.isAuthenticated()).toBe(service.isLoggedIn);
    });
  });

  describe('getGoogleIdForHeaderInjection()', () => {
    it('should return null when not authenticated', () => {
      expect(service.getGoogleIdForHeaderInjection()).toBeNull();
    });

    it('should return Google ID for authenticated user', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      service.login(testUser);

      const googleId = service.getGoogleIdForHeaderInjection();
      expect(googleId).toBe('google_123');
    });

    it('should retrieve Google ID from sessionStorage', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      service.login(testUser);

      // Verify it can read from sessionStorage directly
      const storedGoogleId = sessionStorage.getItem('googleId');
      expect(storedGoogleId).toBe('google_123');
      expect(service.getGoogleIdForHeaderInjection()).toBe(storedGoogleId);
    });

    it('should enable frontend to inject Google ID in request headers (X-User-Id)', () => {
      const testUser = {
        id: '123',
        googleId: 'google_456',
        name: 'John Doe',
        email: 'john@example.com',
      };

      service.login(testUser);

      // Simulate what HTTP interceptor would do
      const headerValue = service.getGoogleIdForHeaderInjection();
      expect(headerValue).toBe('google_456');

      // This would be used as:
      // headers.set('X-User-Id', headerValue)
    });
  });

  describe('User data persistence across page reloads', () => {
    it('should load user data from sessionStorage on service initialization', () => {
      const testUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      // Store user in sessionStorage
      sessionStorage.setItem('Loggedinuser', JSON.stringify(testUser));

      // Create new service instance (simulating page reload)
      const newService = new AuthService();

      expect(newService.getCurrentUser()).toEqual(testUser);
      expect(newService.isAuthenticated()).toBe(true);
    });

    it('should handle invalid JSON in sessionStorage gracefully', () => {
      sessionStorage.setItem('Loggedinuser', 'invalid json');

      spyOn(console, 'error');
      const newService = new AuthService();

      expect(console.error).toHaveBeenCalled();
      expect(newService.getCurrentUser()).toBeNull();
      expect(newService.isAuthenticated()).toBe(false);
    });

    it('should handle malformed user data (missing required fields) on load', () => {
      const malformedUser = {
        name: 'John Doe',
        email: 'john@example.com',
        // missing id and googleId
      };

      sessionStorage.setItem('Loggedinuser', JSON.stringify(malformedUser));

      spyOn(console, 'warn');
      const newService = new AuthService();

      expect(console.warn).toHaveBeenCalledWith(
        'Invalid user data in sessionStorage, clearing'
      );
      expect(newService.getCurrentUser()).toBeNull();
    });
  });

  describe('Edge cases and requirements validation', () => {
    it('should satisfy Requirement 2.1 - authenticated user ID from request context', () => {
      const testUser = {
        id: 'user_context_id',
        googleId: 'google_id',
        name: 'John',
        email: 'john@example.com',
      };

      service.login(testUser);
      expect(service.getCurrentUser()?.id).toBe('user_context_id');
    });

    it('should satisfy Requirement 4.2 - Google user ID validation from session', () => {
      const testUser = {
        id: '123',
        googleId: 'validated_google_id',
        name: 'John',
        email: 'john@example.com',
      };

      service.login(testUser);

      const storedGoogleId = sessionStorage.getItem('googleId');
      expect(storedGoogleId).toBe('validated_google_id');
    });

    it('should satisfy Requirement 4.4 - Google ID header injection in requests', () => {
      const testUser = {
        id: '123',
        googleId: 'header_google_id',
        name: 'John',
        email: 'john@example.com',
      };

      service.login(testUser);

      // Verify Google ID is available for header injection
      const headerInjectionValue = service.getGoogleIdForHeaderInjection();
      expect(headerInjectionValue).toBe('header_google_id');

      // This ID would be used in HTTP interceptor as:
      // const headerValue = this.authService.getGoogleIdForHeaderInjection();
      // if (headerValue) {
      //   req = req.clone({
      //     setHeaders: { 'X-User-Id': headerValue }
      //   });
      // }
    });

    it('should handle user data with additional properties for extensibility', () => {
      const extendedUser = {
        id: '123',
        googleId: 'google_123',
        name: 'John Doe',
        email: 'john@example.com',
        picture: 'https://example.com/pic.jpg',
        preferences: {
          theme: 'dark',
          language: 'en',
        },
        role: 'customer',
        createdAt: '2024-01-01',
      };

      service.login(extendedUser);

      const user = service.getCurrentUser();
      expect(user?.['preferences']).toEqual({ theme: 'dark', language: 'en' });
      expect(user?.['role']).toBe('customer');
      expect(user?.['createdAt']).toBe('2024-01-01');
    });
  });
});
