const { dispatch, retryDispatch } = require('./notificationWorker');
const Notification = require('../models/notification');

jest.mock('../models/notification');
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn(),
  }),
}));
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('Notification Worker Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle in-app notification immediately and set status to delivered', async () => {
    const mockNotif = {
      _id: 'notif123',
      channel: 'in-app',
      maxRetries: 3,
    };

    Notification.findByIdAndUpdate.mockResolvedValue({});

    const result = await dispatch(mockNotif);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(Notification.findByIdAndUpdate).toHaveBeenCalledWith(
      'notif123',
      expect.objectContaining({
        status: 'delivered',
        delivered: true,
        retryCount: 0,
      })
    );
  });

  test('should deliver email successfully and mark delivered', async () => {
    const nodemailer = require('nodemailer');
    const mockTransport = nodemailer.createTransport();
    mockTransport.sendMail.mockResolvedValue({ messageId: 'msg-1' });

    const mockNotif = {
      _id: 'notif456',
      channel: 'email',
      title: 'Booking Confirmed',
      body: 'Your ticket is confirmed',
      metadata: { email: 'passenger@example.com' },
      maxRetries: 1,
    };

    Notification.findByIdAndUpdate.mockResolvedValue({});

    const result = await dispatch(mockNotif);

    expect(result.success).toBe(true);
    expect(Notification.findByIdAndUpdate).toHaveBeenCalledWith(
      'notif456',
      expect.objectContaining({
        status: 'delivered',
        delivered: true,
      })
    );
  });

  test('should retry failed email with backoff and mark status as failed when max retries exceeded', async () => {
    const nodemailer = require('nodemailer');
    const mockTransport = nodemailer.createTransport();
    mockTransport.sendMail.mockRejectedValue(new Error('SMTP Connection Refused'));

    const mockNotif = {
      _id: 'notif789',
      channel: 'email',
      title: 'Test',
      body: 'Test body',
      metadata: { email: 'fail@example.com' },
      maxRetries: 1, // 0 and 1 -> 2 attempts total
    };

    Notification.findByIdAndUpdate.mockResolvedValue({});

    const result = await dispatch(mockNotif);

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMTP Connection Refused');
    expect(Notification.findByIdAndUpdate).toHaveBeenCalledWith(
      'notif789',
      expect.objectContaining({
        status: 'failed',
        delivered: false,
        failureReason: 'SMTP Connection Refused',
      })
    );
  });
});
