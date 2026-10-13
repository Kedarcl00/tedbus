# Notification System Configuration

## Overview

The TedBus notification system supports three delivery channels:
- **In-App Notifications**: Always available, stored in MongoDB and displayed in the notification drawer
- **Email Notifications**: Requires SMTP server configuration
- **Push Notifications**: Requires Web Push (VAPID) configuration

## Environment Variables

To enable email and push notifications, add the following environment variables to your `.env` file in the `frontend/server/` directory:

### SMTP Configuration (Email Notifications)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Gmail Setup:**
1. Enable 2-factor authentication on your Google account
2. Generate an App Password at https://myaccount.google.com/apppasswords
3. Use the generated App Password (not your regular password) for `SMTP_PASS`

**Other SMTP Providers:**
- **SendGrid**: Use `smtp.sendgrid.net` (port 587) with API key as password
- **Mailgun**: Use `smtp.mailgun.org` (port 587) with Mailgun credentials
- **AWS SES**: Use your region endpoint (e.g., `email-smtp.us-east-1.amazonaws.com`)

### Web Push Configuration (Push Notifications)

```env
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:your-email@example.com
```

**Generate VAPID Keys:**

```bash
# Install web-push CLI globally
npm install -g web-push

# Generate VAPID key pair
web-push generate-vapid-keys

# Output example:
# Public Key: BEl62iUYgUivxIkv69yViEuiBIa-Ib27SztkGJwRYeHd...
# Private Key: kD2UvI9gq4rZ3nNF-RZ8qh2GxYQT9LmQi5K3pR6tSzM...
```

Copy the generated keys to your `.env` file.

## Graceful Degradation

The notification system is designed to work without external configuration:

- **In-App notifications** always work and are stored in MongoDB
- **Email notifications** are skipped if SMTP is not configured (warning logged)
- **Push notifications** are skipped if VAPID keys are not configured (warning logged)

This allows you to:
1. Start development immediately with in-app notifications
2. Add email/push support later without code changes
3. Run the app in environments where SMTP/push are unavailable

## Testing Notifications

### 1. Test In-App Notifications (No Configuration Required)

```bash
# Start MongoDB
mongod

# Start backend
cd frontend/server
npm start

# Start frontend
cd frontend
npm start

# Sign in and complete a booking
# Notification will appear in the bell icon dropdown
```

### 2. Test Email Notifications (SMTP Required)

Add SMTP configuration to `.env`, restart the backend, and complete a booking. Check the configured email inbox.

### 3. Test Push Notifications (VAPID + Service Worker Required)

1. Add VAPID configuration to `.env`
2. Implement service worker registration in the frontend
3. Request notification permission from the user
4. Subscribe to push notifications with the VAPID public key
5. Complete a booking to trigger a push notification

## User Notification Preferences

Users can control which channels they receive notifications on:

**Default Preferences:**
```json
{
  "email": true,
  "push": false,
  "inApp": true
}
```

**API Endpoints:**
- `GET /api/v1/notifications/preferences?userId=<userId>` - Get user preferences
- `PUT /api/v1/notifications/preferences` - Update preferences

```bash
# Example: Disable email notifications for a user
curl -X PUT http://localhost:5001/api/v1/notifications/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "60a7f8b3c5d4e1234567890a",
    "email": false,
    "push": false,
    "inApp": true
  }'
```

## Notification Types

The system supports the following notification types:

- `BOOKING_CONFIRMED` - Sent when a booking is successfully created
- `BOOKING_CANCELLED` - Sent when a booking is cancelled (when cancellation feature is implemented)
- `GENERAL` - General purpose notifications

## Troubleshooting

### Email Notifications Not Sending

1. Check `.env` file has all SMTP variables set
2. Verify SMTP credentials are correct
3. For Gmail, ensure App Password is used (not regular password)
4. Check backend logs for SMTP connection errors
5. Verify firewall allows outbound connections on SMTP port

### Push Notifications Not Working

1. Verify VAPID keys are correctly set in `.env`
2. Ensure VAPID public key matches the one used in frontend
3. Check browser console for service worker registration errors
4. Verify user has granted notification permission
5. Test in a browser that supports Web Push (Chrome, Firefox, Edge)

### In-App Notifications Not Appearing

1. Verify MongoDB is running and connected
2. Check notification routes are registered in `index.js`
3. Inspect browser console for API errors
4. Verify user is authenticated and `X-User-Id` header is set
5. Check notification count badge in navbar

## Security Notes

- Never commit `.env` file to version control
- Keep VAPID private key secret
- Use App Passwords for Gmail (never your main password)
- Rotate SMTP credentials periodically
- Consider rate limiting notification endpoints in production

## Production Deployment

For production environments:

1. Set all environment variables in your hosting platform (Heroku, AWS, etc.)
2. Use a dedicated SMTP service (SendGrid, Mailgun, AWS SES)
3. Enable HTTPS for push notification support
4. Monitor notification delivery rates
5. Implement retry logic for failed deliveries (already included in `notificationWorker.js`)
6. Consider using a message queue (Redis, RabbitMQ) for high-volume notifications

## Support

For issues or questions about the notification system:
- Check backend logs: `frontend/server/logs/` (if configured)
- Review notification worker: `frontend/server/workers/notificationWorker.js`
- Inspect notification helper: `frontend/server/services/notification-helper.js`
- Verify notification model: `frontend/server/models/notification.js`
