/**
 * Notification delivery worker.
 * Supports email (nodemailer) and push (web-push) channels
 * with exponential-backoff retries (up to maxRetries attempts).
 *
 * Usage:
 *   const { dispatch } = require('./workers/notificationWorker');
 *   await dispatch(notificationDoc);
 */
require('dotenv').config();
const nodemailer = require('nodemailer');
const webpush    = require('web-push');
const Notification = require('../models/notification');

// ── Nodemailer transport ────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Web-push VAPID ──────────────────────────────────────────────────────────
if (
  process.env.VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_PUBLIC_KEY !== 'your_vapid_public_key_here'
) {
  webpush.setVapidDetails(
    `mailto:${process.env.SMTP_USER}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function sendEmail(notification) {
  await transporter.sendMail({
    from:    process.env.SMTP_USER,
    to:      notification.metadata?.email || process.env.SMTP_USER,
    subject: notification.title,
    text:    notification.body,
    html:    `<p>${notification.body}</p>`,
  });
}

async function sendPush(notification) {
  const sub = notification.metadata?.pushSubscription;
  if (!sub) throw new Error('No push subscription in notification metadata');
  await webpush.sendNotification(sub, JSON.stringify({
    title: notification.title,
    body:  notification.body,
  }));
}

// ── Main dispatch with exponential backoff ───────────────────────────────────
async function dispatch(notification) {
  const maxRetries = notification.maxRetries ?? 3;

  // In-app notifications do not require network transport
  if (notification.channel === 'in-app') {
    await Notification.findByIdAndUpdate(notification._id, {
      status:      'delivered',
      delivered:   true,
      deliveredAt: new Date(),
      retryCount:  0,
      failureReason: null,
    });
    return { success: true, attempts: 1 };
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (notification.channel === 'email') {
        await sendEmail(notification);
      } else if (notification.channel === 'push') {
        await sendPush(notification);
      }
      // Mark delivered
      await Notification.findByIdAndUpdate(notification._id, {
        status:        'delivered',
        delivered:     true,
        deliveredAt:   new Date(),
        retryCount:    attempt,
        failureReason: null,
      });
      return { success: true, attempts: attempt + 1 };
    } catch (err) {
      console.error(`Notification attempt ${attempt + 1} failed:`, err.message);
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s (faster in test)
        const baseDelay = process.env.NODE_ENV === 'test' ? 10 : 1000;
        await delay(baseDelay * Math.pow(2, attempt));
      } else {
        await Notification.findByIdAndUpdate(notification._id, {
          status:        'failed',
          delivered:     false,
          retryCount:    attempt + 1,
          failureReason: err.message,
        });
        return { success: false, attempts: attempt + 1, error: err.message };
      }
    }
  }
}

async function retryDispatch(notificationId) {
  const notification = await Notification.findById(notificationId);
  if (!notification) throw new Error('Notification not found');
  await Notification.findByIdAndUpdate(notificationId, {
    status: 'pending',
    failureReason: null,
  });
  return dispatch(notification);
}

module.exports = { dispatch, retryDispatch };

