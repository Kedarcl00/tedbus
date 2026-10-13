const Notification = require('../models/notification');
const { dispatch }  = require('../workers/notificationWorker');

// GET /api/v1/notifications?userId=xxx
exports.getNotifications = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.sendError('UNAUTHORIZED', 401);
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// POST /api/v1/notifications  — create & dispatch a notification
exports.createNotification = async (req, res) => {
  try {
    const { userId, channel, type, title, body, metadata } = req.body;
    if (!userId || !channel || !title || !body) {
      return res.sendError('VALIDATION', 400);
    }
    const notification = await Notification.create({
      userId, channel, type: type || 'GENERAL', title, body, metadata: metadata || {},
    });
    // fire-and-forget delivery
    dispatch(notification).catch(err =>
      console.error('Background dispatch error:', err.message)
    );
    res.status(201).json(notification);
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// PATCH /api/v1/notifications/read  — mark all read for userId
exports.markAllRead = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.sendError('UNAUTHORIZED', 401);
    await Notification.updateMany({ userId, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// GET /api/v1/notifications/preferences?userId=xxx  — stub for channel prefs
exports.getPreferences = async (req, res) => {
  // In a full implementation these would be stored on the Customer doc.
  // For now return sensible defaults.
  res.json({ email: true, push: false, inApp: true });
};

// PUT /api/v1/notifications/preferences
exports.savePreferences = async (req, res) => {
  // Preferences would be saved on Customer; stub response for now.
  res.json({ success: true, preferences: req.body });
};
