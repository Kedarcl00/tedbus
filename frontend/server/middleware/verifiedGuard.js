/**
 * VerifiedGuard — middleware that restricts post/comment creation
 * to users who have at least one completed booking (verified travellers).
 *
 * Expects req.body.userId or req.query.userId to identify the caller.
 * Uses the Booking model to confirm journey status.
 */
const Booking = require('../models/booking');
const User = require('../models/User');

module.exports = async function verifiedGuard(req, res, next) {
  const userId = req.body?.userId || req.query?.userId || req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 }
    });
  }

  try {
    // Resolve user by Google ID or ObjectId
    let userObjId = userId;
    let userEmail = null;
    const isObjectId = typeof userId === 'string' && /^[0-9a-fA-F]{24}$/.test(userId);

    const user = await User.findOne({
      $or: [
        { googleId: userId },
        ...(isObjectId ? [{ _id: userId }] : [])
      ]
    }).select('_id email').lean().exec();

    if (user) {
      userObjId = user._id;
      userEmail = user.email;
      req.verifiedUser = user;
    }

    const query = {
      $or: [
        { customerId: userObjId },
        { customerId: userId },
        ...(userEmail ? [{ email: userEmail }] : [])
      ]
    };

    const verified = await Booking.exists(query);
    if (!verified) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'JOURNEY_REQUIRED',
          message: 'Only verified travellers with at least one completed booking can post or comment.',
          statusCode: 403
        }
      });
    }

    next();
  } catch (err) {
    console.error('VerifiedGuard error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error', statusCode: 500 }
    });
  }
};
