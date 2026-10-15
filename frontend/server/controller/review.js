/**
 * Review Controller - Handles verified post-journey ratings and reviews
 */

const mongoose = require('mongoose');
const Review = require('../models/Review');
const Booking = require('../models/booking');
const User = require('../models/User');

/**
 * Helper to resolve user by Google ID or ObjectId
 */
async function resolveUser(userId) {
  if (!userId) return null;
  const isObjectId = typeof userId === 'string' && /^[0-9a-fA-F]{24}$/.test(userId);
  return User.findOne({
    $or: [
      { googleId: String(userId) },
      ...(isObjectId ? [{ _id: userId }] : [])
    ]
  }).lean().exec();
}

/**
 * Get Set of userIds who qualify as "Trusted Reviewers"
 * (Users with >= 3 cumulative helpful upvotes across reviews)
 */
async function getTrustedReviewerSet() {
  try {
    const agg = await Review.aggregate([
      { $match: { hidden: false } },
      { $project: { userId: 1, helpfulCount: { $size: { $ifNull: ["$helpful", []] } } } },
      { $group: { _id: "$userId", totalHelpful: { $sum: "$helpfulCount" } } },
      { $match: { totalHelpful: { $gte: 3 } } }
    ]);
    return new Set(agg.map(a => String(a._id)));
  } catch (err) {
    console.error('Error calculating trusted reviewers:', err);
    return new Set();
  }
}

/**
 * Calculate ratings summary for a given query filter
 */
async function getReviewsSummary(filter) {
  const reviews = await Review.find({ ...filter, hidden: false })
    .sort({ createdAt: -1 })
    .lean();

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach(r => {
    if (distribution[r.rating] !== undefined) {
      distribution[r.rating]++;
    }
  });

  const trustedReviewers = await getTrustedReviewerSet();

  const enhancedReviews = reviews.map(r => ({
    ...r,
    isTrustedReviewer: trustedReviewers.has(String(r.userId)),
  }));

  return {
    totalReviews,
    averageRating: Math.round(averageRating * 10) / 10,
    distribution,
    reviews: enhancedReviews,
  };
}

/**
 * POST /api/reviews — Submit a new review
 * Requires: X-User-Id header or req.body.userId
 */
exports.submitReview = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId;
    if (!userId) {
      return res.sendError('UNAUTHORIZED', 401, 'Please sign in to submit a review');
    }

    const user = await resolveUser(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User account not found', statusCode: 401 }
      });
    }

    const { bookingId, busId, routeId, rating, reviewText } = req.body;

    // Validate required fields
    if (!bookingId || !rating || !reviewText) {
      return res.sendError('VALIDATION', 400, 'Booking ID, rating, and review text are required');
    }

    // Validate rating range
    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.sendError('VALIDATION', 400, 'Rating must be an integer between 1 and 5 stars');
    }

    // Validate review text length (minimum character limit to avoid low-effort feedback)
    if (typeof reviewText !== 'string' || reviewText.trim().length < 20) {
      return res.sendError('VALIDATION', 400, 'Review must be at least 20 characters long');
    }

    // Check if booking exists
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.sendError('NOT_FOUND', 404, 'Booking not found');
    }

    // Verify booking belongs to user
    const customerIdStr = booking.customerId?.toString();
    const userObjIdStr = user._id?.toString();
    const userGoogleIdStr = user.googleId?.toString();

    const isOwner = customerIdStr === userObjIdStr ||
                    customerIdStr === userGoogleIdStr ||
                    customerIdStr === String(userId) ||
                    (booking.email && booking.email.toLowerCase() === user.email.toLowerCase());

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only review your own bookings', statusCode: 403 }
      });
    }

    // Validate journey is completed (only after successfully completing their journey)
    const isExplicitlyCompleted = booking.status === 'completed' || booking.status === 'in_progress';
    let isPastJourney = false;
    const depDate = booking.departureDate || booking.journeyDate || booking.departureDetails?.date;
    if (depDate) {
      const parsedDate = new Date(depDate);
      if (!isNaN(parsedDate.getTime()) && parsedDate < new Date()) {
        isPastJourney = true;
      }
    }

    if (!isExplicitlyCompleted && !isPastJourney) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'JOURNEY_NOT_COMPLETED',
          message: 'Reviews can only be submitted after successfully completing your journey',
          statusCode: 403
        }
      });
    }

    // Enforce one review per journey/booking
    const existingReview = await Review.findOne({ bookingId: String(bookingId) });
    if (existingReview) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_REVIEW',
          message: 'You have already submitted a review for this journey',
          statusCode: 409
        }
      });
    }

    // Resolve busId and routeId
    const resolvedBusId = busId || (booking.busId ? booking.busId.toString() : '');
    const resolvedRouteId = routeId || (booking.routeId ? booking.routeId.toString() : '');

    // Create review
    const review = await Review.create({
      userId: user._id.toString(),
      bookingId: String(bookingId),
      busId: resolvedBusId,
      routeId: resolvedRouteId,
      userName: user.name || 'Verified Traveller',
      userPicture: user.picture || '',
      isVerifiedUser: true,
      rating: Math.round(numRating),
      reviewText: reviewText.trim(),
      createdAt: new Date(),
    });

    res.status(201).json({
      success: true,
      review,
      message: 'Thank you! Your review has been submitted successfully.'
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
 * PUT /api/reviews/:id — Edit review (owner only, within 24h window)
 */
exports.editReview = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId;
    if (!userId) {
      return res.sendError('UNAUTHORIZED', 401);
    }

    const user = await resolveUser(userId);
    const userIds = [String(userId)];
    if (user) {
      userIds.push(user._id.toString());
      if (user.googleId) userIds.push(user.googleId);
    }

    const { id } = req.params;
    const { rating, reviewText } = req.body;

    const review = await Review.findById(id);
    if (!review) {
      return res.sendError('NOT_FOUND', 404, 'Review not found');
    }

    // Verify ownership
    if (!userIds.includes(review.userId)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only edit your own reviews', statusCode: 403 }
      });
    }

    // Check 24h window: once submitted, ratings/reviews cannot be changed after 24 hours
    const timeSinceCreation = Date.now() - new Date(review.createdAt).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (timeSinceCreation > twentyFourHours) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'EDIT_WINDOW_EXPIRED',
          message: 'Reviews can only be edited within 24 hours of submission. Ratings cannot be changed after this window.',
          statusCode: 403
        }
      });
    }

    // Validate new values
    if (rating !== undefined) {
      const numRating = Number(rating);
      if (isNaN(numRating) || numRating < 1 || numRating > 5) {
        return res.sendError('VALIDATION', 400, 'Rating must be between 1 and 5');
      }
      review.rating = Math.round(numRating);
    }

    if (reviewText !== undefined) {
      if (typeof reviewText !== 'string' || reviewText.trim().length < 20) {
        return res.sendError('VALIDATION', 400, 'Review text must be at least 20 characters');
      }
      review.reviewText = reviewText.trim();
    }

    review.editedAt = new Date();
    await review.save();

    res.json({
      success: true,
      review,
      message: 'Review updated successfully'
    });
  } catch (err) {
    console.error('Edit review error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * DELETE /api/reviews/:id — Delete review
 */
exports.deleteReview = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId;
    const userRole = req.headers['x-user-role'];
    if (!userId) {
      return res.sendError('UNAUTHORIZED', 401);
    }

    const user = await resolveUser(userId);
    const userIds = [String(userId)];
    if (user) {
      userIds.push(user._id.toString());
      if (user.googleId) userIds.push(user.googleId);
    }

    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) {
      return res.sendError('NOT_FOUND', 404, 'Review not found');
    }

    const isModerator = userRole === 'moderator';
    const isOwner = userIds.includes(review.userId);
    const timeSinceCreation = Date.now() - new Date(review.createdAt).getTime();
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
    const summary = await getReviewsSummary({ busId });
    res.json({
      success: true,
      busId,
      ...summary,
    });
  } catch (err) {
    console.error('Get bus reviews error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * GET /api/reviews/route/:routeId — Get reviews for a route (public)
 */
exports.getRouteReviews = async (req, res) => {
  try {
    const { routeId } = req.params;
    const summary = await getReviewsSummary({
      $or: [{ routeId }, { busId: routeId }]
    });
    res.json({
      success: true,
      routeId,
      ...summary,
    });
  } catch (err) {
    console.error('Get route reviews error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * GET /api/reviews/booking/:bookingId — Get review for a specific booking
 */
exports.getBookingReview = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const review = await Review.findOne({ bookingId }).lean();
    res.json({
      success: true,
      review: review || null,
    });
  } catch (err) {
    console.error('Get booking review error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * POST /api/reviews/:id/helpful — Mark review as helpful (upvote)
 */
exports.markHelpful = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId;
    if (!userId) {
      return res.sendError('UNAUTHORIZED', 401, 'Please sign in to upvote');
    }

    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) {
      return res.sendError('NOT_FOUND', 404, 'Review not found');
    }

    const uidStr = String(userId);
    const index = review.helpful.indexOf(uidStr);
    if (index === -1) {
      // Add upvote
      review.helpful.push(uidStr);
    } else {
      // Toggle upvote off
      review.helpful.splice(index, 1);
    }

    await review.save();

    res.json({
      success: true,
      helpfulCount: review.helpful.length,
      hasMarkedHelpful: review.helpful.includes(uidStr),
    });
  } catch (err) {
    console.error('Mark helpful error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * POST /api/reviews/:id/report — Report review
 * If reported multiple times, automatically hide the review and remove from averages
 */
exports.reportReview = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId;
    if (!userId) {
      return res.sendError('UNAUTHORIZED', 401, 'Please sign in to report');
    }

    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) {
      return res.sendError('NOT_FOUND', 404, 'Review not found');
    }

    const uidStr = String(userId);
    if (!review.reported.includes(uidStr)) {
      review.reported.push(uidStr);
      // Auto-hide when reported multiple times (>= 2 reports)
      if (review.reported.length >= 2) {
        review.hidden = true;
      }
      await review.save();
    }

    res.json({
      success: true,
      reportedCount: review.reported.length,
      hidden: review.hidden,
      message: 'Review reported successfully. Thank you for maintaining community standards.',
    });
  } catch (err) {
    console.error('Report review error:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

/**
 * POST /api/reviews/:id/moderate — Hide/unhide review (moderator only)
 */
exports.moderateReview = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId;
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

    const review = await Review.findById(id);
    if (!review) {
      return res.sendError('NOT_FOUND', 404, 'Review not found');
    }

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
