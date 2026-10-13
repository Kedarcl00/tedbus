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

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (notification.channel === 'email') {
        await sendEmail(notification);
      } else if (notification.channel === 'push') {
        await sendPush(notification);
      }
      // Mark delivered
      await Notification.findByIdAndUpdate(notification._id, {
        delivered:   true,
        deliveredAt: new Date(),
        retryCount:  attempt,
      });
      return { success: true, attempts: attempt + 1 };
    } catch (err) {
      console.error(`Notification attempt ${attempt + 1} failed:`, err.message);
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await delay(1000 * Math.pow(2, attempt));
      } else {
        await Notification.findByIdAndUpdate(notification._id, {
          retryCount: attempt + 1,
        });
        return { success: false, attempts: attempt + 1, error: err.message };
      }
    }
  }
}

module.exports = { dispatch };
