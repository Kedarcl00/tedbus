const {
  getLocalizedTemplate,
  isSmtpConfigured,
  isWebPushConfigured,
  createNotification,
  TEMPLATES,
} = require('./notification-helper');
const Notification = require('../models/notification');
const User = require('../models/User');

jest.mock('../models/notification');
jest.mock('../models/User');
jest.mock('../workers/notificationWorker', () => ({
  dispatch: jest.fn().mockResolvedValue({ success: true }),
}));

describe('Notification Helper & Localization Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Localization Templates', () => {
    const params = {
      bookingReference: 'TB-12345',
      refundAmount: 750,
      newTime: '10:30 PM',
      source: 'Mumbai',
      destination: 'Pune',
      departureTime: '08:00 AM',
      promoCode: 'FESTIVE25',
      discount: 25,
    };

    test('should provide localized template for BOOKING_CONFIRMED in en, hi, mr', () => {
      const en = getLocalizedTemplate('BOOKING_CONFIRMED', 'en', params);
      expect(en.title).toBe('Booking Confirmed');
      expect(en.body).toContain('TB-12345');

      const hi = getLocalizedTemplate('BOOKING_CONFIRMED', 'hi', params);
      expect(hi.title).toBe('बुकिंग की पुष्टि हुई');
      expect(hi.body).toContain('TB-12345');

      const mr = getLocalizedTemplate('BOOKING_CONFIRMED', 'mr', params);
      expect(mr.title).toBe('बुकिंग पुष्टी झाली');
      expect(mr.body).toContain('TB-12345');
    });

    test('should provide localized template for BOOKING_CANCELLED in en, hi, mr', () => {
      const en = getLocalizedTemplate('BOOKING_CANCELLED', 'en', params);
      expect(en.body).toContain('₹750');

      const hi = getLocalizedTemplate('BOOKING_CANCELLED', 'hi', params);
      expect(hi.body).toContain('₹750');

      const mr = getLocalizedTemplate('BOOKING_CANCELLED', 'mr', params);
      expect(mr.body).toContain('₹750');
    });

    test('should provide localized template for SCHEDULE_CHANGE', () => {
      const en = getLocalizedTemplate('SCHEDULE_CHANGE', 'en', params);
      expect(en.body).toContain('10:30 PM');

      const hi = getLocalizedTemplate('SCHEDULE_CHANGE', 'hi', params);
      expect(hi.body).toContain('10:30 PM');

      const mr = getLocalizedTemplate('SCHEDULE_CHANGE', 'mr', params);
      expect(mr.body).toContain('10:30 PM');
    });

    test('should provide localized template for JOURNEY_REMINDER', () => {
      const en = getLocalizedTemplate('JOURNEY_REMINDER', 'en', params);
      expect(en.body).toContain('Mumbai');
      expect(en.body).toContain('Pune');
      expect(en.body).toContain('08:00 AM');
    });

    test('should provide localized template for PROMOTIONAL_OFFER', () => {
      const en = getLocalizedTemplate('PROMOTIONAL_OFFER', 'en', params);
      expect(en.body).toContain('FESTIVE25');
      expect(en.body).toContain('25%');
    });

    test('should fallback to en for unsupported language', () => {
      const result = getLocalizedTemplate('BOOKING_CONFIRMED', 'fr', params);
      expect(result.language).toBe('en');
      expect(result.title).toBe('Booking Confirmed');
    });
  });

  describe('Preferences & Dispatch Logic', () => {
    test('should skip promotional notification if user opted out', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        googleId: 'g123',
        email: 'user@example.com',
        preferredLanguage: 'en',
        notificationPreferences: {
          inApp: true,
          email: true,
          push: false,
          promotional: false,
        },
      };

      User.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUser),
        }),
      });

      const res = await createNotification(
        mockUser._id,
        'PROMOTIONAL_OFFER',
        null,
        null,
        ['in-app'],
        { promoCode: 'SAVE10', discount: 10 }
      );

      expect(res).toEqual([]);
      expect(Notification.create).not.toHaveBeenCalled();
    });

    test('should create in-app notification with delivered status when opted in', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        googleId: 'g123',
        email: 'user@example.com',
        preferredLanguage: 'hi',
        notificationPreferences: {
          inApp: true,
          email: true,
          push: false,
          promotional: true,
        },
      };

      User.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUser),
        }),
      });

      Notification.create.mockImplementation((doc) => Promise.resolve({ ...doc, _id: 'notif001' }));

      const res = await createNotification(
        mockUser._id,
        'JOURNEY_REMINDER',
        null,
        null,
        ['in-app'],
        { bookingReference: 'TB-999', source: 'Pune', destination: 'Goa', departureTime: '06:00 AM' }
      );

      expect(res.length).toBe(1);
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser._id,
          channel: 'in-app',
          type: 'JOURNEY_REMINDER',
          language: 'hi',
          status: 'delivered',
          delivered: true,
        })
      );
    });
  });

  describe('Configuration checks', () => {
    test('isSmtpConfigured checks environment variables', () => {
      const origEnv = { ...process.env };
      delete process.env.SMTP_HOST;
      expect(isSmtpConfigured()).toBe(false);

      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'test@test.com';
      process.env.SMTP_PASS = 'pass123';
      expect(isSmtpConfigured()).toBe(true);

      process.env = origEnv;
    });

    test('isWebPushConfigured checks VAPID keys', () => {
      const origEnv = { ...process.env };
      process.env.VAPID_PUBLIC_KEY = 'your_vapid_public_key_here';
      expect(isWebPushConfigured()).toBe(false);

      process.env.VAPID_PUBLIC_KEY = 'real-key';
      process.env.VAPID_PRIVATE_KEY = 'real-priv';
      process.env.VAPID_SUBJECT = 'mailto:admin@tedbus.com';
      expect(isWebPushConfigured()).toBe(true);

      process.env = origEnv;
    });
  });
});
