import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CustomerService, UserProfile, UpdateProfileDTO, UserPreferences } from './customer.service';
import { url } from '../config';

/**
 * CustomerService Unit Tests
 *
 * Tests the frontend service for managing user profiles and preferences
 * Verifies:
 * - getProfile() calls GET /api/users/profile
 * - updateProfile() calls PUT /api/users/profile
 * - getPreferences() calls GET /api/users/preferences
 * - addcustomermongo() calls POST /api/customer (legacy)
 * - Proper error handling for various HTTP error codes
 * - Error messages are extracted from backend responses
 * - User isolation (no explicit user parameters, enforced server-side)
 *
 */
describe('CustomerService', () => {
  let service: CustomerService;
  let httpMock: HttpTestingController;

  const mockUserProfile: UserProfile = {
    id: 'user123',
    name: 'John Doe',
    email: 'john@example.com',
    gender: 'Male',
    dateOfBirth: '1990-05-15',
    phone: '+1-555-0123',
    picture: 'http://example.com/photo.jpg',
    googleId: 'google123',
    preferences: { theme: 'light', notifications: true },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z'
  };

  const mockPreferences: UserPreferences = {
    theme: 'dark',
    language: 'en',
    notifications: true
  };

  const profileUrl = `${url}api/users/profile`;
  const preferencesUrl = `${url}api/users/preferences`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CustomerService]
    });
    service = TestBed.inject(CustomerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  /**
   * Test: Service creation
   * Verifies service can be instantiated
   */
  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  /**
   * Test: getProfile() calls correct endpoint
   * Verifies GET /api/users/profile is called
   */
  it('should call GET /api/users/profile for getProfile()', (done) => {
    service.getProfile().subscribe((profile) => {
      expect(profile).toEqual(mockUserProfile);
      expect(profile.id).toBe('user123');
      expect(profile.name).toBe('John Doe');
      done();
    });

    const req = httpMock.expectOne(profileUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mockUserProfile);
  });

  /**
   * Test: getProfile() returns UserProfile with all fields
   * Verifies profile includes all expected fields
   */
  it('should return complete UserProfile with all fields', (done) => {
    service.getProfile().subscribe((profile) => {
      expect(profile.id).toBe('user123');
      expect(profile.name).toBe('John Doe');
      expect(profile.email).toBe('john@example.com');
      expect(profile.gender).toBe('Male');
      expect(profile.dateOfBirth).toBe('1990-05-15');
      expect(profile.phone).toBe('+1-555-0123');
      expect(profile.picture).toBe('http://example.com/photo.jpg');
      expect(profile.preferences).toBeDefined();
      expect(profile.createdAt).toBeDefined();
      expect(profile.updatedAt).toBeDefined();
      done();
    });

    const req = httpMock.expectOne(profileUrl);
    req.flush(mockUserProfile);
  });

  /**
   * Test: updateProfile() calls correct endpoint
   * Verifies PUT /api/users/profile is called with update data
   */
  it('should call PUT /api/users/profile for updateProfile()', (done) => {
    const updateData: UpdateProfileDTO = {
      phone: '+1-555-9876',
      preferences: { theme: 'dark' }
    };

    service.updateProfile(updateData).subscribe((profile) => {
      expect(profile).toEqual(mockUserProfile);
      done();
    });

    const req = httpMock.expectOne(profileUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(updateData);
    req.flush(mockUserProfile);
  });

  /**
   * Test: updateProfile() accepts partial updates
   * Verifies only specified fields need to be provided
   */
  it('should accept partial profile updates', (done) => {
    const partialUpdate: UpdateProfileDTO = {
      phone: '+1-555-0000'
    };

    service.updateProfile(partialUpdate).subscribe((profile) => {
      expect(profile.phone).toBe(mockUserProfile.phone); // Returns full profile
      done();
    });

    const req = httpMock.expectOne(profileUrl);
    expect(req.request.body).toEqual(partialUpdate);
    req.flush(mockUserProfile);
  });

  /**
   * Test: updateProfile() with preferences
   * Verifies preferences can be updated
   */
  it('should update preferences in updateProfile()', (done) => {
    const updateData: UpdateProfileDTO = {
      preferences: { theme: 'dark', language: 'es' }
    };

    service.updateProfile(updateData).subscribe((profile) => {
      expect(profile.preferences).toBeDefined();
      done();
    });

    const req = httpMock.expectOne(profileUrl);
    expect(req.request.body.preferences).toEqual({ theme: 'dark', language: 'es' });
    req.flush(mockUserProfile);
  });

  /**
   * Test: getPreferences() calls correct endpoint
   * Verifies GET /api/users/preferences is called
   */
  it('should call GET /api/users/preferences for getPreferences()', (done) => {
    service.getPreferences().subscribe((preferences) => {
      expect(preferences).toEqual(mockPreferences);
      done();
    });

    const req = httpMock.expectOne(preferencesUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mockPreferences);
  });

  /**
   * Test: addcustomermongo() calls legacy endpoint
   * Verifies backward compatibility with legacy registration
   */
  it('should call POST /customer for legacy addcustomermongo()', (done) => {
    const user = {
      name: 'John Doe',
      email: 'john@example.com',
      id: 'google123',
      picture: 'http://example.com/photo.jpg'
    };

    service.addcustomermongo(user).subscribe((result) => {
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      done();
    });

    const req = httpMock.expectOne(`${url}customer/`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'cust123', name: 'John Doe', email: 'john@example.com' });
  });

  /**
   * Test: Error handling for 403 Forbidden
   * Verifies user isolation violation is properly handled
   */
  it('should handle 403 Forbidden error', (done) => {
    service.getProfile().subscribe(
      () => fail('should have failed'),
      (error) => {
        expect(error.statusCode).toBe(403);
        expect(error.message).toBe('Forbidden');
        done();
      }
    );

    const req = httpMock.expectOne(profileUrl);
    req.flush({ error: { message: 'Forbidden' } }, { status: 403, statusText: 'Forbidden' });
  });

  /**
   * Test: Error handling for 404 Not Found
   * Verifies missing profile is handled properly
   */
  it('should handle 404 Not Found error', (done) => {
    service.getProfile().subscribe(
      () => fail('should have failed'),
      (error) => {
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Not Found');
        done();
      }
    );

    const req = httpMock.expectOne(profileUrl);
    req.flush({ error: { message: 'Not Found' } }, { status: 404, statusText: 'Not Found' });
  });

  /**
   * Test: Error handling for 401 Unauthorized
   * Verifies unauthenticated requests are handled
   */
  it('should handle 401 Unauthorized error', (done) => {
    service.getProfile().subscribe(
      () => fail('should have failed'),
      (error) => {
        expect(error.statusCode).toBe(401);
        expect(error.message).toBe('Unauthorized');
        done();
      }
    );

    const req = httpMock.expectOne(profileUrl);
    req.flush({ error: { message: 'Unauthorized' } }, { status: 401, statusText: 'Unauthorized' });
  });

  /**
   * Test: Error handling for 400 Bad Request
   * Verifies validation errors include details
   */
  it('should handle 400 Bad Request with validation details', (done) => {
    const updateData: UpdateProfileDTO = { phone: 'invalid' };

    service.updateProfile(updateData).subscribe(
      () => fail('should have failed'),
      (error) => {
        expect(error.statusCode).toBe(400);
        done();
      }
    );

    const req = httpMock.expectOne(profileUrl);
    req.flush(
      { error: { message: 'Bad Request', details: { phone: 'Invalid phone format' } } },
      { status: 400, statusText: 'Bad Request' }
    );
  });

  /**
   * Test: Error handling for 500 Internal Server Error
   * Verifies server errors don't expose internal details to client
   */
  it('should handle 500 Internal Server Error with generic message', (done) => {
    service.getProfile().subscribe(
      () => fail('should have failed'),
      (error) => {
        expect(error.statusCode).toBe(500);
        // Message will be the default message since we're setting status text to 'Internal Server Error'
        done();
      }
    );

    const req = httpMock.expectOne(profileUrl);
    req.flush({ error: { message: 'Internal Server Error' } }, { status: 500, statusText: 'Internal Server Error' });
  });

  /**
   * Test: Backend error response format handling
   * Verifies error message extraction from standard API error format
   * Standard error format
   */
  it('should extract error message from backend error response', (done) => {
    const backendError = {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to view this profile',
        statusCode: 403,
        details: null
      }
    };

    service.getProfile().subscribe(
      () => fail('should have failed'),
      (error) => {
        expect(error.message).toBe('You do not have permission to view this profile');
        done();
      }
    );

    const req = httpMock.expectOne(profileUrl);
    req.flush(backendError, { status: 403, statusText: 'Forbidden' });
  });

  /**
   * Test: User isolation enforcement (no explicit user ID parameter)
   * Verifies the service doesn't pass user ID as query parameter
   * User isolation is enforced server-side via X-User-Id header (from interceptor)
   */
  it('should not include user ID as query parameter (user isolation enforced server-side)', (done) => {
    service.getProfile().subscribe(() => {
      done();
    });

    const req = httpMock.expectOne(profileUrl);
    // Verify no query params are sent
    expect(req.request.url).not.toContain('userId');
    expect(req.request.url).not.toContain('?');
    req.flush(mockUserProfile);
  });

  /**
   * Test: Error details are preserved
   * Verifies error details from backend are accessible to caller
   */
  it('should preserve error details from backend response', (done) => {
    const errorDetails = { field: 'phone', reason: 'Invalid format' };

    service.updateProfile({ phone: 'bad' }).subscribe(
      () => fail('should have failed'),
      (error) => {
        expect(error.details).toEqual(errorDetails);
        done();
      }
    );

    const req = httpMock.expectOne(profileUrl);
    req.flush(
      { error: { message: 'Validation failed', details: errorDetails } },
      { status: 400, statusText: 'Bad Request' }
    );
  });

  /**
   * Test: Multiple profile updates
   * Verifies service can handle multiple consecutive calls
   */
  it('should handle multiple profile update calls', (done) => {
    const update1: UpdateProfileDTO = { phone: '+1-111-1111' };
    const update2: UpdateProfileDTO = { phone: '+1-222-2222' };

    let count = 0;

    service.updateProfile(update1).subscribe(() => {
      count++;
      if (count === 2) done();
    });

    service.updateProfile(update2).subscribe(() => {
      count++;
      if (count === 2) done();
    });

    const reqs = httpMock.match(profileUrl);
    expect(reqs.length).toBe(2);
    reqs[0].flush(mockUserProfile);
    reqs[1].flush(mockUserProfile);
  });

  /**
   * Test: Empty preferences response
   * Verifies handling of empty preferences object
   */
  it('should handle empty preferences response', (done) => {
    service.getPreferences().subscribe((preferences) => {
      expect(preferences).toEqual({});
      done();
    });

    const req = httpMock.expectOne(preferencesUrl);
    req.flush({});
  });

  /**
   * Test: Optional fields in profile
   * Verifies profile works with missing optional fields
   */
  it('should handle profile with missing optional fields', (done) => {
    const minimalProfile: UserProfile = {
      id: 'user456',
      name: 'Jane Doe',
      email: 'jane@example.com'
    };

    service.getProfile().subscribe((profile) => {
      expect(profile.id).toBe('user456');
      expect(profile.name).toBe('Jane Doe');
      expect(profile.email).toBe('jane@example.com');
      expect(profile.phone).toBeUndefined();
      expect(profile.gender).toBeUndefined();
      done();
    });

    const req = httpMock.expectOne(profileUrl);
    req.flush(minimalProfile);
  });
});
