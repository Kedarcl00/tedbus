/**
 * Unit Tests for Route Planner Controller
 * Tests: cities, calculateRoute, saveRoute, getSavedRoutes, deleteRoute
 */

const ctrl = require('../controller/route-planner');
const SavedRoute = require('../models/savedRoute');

jest.mock('../models/savedRoute');

// Minimal res/req helpers
function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn(),
    sendError: jest.fn(),
  };
  return res;
}

function makeReq(overrides = {}) {
  return {
    headers: {},
    query:   {},
    body:    {},
    params:  {},
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Cities endpoint ────────────────────────────────────────────

describe('getCities', () => {
  it('should return a sorted list of Indian cities', async () => {
    const req = makeReq();
    const res = makeRes();
    await ctrl.getCities(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['Mumbai', 'Delhi', 'Bangalore']));
    const cities = res.json.mock.calls[0][0];
    expect(cities.length).toBeGreaterThan(10);
    // Should be sorted
    expect(cities).toEqual([...cities].sort());
  });
});

// ── calculateRoute ─────────────────────────────────────────────

describe('calculateRoute', () => {
  it('should return 400 when origin or destination is missing', async () => {
    const req = makeReq({ body: { origin: null, destination: null } });
    const res = makeRes();
    await ctrl.calculateRoute(req, res);
    expect(res.sendError).toHaveBeenCalledWith('VALIDATION', 400, expect.any(String));
  });

  it('should calculate route between two known cities and return distance and duration', async () => {
    const req = makeReq({
      body: {
        origin:      { address: 'Mumbai' },
        destination: { address: 'Pune' },
        waypoints:   [],
      },
    });
    const res = makeRes();
    await ctrl.calculateRoute(req, res);

    expect(res.json).toHaveBeenCalled();
    const result = res.json.mock.calls[0][0];
    expect(result).toHaveProperty('distance');
    expect(result).toHaveProperty('duration');
    expect(result).toHaveProperty('congestionLevel');
    expect(result).toHaveProperty('alternatives');
    expect(Array.isArray(result.alternatives)).toBe(true);
    expect(result.alternatives.length).toBeGreaterThan(0);
    // Each alternative has required fields
    result.alternatives.forEach(alt => {
      expect(alt).toHaveProperty('label');
      expect(alt).toHaveProperty('distance');
      expect(alt).toHaveProperty('duration');
      expect(alt).toHaveProperty('congestionLevel');
    });
  }, 10000);

  it('should calculate route with a waypoint', async () => {
    const req = makeReq({
      body: {
        origin:      { address: 'Mumbai' },
        destination: { address: 'Goa' },
        waypoints:   [{ address: 'Pune' }],
      },
    });
    const res = makeRes();
    await ctrl.calculateRoute(req, res);
    expect(res.json).toHaveBeenCalled();
    const result = res.json.mock.calls[0][0];
    expect(result).toHaveProperty('distance');
    expect(result).toHaveProperty('polyline');
    expect(result.routeStats).toHaveProperty('distanceKm');
    expect(result.routeStats.distanceKm).toBeGreaterThan(0);
  }, 10000);

  it('should return traffic info with valid congestionLevel', async () => {
    const req = makeReq({
      body: {
        origin:      { address: 'Delhi' },
        destination: { address: 'Agra' },
        waypoints:   [],
      },
    });
    const res = makeRes();
    await ctrl.calculateRoute(req, res);
    const result = res.json.mock.calls[0][0];
    expect(['low', 'moderate', 'high']).toContain(result.congestionLevel);
    expect(result).toHaveProperty('trafficDelay');
    expect(result).toHaveProperty('trafficMessage');
  }, 10000);
});

// ── getSavedRoutes ─────────────────────────────────────────────

describe('getSavedRoutes', () => {
  it('should return 401 when userId header is missing', async () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    await ctrl.getSavedRoutes(req, res);
    expect(res.sendError).toHaveBeenCalledWith('UNAUTHORIZED', 401);
  });

  it('should return saved routes for authenticated user', async () => {
    const mockRoutes = [
      { _id: 'r1', userId: 'u1', name: 'Daily Route', origin: { address: 'Mumbai' }, destination: { address: 'Pune' } },
    ];
    const mockQuery = {
      sort:  jest.fn().mockReturnThis(),
      lean:  jest.fn().mockResolvedValue(mockRoutes),
    };
    SavedRoute.find.mockReturnValue(mockQuery);

    const req = makeReq({ headers: { 'x-user-id': 'u1' }, query: { sortBy: 'recent' } });
    const res = makeRes();
    await ctrl.getSavedRoutes(req, res);
    expect(res.json).toHaveBeenCalledWith(mockRoutes);
  });
});

// ── saveRoute ──────────────────────────────────────────────────

describe('saveRoute', () => {
  it('should return 401 when userId header is missing', async () => {
    const req = makeReq({ headers: {}, body: { name: 'Test', origin: { address: 'Mumbai' }, destination: { address: 'Pune' } } });
    const res = makeRes();
    await ctrl.saveRoute(req, res);
    expect(res.sendError).toHaveBeenCalledWith('UNAUTHORIZED', 401);
  });

  it('should return 400 when required fields are missing', async () => {
    const req = makeReq({ headers: { 'x-user-id': 'u1' }, body: { name: '', origin: null, destination: null } });
    const res = makeRes();
    await ctrl.saveRoute(req, res);
    expect(res.sendError).toHaveBeenCalledWith('VALIDATION', 400, expect.any(String));
  });

  it('should create and return a saved route', async () => {
    const mockRoute = { _id: 'r1', userId: 'u1', name: 'Mumbai-Pune', origin: { address: 'Mumbai' }, destination: { address: 'Pune' } };
    SavedRoute.create.mockResolvedValue(mockRoute);

    const req = makeReq({
      headers: { 'x-user-id': 'u1' },
      body: {
        name:        'Mumbai-Pune',
        origin:      { address: 'Mumbai', lat: 19.07, lng: 72.87 },
        destination: { address: 'Pune',   lat: 18.52, lng: 73.85 },
        distance:    '148 km',
        duration:    '2 hr 45 min',
      },
    });
    const res = makeRes();
    await ctrl.saveRoute(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(mockRoute);
  });
});

// ── deleteRoute ────────────────────────────────────────────────

describe('deleteRoute', () => {
  it('should return 401 when userId header is missing', async () => {
    const req = makeReq({ headers: {}, params: { id: 'r1' } });
    const res = makeRes();
    await ctrl.deleteRoute(req, res);
    expect(res.sendError).toHaveBeenCalledWith('UNAUTHORIZED', 401);
  });

  it('should return 404 when route is not found', async () => {
    SavedRoute.findById.mockResolvedValue(null);
    const req = makeReq({ headers: { 'x-user-id': 'u1' }, params: { id: 'r999' } });
    const res = makeRes();
    await ctrl.deleteRoute(req, res);
    expect(res.sendError).toHaveBeenCalledWith('NOT_FOUND', 404, expect.any(String));
  });

  it('should return 403 when user does not own the route', async () => {
    SavedRoute.findById.mockResolvedValue({ _id: 'r1', userId: 'other-user' });
    const req = makeReq({ headers: { 'x-user-id': 'u1' }, params: { id: 'r1' } });
    const res = makeRes();
    await ctrl.deleteRoute(req, res);
    expect(res.sendError).toHaveBeenCalledWith('UNAUTHORIZED', 403, expect.any(String));
  });

  it('should delete the route and return success', async () => {
    SavedRoute.findById.mockResolvedValue({ _id: 'r1', userId: 'u1' });
    SavedRoute.findByIdAndDelete.mockResolvedValue({});

    const req = makeReq({ headers: { 'x-user-id': 'u1' }, params: { id: 'r1' } });
    const res = makeRes();
    await ctrl.deleteRoute(req, res);
    expect(SavedRoute.findByIdAndDelete).toHaveBeenCalledWith('r1');
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});
