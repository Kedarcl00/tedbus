/**
 * NotificationService
 * Manages sending notifications via email and in-app channels
 */

const Notification = require('../models/notification');
const { EmailError } = require('../utils/custom-errors');

class NotificationService {
  /**
   * Send booking confirmation email
   * @param {Object} booking - Booking object
   * @param {Object} customer - Customer object
   * @returns {Promise<void>}
   */
  async sendBookingConfirmation(booking, customer) {
    try {
      // Log to console in development (mock SMTP)
      console.log(`[NOTIFICATION] Sending booking confirmation to ${customer.email}`);
      console.log(`  Booking Reference: ${booking.reference || booking._id}`);
      console.log(`  Fare: ${booking.fare}`);

      // Create notification record
      await this.queueNotification({
        userId: booking.customerId,
        type: 'booking_confirmation',
        title: 'Booking Confirmation',
        message: `Your booking has been confirmed. Reference: ${booking.reference || booking._id}`,
        data: {
          bookingId: booking._id,
          fare: booking.fare,
        },
      });

      return Promise.resolve();
    } catch (error) {
      console.error('Error sending booking confirmation:', error);
      // Don't throw - notifications should not block booking
      return Promise.resolve();
    }
  }

  /**
   * Send cancellation notification
   * @param {Object} booking - Booking object
   * @param {Object} customer - Customer object
   * @returns {Promise<void>}
   */
  async sendCancellationNotification(booking, customer) {
    try {
      console.log(`[NOTIFICATION] Sending cancellation notification to ${customer.email}`);
      console.log(`  Booking Reference: ${booking.reference || booking._id}`);
      console.log(`  Refund Amount: ${booking.refundAmount || 0}`);

      await this.queueNotification({
        userId: booking.customerId,
        type: 'cancellation',
        title: 'Booking Cancelled',
        message: `Your booking has been cancelled. Refund: ${booking.refundAmount || 0}`,
        data: {
          bookingId: booking._id,
          refundAmount: booking.refundAmount || 0,
        },
      });

      return Promise.resolve();
    } catch (error) {
      console.error('Error sending cancellation notification:', error);
      return Promise.resolve();
    }
  }

  /**
   * Send reminder notification
   * @param {Object} booking - Booking object
   * @param {Object} customer - Customer object
   * @param {number} hoursBeforeDeparture - Hours before departure
   * @returns {Promise<void>}
   */
  async sendReminderNotification(booking, customer, hoursBeforeDeparture = 24) {
    try {
      console.log(
        `[NOTIFICATION] Sending reminder to ${customer.email} (${hoursBeforeDeparture} hours before departure)`
      );

      await this.queueNotification({
        userId: booking.customerId,
        type: 'reminder',
        title: 'Trip Reminder',
        message: `Your trip is ${hoursBeforeDeparture} hours away. Reference: ${booking.reference || booking._id}`,
        data: {
          bookingId: booking._id,
          departureTime: booking.departureDetails.time,
        },
      });

      return Promise.resolve();
    } catch (error) {
      console.error('Error sending reminder notification:', error);
      return Promise.resolve();
    }
  }

  /**
   * Queue notification for async processing
   * @param {Object} notificationPayload - Notification data
   * @returns {Promise<Object>} Created notification
   */
  async queueNotification(notificationPayload) {
    try {
      const notification = await Notification.create({
        userId: notificationPayload.userId,
        type: notificationPayload.type,
        title: notificationPayload.title,
        message: notificationPayload.message,
        data: notificationPayload.data || {},
        read: false,
        createdAt: new Date(),
      });

      return notification;
    } catch (error) {
      console.error('Error queuing notification:', error);
      return null;
    }
  }

  /**
   * Get user notifications
   * @param {string} userId - User ID
   * @param {Object} options - Query options {limit, skip}
   * @returns {Promise<Array>} Array of notifications
   */
  async getUserNotifications(userId, options = {}) {
    const { limit = 20, skip = 0 } = options;
    try {
      const notifications = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean()
        .exec();

      return notifications;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @returns {Promise<Object>} Updated notification
   */
  async markAsRead(notificationId) {
    try {
      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        { read: true },
        { new: true }
      );
      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return null;
    }
  }
}

module.exports = new NotificationService();
