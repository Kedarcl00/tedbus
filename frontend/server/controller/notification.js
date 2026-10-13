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

// GET /api/v1/notifications/preferences?userId=xxx  — get user notification preferences
exports.getPreferences = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.sendError('UNAUTHORIZED', 401);
    
    const User = require('../models/User');
    const user = await User.findById(userId).select('notificationPreferences').lean().exec();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const prefs = user.notificationPreferences || { email: true, push: false, inApp: true };
    res.json(prefs);
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// PUT /api/v1/notifications/preferences — update user notification preferences
exports.savePreferences = async (req, res) => {
  try {
    const { userId, email, push, inApp } = req.body;
    if (!userId) return res.sendError('UNAUTHORIZED', 401);
    
    const User = require('../models/User');
    const preferences = {};
    if (typeof email === 'boolean') preferences.email = email;
    if (typeof push === 'boolean') preferences.push = push;
    if (typeof inApp === 'boolean') preferences.inApp = inApp;
    
    await User.findByIdAndUpdate(userId, {
      notificationPreferences: preferences
    });
    
    res.json({ success: true, preferences });
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};
