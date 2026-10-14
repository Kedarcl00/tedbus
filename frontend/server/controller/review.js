/**
 * Review Controller - Handles verified post-journey ratings and reviews
 */

const Review = require('../models/Review');
const Booking = require('../models/booking');
const User = require('../models/User');

/**
 * POST /api/reviews — Submit a new review
 * Requires: X-User-Id header
 */
exports.submitReview = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.sendError('UNAUTHORIZED', 401);
    }

    const { bookingId, busId, rating, reviewText } = req.body;

    // Validate required fields
    if (!bookingId || !busId || !rating || !reviewText) {
      return res.sendError('VALIDATION', 400, 'Missing required fields');
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.sendError('VALIDATION', 400, 'Rating must be between 1 and 5');
    }

    // Validate review text length
    if (reviewText.length < 20) {
      return res.sendError('VALIDATION', 400, 'Review text must be at least 20 characters');
    }

    // Check if booking exists and belongs to user
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.sendError('NOT_FOUND', 404, 'Booking not found');
    }


    if (booking.customerId.toString() !== userId) {
      // userId is a googleId — resolve to MongoDB _id for comparison
      const user = await User.findOne({ googleId: userId }).select('_id').lean().exec();
      if (!user || booking.customerId.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Booking does not belong to user', statusCode: 403 }
        });
      }
    }

    // Validate journey is completed
    // Accept 'completed' status, or treat any past booking as eligible if status field doesn't exist
    const isCompleted = booking.status === 'completed' || booking.status === 'in_progress';
    if (!isCompleted && booking.departureDetails && booking.departureDetails.date) {
      const departureDate = new Date(booking.departureDetails.date);
      const now = new Date();
      if (departureDate > now) {
        return res.status(403).json({
          success: false,
          error: { code: 'JOURNEY_NOT_COMPLETED', message: 'Journey has not been completed yet', statusCode: 403 }
        });
      }
    }

    // Check if review already exists for this booking
    const existingReview = await Review.findOne({ bookingId });
    if (existingReview) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_REVIEW', message: 'Review already exists for this booking', statusCode: 409 }
      });
    }

    // Create review
    const review = await Review.create({
      userId,
      bookingId,
      busId,
      rating,
      reviewText,
    });

    res.status(201).json({
      success: true,
      review,
    });
  } catch (err) {
    console.error('Submit review error:', err);
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_REVIEW', message: 'Review already exists for this booking', statusCode: 409 }
      });
    }
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * PUT /api/reviews/:id — Edit review (owner only, within 24h)
 * Requires: X-User-Id header
 */
exports.editReview = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.sendError('UNAUTHORIZED', 401);
    }

    const { id } = req.params;
    const { rating, reviewText } = req.body;

    // Find review
    const review = await Review.findById(id);
    if (!review) {
      return res.sendError('NOT_FOUND', 404, 'Review not found');
    }

    // Verify ownership
    if (review.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only edit your own reviews', statusCode: 403 }
      });
    }

    // Check 24h window
    const timeSinceCreation = Date.now() - review.createdAt.getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (timeSinceCreation > twentyFourHours) {
      return res.status(403).json({
        success: false,
        error: { code: 'EDIT_WINDOW_EXPIRED', message: 'Reviews can only be edited within 24 hours', statusCode: 403 }
      });
    }

    // Validate new values
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.sendError('VALIDATION', 400, 'Rating must be between 1 and 5');
      }
      review.rating = rating;
    }

    if (reviewText !== undefined) {
      if (reviewText.length < 20) {
        return res.sendError('VALIDATION', 400, 'Review text must be at least 20 characters');
      }
      review.reviewText = reviewText;
    }

    review.editedAt = new Date();
    await review.save();

    res.json({
      success: true,
      review,
    });
  } catch (err) {
    console.error('Edit review error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * DELETE /api/reviews/:id — Delete review
 * Owner within 24h OR moderator
 */
exports.deleteReview = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    if (!userId) {
      return res.sendError('UNAUTHORIZED', 401);
    }

    const { id } = req.params;

    // Find review
    const review = await Review.findById(id);
    if (!review) {
      return res.sendError('NOT_FOUND', 404, 'Review not found');
    }

    // Check if user is moderator
    const isModerator = userRole === 'moderator';

    // Check if user is owner within 24h
    const isOwner = review.userId === userId;
    const timeSinceCreation = Date.now() - review.createdAt.getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const withinWindow = timeSinceCreation <= twentyFourHours;

    if (!isModerator && !(isOwner && withinWindow)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to delete this review', statusCode: 403 }
      });
    }

    await Review.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (err) {
    console.error('Delete review error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * GET /api/reviews/bus/:busId — Get reviews for a bus (public)
 */
exports.getBusReviews = async (req, res) => {
  try {
    const { busId } = req.params;

    // Get reviews that are not hidden
    const reviews = await Review.find({ busId, hidden: false })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate average rating and total count
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

    res.json({
      success: true,
      busId,
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10, // round to 1 decimal
      reviews,
    });
  } catch (err) {
    console.error('Get bus reviews error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * POST /api/reviews/:id/helpful — Mark review as helpful
 * Requires: X-User-Id header
 */
exports.markHelpful = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.sendError('UNAUTHORIZED', 401);
    }

    const { id } = req.params;

    // Find review
    const review = await Review.findById(id);
    if (!review) {
      return res.sendError('NOT_FOUND', 404, 'Review not found');
    }

    // Add userId to helpful array if not already present
    if (!review.helpful.includes(userId)) {
      review.helpful.push(userId);
      await review.save();
    }

    res.json({
      success: true,
      helpfulCount: review.helpful.length,
    });
  } catch (err) {
    console.error('Mark helpful error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * POST /api/reviews/:id/report — Report review
 * Requires: X-User-Id header
 */
exports.reportReview = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.sendError('UNAUTHORIZED', 401);
    }

    const { id } = req.params;

    // Find review
    const review = await Review.findById(id);
    if (!review) {
      return res.sendError('NOT_FOUND', 404, 'Review not found');
    }

    // Add userId to reported array if not already present
    if (!review.reported.includes(userId)) {
      review.reported.push(userId);
      await review.save();
    }

    res.json({
      success: true,
      reportedCount: review.reported.length,
    });
  } catch (err) {
    console.error('Report review error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * POST /api/reviews/:id/moderate — Hide/unhide review (moderator only)
 * Requires: X-User-Id and X-User-Role: 'moderator'
 */
exports.moderateReview = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    if (!userId) {
      return res.sendError('UNAUTHORIZED', 401);
    }

    if (userRole !== 'moderator') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Moderator access required', statusCode: 403 }
      });
    }

    const { id } = req.params;
    const { hidden } = req.body;

    // Find review
    const review = await Review.findById(id);
    if (!review) {
      return res.sendError('NOT_FOUND', 404, 'Review not found');
    }

    // Toggle or set hidden status
    review.hidden = typeof hidden === 'boolean' ? hidden : !review.hidden;
    review.moderatedBy = userId;
    await review.save();

    res.json({
      success: true,
      review,
    });
  } catch (err) {
    console.error('Moderate review error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};
