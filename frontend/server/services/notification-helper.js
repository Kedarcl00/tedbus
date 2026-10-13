/**
 * Notification Helper Service
 * Creates notifications for different channels with environment validation
 */
const Notification = require('../models/notification');
const User = require('../models/User');
const { dispatch } = require('../workers/notificationWorker');

/**
 * Check if SMTP is configured
 */
function isSmtpConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

/**
 * Check if web-push is configured
 */
function isWebPushConfigured() {
  return !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT &&
    process.env.VAPID_PUBLIC_KEY !== 'your_vapid_public_key_here'
  );
}

/**
 * Create and dispatch notifications for a user across multiple channels
 * @param {String} userId - User's ObjectId
 * @param {String} type - Notification type (e.g., 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED')
 * @param {String} title - Notification title
 * @param {String} body - Notification body text
 * @param {Array<String>} channels - Array of channels: 'in-app', 'email', 'push'
 * @param {Object} metadata - Additional metadata (e.g., bookingReference, email)
 * @returns {Promise<Array>} Array of created notifications
 */
async function createNotification(userId, type, title, body, channels = ['in-app'], metadata = {}) {
  try {
    // Fetch user to get email and notification preferences
    const user = await User.findById(userId).lean().exec();
    if (!user) {
      console.warn(`User ${userId} not found, skipping notifications`);
      return [];
    }

    const prefs = user.notificationPreferences || { email: true, push: false, inApp: true };
    const userEmail = user.email;

    const notifications = [];

    for (const channel of channels) {
      let shouldCreate = false;
      let skipReason = null;

      if (channel === 'in-app') {
        // In-app notifications always work
        shouldCreate = prefs.inApp !== false;
      } else if (channel === 'email') {
        if (!prefs.email) {
          skipReason = 'User has disabled email notifications in preferences';
        } else if (!isSmtpConfigured()) {
          skipReason = 'SMTP not configured (missing SMTP_HOST, SMTP_PORT, SMTP_USER, or SMTP_PASS)';
        } else {
          shouldCreate = true;
        }
      } else if (channel === 'push') {
        if (!prefs.push) {
          skipReason = 'User has disabled push notifications in preferences';
        } else if (!isWebPushConfigured()) {
          skipReason = 'Web-push not configured (missing VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, or VAPID_SUBJECT)';
        } else {
          shouldCreate = true;
        }
      }

      if (skipReason) {
        console.warn(`Skipping ${channel} notification for user ${userId}: ${skipReason}`);
        continue;
      }

      if (shouldCreate) {
        // Add user email to metadata for email notifications
        const notificationMetadata = { ...metadata };
        if (channel === 'email') {
          notificationMetadata.email = userEmail;
        }

        const notification = await Notification.create({
          userId: userId.toString(),
          channel,
          type,
          title,
          body,
          metadata: notificationMetadata,
        });

        notifications.push(notification);

        // For email and push, dispatch asynchronously
        if (channel === 'email' || channel === 'push') {
          dispatch(notification).catch(err =>
            console.error(`Failed to dispatch ${channel} notification:`, err.message)
          );
        }
      }
    }

    return notifications;
  } catch (error) {
    console.error('Error creating notifications:', error);
    throw error;
  }
}

module.exports = { createNotification, isSmtpConfigured, isWebPushConfigured };
