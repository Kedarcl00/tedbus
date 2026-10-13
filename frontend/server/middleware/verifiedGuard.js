/**
 * VerifiedGuard — middleware that restricts post/comment creation
 * to users who have at least one completed booking (verified travellers).
 *
 * Expects req.body.userId or req.query.userId to identify the caller.
 * Uses the Booking model to confirm journey status.
 */
const Booking = require('../models/booking');

module.exports = async function verifiedGuard(req, res, next) {
  const userId = req.body?.userId || req.query?.userId;
  if (!userId) return res.sendError('UNAUTHORIZED', 401);

  try {
    const verified = await Booking.exists({ customerId: userId });
    if (!verified) return res.sendError('JOURNEY_REQUIRED', 403);
    next();
  } catch (err) {
    console.error('VerifiedGuard error:', err.message);
    res.sendError('SERVER_ERROR', 500);
  }
};
