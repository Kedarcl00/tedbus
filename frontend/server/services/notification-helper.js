/**
 * Notification Helper Service
 * Creates and dispatches notifications across multiple channels
 * with localization (en, hi, mr), preference filtering, and delivery status tracking.
 */
const mongoose = require('mongoose');
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
 * Multi-language message templates for key events
 */
const TEMPLATES = {
  BOOKING_CONFIRMED: {
    en: {
      title: 'Booking Confirmed',
      body: (p) => `Your booking ${p.bookingReference || ''} has been confirmed successfully.`,
    },
    hi: {
      title: 'बुकिंग की पुष्टि हुई',
      body: (p) => `आपकी बुकिंग ${p.bookingReference || ''} सफलतापूर्वक निश्चित हो गई है।`,
    },
    mr: {
      title: 'बुकिंग पुष्टी झाली',
      body: (p) => `तुमची बुकिंग ${p.bookingReference || ''} यशस्वीरित्या निश्चित झाली आहे.`,
    },
  },
  BOOKING_CANCELLED: {
    en: {
      title: 'Booking Cancelled',
      body: (p) => `Your booking ${p.bookingReference || ''} has been cancelled. Refund of ₹${p.refundAmount || 0} will be processed within 5-7 business days.`,
    },
    hi: {
      title: 'बुकिंग रद्द की गई',
      body: (p) => `आपकी बुकिंग ${p.bookingReference || ''} रद्द कर दी गई है। ₹${p.refundAmount || 0} का रिफंड 5-7 कार्य दिवसों में प्रोसेस होगा।`,
    },
    mr: {
      title: 'बुकिंग रद्द केली',
      body: (p) => `तुमची बुकिंग ${p.bookingReference || ''} रद्द करण्यात आली आहे. ₹${p.refundAmount || 0} चा परतावा 5-7 कामकाजाच्या दिवसांत जमा केला जाईल.`,
    },
  },
  SCHEDULE_CHANGE: {
    en: {
      title: 'Schedule Update',
      body: (p) => `Important: The departure time for booking ${p.bookingReference || ''} has changed to ${p.newTime || 'the updated schedule'}.`,
    },
    hi: {
      title: 'समय सारणी में बदलाव',
      body: (p) => `महत्वपूर्ण: बुकिंग ${p.bookingReference || ''} के लिए प्रस्थान समय बदलकर ${p.newTime || 'नया समय'} हो गया है।`,
    },
    mr: {
      title: 'वेळापत्रकात बदल',
      body: (p) => `महत्त्वाचे: बुकिंग ${p.bookingReference || ''} ची प्रस्थान वेळ बदलून ${p.newTime || 'नवीन वेळ'} झाली आहे.`,
    },
  },
  JOURNEY_REMINDER: {
    en: {
      title: 'Upcoming Journey Reminder',
      body: (p) => `Reminder: Your journey for booking ${p.bookingReference || ''} from ${p.source || 'origin'} to ${p.destination || 'destination'} departs at ${p.departureTime || 'scheduled time'}.`,
    },
    hi: {
      title: 'आगामी यात्रा अनुस्मारक',
      body: (p) => `अनुस्मारक: ${p.source || 'प्रस्थान स्थल'} से ${p.destination || 'गंतव्य'} तक आपकी बुकिंग ${p.bookingReference || ''} की यात्रा ${p.departureTime || 'नियत समय'} पर शुरू होगी।`,
    },
    mr: {
      title: 'प्रवासाची आठवण',
      body: (p) => `आठवण: ${p.source || 'सुरुवात'} ते ${p.destination || 'गंतव्य'} साठी तुमची बुकिंग ${p.bookingReference || ''} ${p.departureTime || 'नियोजित वेळ'} वाजता प्रस्थान करेल.`,
    },
  },
  PROMOTIONAL_OFFER: {
    en: {
      title: 'Special Travel Offer',
      body: (p) => `Exclusive discount! Use code ${p.promoCode || 'TEDBUS'} to get ${p.discount || '15'}% off on your next bus journey.`,
    },
    hi: {
      title: 'विशेष यात्रा ऑफर',
      body: (p) => `विशेष छूट! अपनी अगली बस यात्रा पर ${p.discount || '15'}% छूट पाने के लिए ${p.promoCode || 'TEDBUS'} कोड का उपयोग करें।`,
    },
    mr: {
      title: 'खास प्रवास ऑफर',
      body: (p) => `विशेष सवलत! तुमच्या पुढील बस प्रवासावर ${p.discount || '15'}% सवलतीसाठी ${p.promoCode || 'TEDBUS'} कोड वापरा.`,
    },
  },
};

/**
 * Get localized title and body for an event type
 */
function getLocalizedTemplate(type, lang = 'en', params = {}) {
  const eventTemplates = TEMPLATES[type];
  if (!eventTemplates) return null;

  const validLang = ['en', 'hi', 'mr'].includes(lang) ? lang : 'en';
  const tmpl = eventTemplates[validLang] || eventTemplates['en'];

  return {
    title: tmpl.title,
    body: typeof tmpl.body === 'function' ? tmpl.body(params) : tmpl.body,
    language: validLang,
  };
}

/**
 * Helper to resolve user by ObjectId or GoogleId
 */
async function resolveUser(userId) {
  if (!userId) return null;
  const isObjectId = mongoose.Types.ObjectId.isValid(userId) && String(new mongoose.Types.ObjectId(userId)) === String(userId);
  return User.findOne({
    $or: [
      { googleId: String(userId) },
      ...(isObjectId ? [{ _id: userId }] : []),
    ],
  }).lean().exec();
}

/**
 * Create and dispatch notifications for a user across multiple channels
 * @param {String} userId - User's ObjectId or Google ID
 * @param {String} type - Notification type (e.g., 'BOOKING_CONFIRMED', 'SCHEDULE_CHANGE')
 * @param {String} title - Notification title (optional fallback)
 * @param {String} body - Notification body text (optional fallback)
 * @param {Array<String>} channels - Array of channels: 'in-app', 'email', 'push'
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Array>} Array of created notifications
 */
async function createNotification(userId, type, title, body, channels = ['in-app'], metadata = {}) {
  try {
    const user = await resolveUser(userId);
    if (!user) {
      console.warn(`User ${userId} not found, skipping notifications`);
      return [];
    }

    const prefs = user.notificationPreferences || { email: true, push: false, inApp: true, promotional: true };
    const userEmail = user.email;
    const userLang = metadata.language || user.preferredLanguage || 'en';

    // If type has a localized template, use it unless custom title/body were provided
    const localized = getLocalizedTemplate(type, userLang, metadata);
    const finalTitle = localized?.title || title || 'TedBus Notification';
    const finalBody = localized?.body || body || '';
    const finalLang = localized?.language || userLang;

    // Check promotional opt-in/opt-out
    if (type === 'PROMOTIONAL_OFFER' && prefs.promotional === false) {
      console.log(`Skipping promotional notification for user ${userId}: user opted out`);
      return [];
    }

    const notifications = [];

    for (const channel of channels) {
      let shouldCreate = false;
      let skipReason = null;

      if (channel === 'in-app') {
        shouldCreate = prefs.inApp !== false;
        if (!shouldCreate) skipReason = 'User has disabled in-app notifications in preferences';
      } else if (channel === 'email') {
        if (!prefs.email) {
          skipReason = 'User has disabled email notifications in preferences';
        } else if (!isSmtpConfigured()) {
          skipReason = 'SMTP not configured (missing SMTP credentials)';
        } else {
          shouldCreate = true;
        }
      } else if (channel === 'push') {
        if (!prefs.push) {
          skipReason = 'User has disabled push notifications in preferences';
        } else if (!isWebPushConfigured()) {
          skipReason = 'Web-push not configured (missing VAPID credentials)';
        } else {
          shouldCreate = true;
        }
      }

      if (skipReason) {
        console.warn(`Skipping ${channel} notification for user ${userId}: ${skipReason}`);
        continue;
      }

      if (shouldCreate) {
        const notificationMetadata = { ...metadata };
        if (channel === 'email') {
          notificationMetadata.email = userEmail;
        }

        const isInApp = channel === 'in-app';

        const notification = await Notification.create({
          userId: user._id.toString(),
          channel,
          type,
          title: finalTitle,
          body: finalBody,
          language: finalLang,
          status: isInApp ? 'delivered' : 'pending',
          delivered: isInApp,
          deliveredAt: isInApp ? new Date() : null,
          metadata: notificationMetadata,
        });

        notifications.push(notification);

        // For email and push, dispatch asynchronously with retries
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

/**
 * Event-specific notification helpers
 */
async function sendBookingConfirmation(userId, bookingData, channels = ['in-app', 'email']) {
  return createNotification(
    userId,
    'BOOKING_CONFIRMED',
    null,
    null,
    channels,
    bookingData
  );
}

async function sendBookingCancellation(userId, bookingData, channels = ['in-app', 'email']) {
  return createNotification(
    userId,
    'BOOKING_CANCELLED',
    null,
    null,
    channels,
    bookingData
  );
}

async function sendScheduleChange(userId, changeData, channels = ['in-app', 'email', 'push']) {
  return createNotification(
    userId,
    'SCHEDULE_CHANGE',
    null,
    null,
    channels,
    changeData
  );
}

async function sendJourneyReminder(userId, reminderData, channels = ['in-app', 'email', 'push']) {
  return createNotification(
    userId,
    'JOURNEY_REMINDER',
    null,
    null,
    channels,
    reminderData
  );
}

async function sendPromotionalOffer(userId, promoData, channels = ['in-app', 'email']) {
  return createNotification(
    userId,
    'PROMOTIONAL_OFFER',
    null,
    null,
    channels,
    promoData
  );
}

module.exports = {
  createNotification,
  getLocalizedTemplate,
  isSmtpConfigured,
  isWebPushConfigured,
  sendBookingConfirmation,
  sendBookingCancellation,
  sendScheduleChange,
  sendJourneyReminder,
  sendPromotionalOffer,
  TEMPLATES,
};
