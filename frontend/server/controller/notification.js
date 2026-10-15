const mongoose = require('mongoose');
const Notification = require('../models/notification');
const User = require('../models/User');
const { dispatch, retryDispatch } = require('../workers/notificationWorker');
const {
  createNotification: createHelperNotification,
  sendBookingConfirmation,
  sendBookingCancellation,
  sendScheduleChange,
  sendJourneyReminder,
  sendPromotionalOffer,
} = require('../services/notification-helper');

/**
 * Resolve user by ObjectId or Google ID
 */
async function resolveUser(userId) {
  if (!userId) return null;
  const isObjectId = mongoose.Types.ObjectId.isValid(userId) && String(new mongoose.Types.ObjectId(userId)) === String(userId);
  return User.findOne({
    $or: [
      { googleId: String(userId) },
      ...(isObjectId ? [{ _id: userId }] : []),
    ],
  });
}

// GET /api/v1/notifications?userId=xxx&type=xxx&channel=xxx&status=xxx
exports.getNotifications = async (req, res) => {
  try {
    const { userId, type, channel, status, limit = 50 } = req.query;
    if (!userId) return res.sendError('UNAUTHORIZED', 401);

    const user = await resolveUser(userId);
    const userIds = [String(userId)];
    if (user) {
      userIds.push(user._id.toString());
      if (user.googleId) userIds.push(user.googleId);
    }

    const query = { userId: { $in: [...new Set(userIds)] } };
    if (type) query.type = type;
    if (channel) query.channel = channel;
    if (status) query.status = status;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// POST /api/v1/notifications — create & dispatch a notification
exports.createNotification = async (req, res) => {
  try {
    const { userId, channel = 'in-app', type = 'GENERAL', title, body, metadata = {} } = req.body;
    if (!userId || !title || !body) {
      return res.sendError('VALIDATION', 400);
    }

    const createdList = await createHelperNotification(
      userId,
      type,
      title,
      body,
      Array.isArray(channel) ? channel : [channel],
      metadata
    );

    res.status(201).json(createdList[0] || { message: 'Notification processed' });
  } catch (err) {
    console.error('Error creating notification:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// PATCH /api/v1/notifications/read — mark all read for userId
exports.markAllRead = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.sendError('UNAUTHORIZED', 401);

    const user = await resolveUser(userId);
    const userIds = [String(userId)];
    if (user) {
      userIds.push(user._id.toString());
      if (user.googleId) userIds.push(user.googleId);
    }

    await Notification.updateMany(
      { userId: { $in: [...new Set(userIds)] }, read: false },
      { read: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// PATCH /api/v1/notifications/:id/read — mark single notification as read
exports.markOneRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(notification);
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// POST /api/v1/notifications/retry/:id — retry failed notification
exports.retryNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await retryDispatch(id);
    res.json(result);
  } catch (err) {
    console.error('Error retrying notification:', err);
    res.status(500).json({ error: err.message || 'Retry failed' });
  }
};

// GET /api/v1/notifications/preferences?userId=xxx — get user notification preferences
exports.getPreferences = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.sendError('UNAUTHORIZED', 401);

    const user = await resolveUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const defaultPrefs = { email: true, push: false, inApp: true, promotional: true };
    const prefs = { ...defaultPrefs, ...(user.notificationPreferences || {}) };
    res.json(prefs);
  } catch (err) {
    console.error('Error fetching preferences:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// PUT /api/v1/notifications/preferences — update user notification preferences
exports.savePreferences = async (req, res) => {
  try {
    const { userId, email, push, inApp, promotional } = req.body;
    if (!userId) return res.sendError('UNAUTHORIZED', 401);

    const user = await resolveUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingPrefs = user.notificationPreferences || { email: true, push: false, inApp: true, promotional: true };
    const preferences = { ...existingPrefs };

    if (typeof email === 'boolean') preferences.email = email;
    if (typeof push === 'boolean') preferences.push = push;
    if (typeof inApp === 'boolean') preferences.inApp = inApp;
    if (typeof promotional === 'boolean') preferences.promotional = promotional;

    user.notificationPreferences = preferences;
    await user.save();

    res.json({ success: true, preferences });
  } catch (err) {
    console.error('Error saving preferences:', err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// POST /api/v1/notifications/trigger-event — trigger key event notifications
exports.triggerEvent = async (req, res) => {
  try {
    const { userId, eventType, data = {}, channels } = req.body;
    if (!userId || !eventType) {
      return res.status(400).json({ error: 'userId and eventType are required' });
    }

    let notifications = [];
    switch (eventType) {
      case 'BOOKING_CONFIRMED':
        notifications = await sendBookingConfirmation(userId, data, channels);
        break;
      case 'BOOKING_CANCELLED':
        notifications = await sendBookingCancellation(userId, data, channels);
        break;
      case 'SCHEDULE_CHANGE':
        notifications = await sendScheduleChange(userId, data, channels);
        break;
      case 'JOURNEY_REMINDER':
        notifications = await sendJourneyReminder(userId, data, channels);
        break;
      case 'PROMOTIONAL_OFFER':
        notifications = await sendPromotionalOffer(userId, data, channels);
        break;
      default:
        notifications = await createHelperNotification(
          userId,
          eventType,
          data.title || 'Notification',
          data.body || '',
          channels || ['in-app'],
          data
        );
        break;
    }

    res.json({ success: true, notifications });
  } catch (err) {
    console.error('Error triggering event notification:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
};
