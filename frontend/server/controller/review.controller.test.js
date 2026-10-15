const ctrl = require('./review');
const Review = require('../models/Review');
const Booking = require('../models/booking');
const User = require('../models/User');

jest.mock('../models/Review');
jest.mock('../models/booking');
jest.mock('../models/User');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    sendError: jest.fn(),
  };
}

function makeReq(overrides = {}) {
  return {
    headers: {},
    params: {},
    body: {},
    query: {},
    ...overrides,
  };
}

describe('Review Controller Tests', () => {
  const mockUserId = 'user123';
  const mockUserObj = {
    _id: '507f1f77bcf86cd799439011',
    googleId: mockUserId,
    name: 'Test Traveller',
    email: 'traveller@test.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitReview', () => {
    test('requires authentication', async () => {
      const req = makeReq({ headers: {} });
      const res = makeRes();
      await ctrl.submitReview(req, res);
      expect(res.sendError).toHaveBeenCalledWith('UNAUTHORIZED', 401, expect.any(String));
    });

    test('validates minimum character length of 20 chars', async () => {
      User.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUserObj) })
      });

      const req = makeReq({
        headers: { 'x-user-id': mockUserId },
        body: { bookingId: 'b1', rating: 5, reviewText: 'Too short' }
      });
      const res = makeRes();

      await ctrl.submitReview(req, res);
      expect(res.sendError).toHaveBeenCalledWith('VALIDATION', 400, expect.stringContaining('20 characters'));
    });

    test('rejects rating outside 1-5 range', async () => {
      User.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUserObj) })
      });

      const req = makeReq({
        headers: { 'x-user-id': mockUserId },
        body: { bookingId: 'b1', rating: 6, reviewText: 'This is a long enough review text for the journey' }
      });
      const res = makeRes();

      await ctrl.submitReview(req, res);
      expect(res.sendError).toHaveBeenCalledWith('VALIDATION', 400, expect.stringContaining('between 1 and 5'));
    });

    test('rejects review if journey is not yet completed', async () => {
      User.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUserObj) })
      });

      const futureDate = new Date(Date.now() + 86400000 * 5); // 5 days in future
      Booking.findById.mockResolvedValue({
        _id: 'b1',
        customerId: mockUserObj._id,
        status: 'confirmed',
        departureDetails: { date: futureDate.toISOString() }
      });

      const req = makeReq({
        headers: { 'x-user-id': mockUserId },
        body: { bookingId: 'b1', rating: 5, reviewText: 'This is a long enough review text for the journey' }
      });
      const res = makeRes();

      await ctrl.submitReview(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({ code: 'JOURNEY_NOT_COMPLETED' })
      }));
    });

    test('prevents multiple reviews for the same journey booking', async () => {
      User.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUserObj) })
      });

      Booking.findById.mockResolvedValue({
        _id: 'b1',
        customerId: mockUserObj._id,
        status: 'completed',
      });

      Review.findOne.mockResolvedValue({ _id: 'existingRev' });

      const req = makeReq({
        headers: { 'x-user-id': mockUserId },
        body: { bookingId: 'b1', rating: 5, reviewText: 'This journey was fantastic and smooth throughout' }
      });
      const res = makeRes();

      await ctrl.submitReview(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({ code: 'DUPLICATE_REVIEW' })
      }));
    });

    test('successfully creates review for completed journey', async () => {
      User.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUserObj) })
      });

      Booking.findById.mockResolvedValue({
        _id: 'b1',
        customerId: mockUserObj._id,
        busId: 'bus99',
        routeId: 'route88',
        status: 'completed',
      });

      Review.findOne.mockResolvedValue(null);
      Review.create.mockResolvedValue({
        _id: 'newRev',
        bookingId: 'b1',
        rating: 5,
        reviewText: 'The ride was very comfortable, air conditioning worked perfectly.',
      });

      const req = makeReq({
        headers: { 'x-user-id': mockUserId },
        body: {
          bookingId: 'b1',
          rating: 5,
          reviewText: 'The ride was very comfortable, air conditioning worked perfectly.'
        }
      });
      const res = makeRes();

      await ctrl.submitReview(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('editReview within and after 24h window', () => {
    test('allows edit within 24 hours of creation', async () => {
      User.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUserObj) })
      });

      const mockReviewDoc = {
        _id: 'rev1',
        userId: mockUserObj._id.toString(),
        rating: 4,
        reviewText: 'Original text that is long enough for the validation',
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
        save: jest.fn().mockResolvedValue(true),
      };

      Review.findById.mockResolvedValue(mockReviewDoc);

      const req = makeReq({
        headers: { 'x-user-id': mockUserId },
        params: { id: 'rev1' },
        body: { rating: 5, reviewText: 'Updated text that is also definitely long enough!' }
      });
      const res = makeRes();

      await ctrl.editReview(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(mockReviewDoc.rating).toBe(5);
      expect(mockReviewDoc.save).toHaveBeenCalled();
    });

    test('rejects edit after 24 hours window has expired', async () => {
      User.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUserObj) })
      });

      const mockReviewDoc = {
        _id: 'rev1',
        userId: mockUserObj._id.toString(),
        rating: 4,
        reviewText: 'Original text that is long enough for the validation',
        createdAt: new Date(Date.now() - 25 * 3600000), // 25 hours ago
      };

      Review.findById.mockResolvedValue(mockReviewDoc);

      const req = makeReq({
        headers: { 'x-user-id': mockUserId },
        params: { id: 'rev1' },
        body: { rating: 5 }
      });
      const res = makeRes();

      await ctrl.editReview(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({ code: 'EDIT_WINDOW_EXPIRED' })
      }));
    });
  });

  describe('reportReview and auto-hiding', () => {
    test('auto-hides review when reported multiple times and excludes from average', async () => {
      const mockReviewDoc = {
        _id: 'revReport',
        reported: ['userA'],
        hidden: false,
        save: jest.fn().mockResolvedValue(true),
      };

      Review.findById.mockResolvedValue(mockReviewDoc);

      const req = makeReq({
        headers: { 'x-user-id': 'userB' },
        params: { id: 'revReport' },
      });
      const res = makeRes();

      await ctrl.reportReview(req, res);
      expect(mockReviewDoc.reported).toContain('userB');
      expect(mockReviewDoc.hidden).toBe(true); // Now 2 reports -> hidden!
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        reportedCount: 2,
        hidden: true,
      }));
    });
  });

  describe('getBusReviews and trusted reviewer badge', () => {
    test('calculates average rating excluding hidden reviews and badges trusted reviewers', async () => {
      const mockReviews = [
        {
          _id: 'r1',
          userId: 'userTop',
          rating: 5,
          reviewText: 'Super smooth experience with comfortable seating',
          hidden: false,
          helpful: ['u1', 'u2', 'u3'],
        },
        {
          _id: 'r2',
          userId: 'userNorm',
          rating: 4,
          reviewText: 'Good journey, on-time departure and arrival',
          hidden: false,
          helpful: [],
        }
      ];

      Review.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockReviews)
        })
      });

      // Aggregation returns userTop as trusted reviewer (>= 3 upvotes)
      Review.aggregate.mockResolvedValue([
        { _id: 'userTop', totalHelpful: 4 }
      ]);

      const req = makeReq({ params: { busId: 'bus100' } });
      const res = makeRes();

      await ctrl.getBusReviews(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        busId: 'bus100',
        totalReviews: 2,
        averageRating: 4.5,
      }));

      const resData = res.json.mock.calls[0][0];
      const r1 = resData.reviews.find(r => r._id === 'r1');
      const r2 = resData.reviews.find(r => r._id === 'r2');
      expect(r1.isTrustedReviewer).toBe(true);
      expect(r2.isTrustedReviewer).toBe(false);
    });
  });
});
