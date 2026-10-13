/**
 * Unit Tests for BookingService
 * 
 * Validates:
 * - User isolation enforcement
 * - Booking creation with state management
 * - Booking retrieval with proper filtering
 * - Cancellation with refund calculation
 * - Status transitions
 * - Error handling and validation
 */

const BookingService = require('./booking.service');
const BusService = require('./bus.service');
const NotificationService = require('./notification.service');
const Booking = require('../models/booking');
const Customer = require('../models/customer');
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  BusinessRuleError,
  InsufficientSeatsError,
} = require('../utils/custom-errors');

// Mock all dependencies
jest.mock('./bus.service');
jest.mock('./notification.service');
jest.mock('../models/booking');
jest.mock('../models/customer');

describe('BookingService', () => {
  const mockUserId = 'user123';
  const mockOtherId = 'other456';
  const mockBusId = 'bus789';
  const mockBookingId = 'booking001';

  const mockCustomer = {
    _id: mockUserId,
    name: 'John Doe',
    email: 'john@example.com',
    toObject: () => ({
      _id: mockUserId,
      name: 'John Doe',
      email: 'john@example.com',
    }),
  };

  const mockValidBookingData = {
    busId: mockBusId,
    seats: [12, 13, 14],
    fare: 150.0,
    phoneNumber: '+1234567890',
    departureDetails: {
      city: 'New York',
      time: '08:00',
      date: '2024-12-20',
    },
    arrivalDetails: {
      city: 'Boston',
      time: '14:30',
      date: '2024-12-20',
    },
    duration: '6h 30m',
    passengerDetails: [
      { name: 'John', age: 25, gender: 'Male' },
      { name: 'Jane', age: 23, gender: 'Female' },
      { name: 'Bob', age: 28, gender: 'Male' },
    ],
    paymentMethod: 'cash_on_trip',
  };

  const mockBookingResponse = {
    _id: mockBookingId,
    customerId: mockUserId,
    busId: mockBusId,
    seats: [12, 13, 14],
    fare: 150.0,
    status: 'confirmed',
    paymentMethod: 'cash_on_trip',
    departureDetails: mockValidBookingData.departureDetails,
    arrivalDetails: mockValidBookingData.arrivalDetails,
    toObject: () => ({
      _id: mockBookingId,
      customerId: mockUserId,
      busId: mockBusId,
      seats: [12, 13, 14],
      fare: 150.0,
      status: 'confirmed',
      paymentMethod: 'cash_on_trip',
      departureDetails: mockValidBookingData.departureDetails,
      arrivalDetails: mockValidBookingData.arrivalDetails,
    }),
    save: jest.fn().mockResolvedValue(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    it('should create a booking with user isolation enforcement', async () => {
      // Arrange
      Customer.findById.mockResolvedValue(mockCustomer);
      BusService.reserveSeats.mockResolvedValue({
        busId: mockBusId,
        seats: [12, 13, 14],
      });
      Booking.create.mockResolvedValue(mockBookingResponse);
      NotificationService.sendBookingConfirmation.mockResolvedValue();

      // Act
      const result = await BookingService.createBooking(mockUserId, mockValidBookingData);

      // Assert
      expect(Customer.findById).toHaveBeenCalledWith(mockUserId);
      expect(BusService.reserveSeats).toHaveBeenCalledWith(
        mockBusId,
        [12, 13, 14],
        '2024-12-20'
      );

      // Verify that customerId is set server-side (not from request)
      const createCall = Booking.create.mock.calls[0][0];
      expect(createCall.customerId).toBe(mockUserId);

      expect(NotificationService.sendBookingConfirmation).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should set status to confirmed for cash_on_trip payment', async () => {
      // Arrange
      Customer.findById.mockResolvedValue(mockCustomer);
      BusService.reserveSeats.mockResolvedValue({});
      Booking.create.mockResolvedValue(mockBookingResponse);
      NotificationService.sendBookingConfirmation.mockResolvedValue();

      // Act
      await BookingService.createBooking(mockUserId, mockValidBookingData);

      // Assert
      const createCall = Booking.create.mock.calls[0][0];
      expect(createCall.status).toBe('confirmed');
      expect(createCall.paymentMethod).toBe('cash_on_trip');
    });

    it('should throw InsufficientSeatsError when seats unavailable', async () => {
      // Arrange
      Customer.findById.mockResolvedValue(mockCustomer);
      BusService.reserveSeats.mockRejectedValue(
        new InsufficientSeatsError('Only 2 seats available, but 3 requested')
      );

      // Act & Assert
      await expect(BookingService.createBooking(mockUserId, mockValidBookingData)).rejects.toThrow(
        InsufficientSeatsError
      );
      expect(Booking.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when customer does not exist', async () => {
      // Arrange
      Customer.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(BookingService.createBooking(mockUserId, mockValidBookingData)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ValidationError for invalid booking data', async () => {
      // Arrange
      const invalidData = { ...mockValidBookingData };
      delete invalidData.busId;

      // Act & Assert
      await expect(BookingService.createBooking(mockUserId, invalidData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should not block booking if notification fails', async () => {
      // Arrange
      Customer.findById.mockResolvedValue(mockCustomer);
      BusService.reserveSeats.mockResolvedValue({});
      Booking.create.mockResolvedValue(mockBookingResponse);
      NotificationService.sendBookingConfirmation.mockRejectedValue(new Error('Email failed'));

      // Act
      const result = await BookingService.createBooking(mockUserId, mockValidBookingData);

      // Assert - booking should still be created
      expect(result).toBeDefined();
      expect(Booking.create).toHaveBeenCalled();
    });
  });

  describe('getBookingsByCustomer', () => {
    it('should retrieve bookings filtered by userId', async () => {
      // Arrange
      const mockBookings = [
        { _id: 'booking1', customerId: mockUserId, fare: 100 },
        { _id: 'booking2', customerId: mockUserId, fare: 150 },
      ];
      Booking.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockBookings),
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await BookingService.getBookingsByCustomer(mockUserId);

      // Assert
      expect(Booking.find).toHaveBeenCalledWith({ customerId: mockUserId });
      expect(result).toEqual(mockBookings);
      expect(result.length).toBe(2);
    });

    it('should return empty array when user has no bookings', async () => {
      // Arrange
      Booking.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await BookingService.getBookingsByCustomer(mockUserId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should apply pagination options', async () => {
      // Arrange
      const options = { limit: 5, skip: 10 };
      const mockSort = jest.fn();
      const mockLimit = jest.fn();
      const mockSkip = jest.fn();
      const mockLean = jest.fn();
      const mockExec = jest.fn().mockResolvedValue([]);

      mockSort.mockReturnValue({ limit: mockLimit });
      mockLimit.mockReturnValue({ skip: mockSkip });
      mockSkip.mockReturnValue({ lean: mockLean });
      mockLean.mockReturnValue({ exec: mockExec });

      Booking.find.mockReturnValue({ sort: mockSort });

      // Act
      await BookingService.getBookingsByCustomer(mockUserId, options);

      // Assert
      expect(mockLimit).toHaveBeenCalledWith(5);
      expect(mockSkip).toHaveBeenCalledWith(10);
    });
  });

  describe('getBookingById', () => {
    it('should retrieve booking with user isolation enforcement', async () => {
      // Arrange
      Booking.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockBookingResponse),
        }),
      });

      // Act
      const result = await BookingService.getBookingById(mockBookingId, mockUserId);

      // Assert
      expect(Booking.findById).toHaveBeenCalledWith(mockBookingId);
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenError when user is not booking owner', async () => {
      // Arrange
      const otherUserBooking = {
        ...mockBookingResponse,
        customerId: mockOtherId,
      };
      Booking.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(otherUserBooking),
        }),
      });

      // Act & Assert
      await expect(
        BookingService.getBookingById(mockBookingId, mockUserId)
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when booking does not exist', async () => {
      // Arrange
      Booking.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      // Act & Assert
      await expect(BookingService.getBookingById(mockBookingId, mockUserId)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking and calculate refund', async () => {
      // Arrange
      const bookingToCancel = {
        ...mockBookingResponse,
        status: 'confirmed',
        save: jest.fn().mockResolvedValue(),
      };
      Booking.findById.mockResolvedValue(bookingToCancel);
      Customer.findById.mockResolvedValue(mockCustomer);
      BusService.releaseSeats.mockResolvedValue();
      NotificationService.sendCancellationNotification.mockResolvedValue();

      // Act
      const result = await BookingService.cancelBooking(mockBookingId, mockUserId);

      // Assert
      expect(Booking.findById).toHaveBeenCalledWith(mockBookingId);
      expect(BusService.releaseSeats).toHaveBeenCalledWith(mockBusId, [12, 13, 14], '2024-12-20');
      expect(bookingToCancel.status).toBe('cancelled');
      expect(result.status).toBe('cancelled');
      expect(result.refundAmount).toBeDefined();
    });

    it('should throw ForbiddenError when user is not booking owner', async () => {
      // Arrange
      const otherUserBooking = {
        ...mockBookingResponse,
        customerId: mockOtherId,
        status: 'confirmed',
      };
      Booking.findById.mockResolvedValue(otherUserBooking);

      // Act & Assert
      await expect(BookingService.cancelBooking(mockBookingId, mockUserId)).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should throw BusinessRuleError when cancelling completed booking', async () => {
      // Arrange
      const completedBooking = {
        ...mockBookingResponse,
        status: 'completed',
      };
      Booking.findById.mockResolvedValue(completedBooking);

      // Act & Assert
      await expect(BookingService.cancelBooking(mockBookingId, mockUserId)).rejects.toThrow(
        BusinessRuleError
      );
    });

    it('should throw NotFoundError when booking does not exist', async () => {
      // Arrange
      Booking.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(BookingService.cancelBooking(mockBookingId, mockUserId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should calculate full refund if cancelled 24+ hours before departure', async () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2); // 2 days from now
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const bookingToCancel = {
        ...mockBookingResponse,
        fare: 100,
        status: 'confirmed',
        departureDetails: {
          city: 'New York',
          time: '08:00',
          date: futureDateStr,
        },
        save: jest.fn().mockResolvedValue(),
      };
      Booking.findById.mockResolvedValue(bookingToCancel);
      Customer.findById.mockResolvedValue(mockCustomer);
      BusService.releaseSeats.mockResolvedValue();
      NotificationService.sendCancellationNotification.mockResolvedValue();

      // Act
      const result = await BookingService.cancelBooking(mockBookingId, mockUserId);

      // Assert
      expect(result.refundAmount).toBe(100); // Full refund
    });

    it('should calculate no refund if cancelled less than 12 hours before departure', async () => {
      // Arrange
      const nearDate = new Date();
      nearDate.setHours(nearDate.getHours() + 6); // 6 hours from now
      const nearDateStr = nearDate.toISOString().split('T')[0];
      const timeStr = nearDate.toISOString().split('T')[1].substring(0, 5);

      const bookingToCancel = {
        ...mockBookingResponse,
        fare: 100,
        status: 'confirmed',
        departureDetails: {
          city: 'New York',
          time: timeStr,
          date: nearDateStr,
        },
        save: jest.fn().mockResolvedValue(),
      };
      Booking.findById.mockResolvedValue(bookingToCancel);
      Customer.findById.mockResolvedValue(mockCustomer);
      BusService.releaseSeats.mockResolvedValue();
      NotificationService.sendCancellationNotification.mockResolvedValue();

      // Act
      const result = await BookingService.cancelBooking(mockBookingId, mockUserId);

      // Assert
      expect(result.refundAmount).toBe(0); // No refund
    });
  });

  describe('updateBookingStatus', () => {
    it('should update booking status with valid transition', async () => {
      // Arrange
      const pendingBooking = {
        ...mockBookingResponse,
        status: 'pending',
        save: jest.fn().mockResolvedValue(),
      };
      Booking.findById.mockResolvedValue(pendingBooking);

      // Act
      const result = await BookingService.updateBookingStatus(
        mockBookingId,
        'confirmed',
        mockUserId
      );

      // Assert
      expect(pendingBooking.status).toBe('confirmed');
      expect(pendingBooking.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenError when user is not booking owner', async () => {
      // Arrange
      const otherUserBooking = {
        ...mockBookingResponse,
        customerId: mockOtherId,
        status: 'pending',
      };
      Booking.findById.mockResolvedValue(otherUserBooking);

      // Act & Assert
      await expect(
        BookingService.updateBookingStatus(mockBookingId, 'confirmed', mockUserId)
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ValidationError for invalid status transition', async () => {
      // Arrange
      const completedBooking = {
        ...mockBookingResponse,
        status: 'completed',
      };
      Booking.findById.mockResolvedValue(completedBooking);

      // Act & Assert
      await expect(
        BookingService.updateBookingStatus(mockBookingId, 'pending', mockUserId)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when booking does not exist', async () => {
      // Arrange
      Booking.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        BookingService.updateBookingStatus(mockBookingId, 'confirmed', mockUserId)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('validateBookingData', () => {
    it('should validate correct booking data', async () => {
      // Act & Assert
      await expect(BookingService.validateBookingData(mockValidBookingData)).resolves.not.toThrow();
    });

    it('should throw ValidationError for missing busId', async () => {
      // Arrange
      const invalidData = { ...mockValidBookingData };
      delete invalidData.busId;

      // Act & Assert
      await expect(BookingService.validateBookingData(invalidData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for empty seats', async () => {
      // Arrange
      const invalidData = { ...mockValidBookingData, seats: [] };

      // Act & Assert
      await expect(BookingService.validateBookingData(invalidData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for invalid fare', async () => {
      // Arrange
      const invalidData = { ...mockValidBookingData, fare: -50 };

      // Act & Assert
      await expect(BookingService.validateBookingData(invalidData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for missing passenger details', async () => {
      // Arrange
      const invalidData = { ...mockValidBookingData, passengerDetails: [] };

      // Act & Assert
      await expect(BookingService.validateBookingData(invalidData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for incomplete passenger info', async () => {
      // Arrange
      const invalidData = {
        ...mockValidBookingData,
        passengerDetails: [{ name: 'John' }], // Missing age and gender
      };

      // Act & Assert
      await expect(BookingService.validateBookingData(invalidData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for invalid payment method', async () => {
      // Arrange
      const invalidData = { ...mockValidBookingData, paymentMethod: 'invalid_method' };

      // Act & Assert
      await expect(BookingService.validateBookingData(invalidData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should include field-specific error details', async () => {
      // Arrange
      const invalidData = {
        ...mockValidBookingData,
        busId: null,
        fare: -100,
      };

      // Act & Assert
      try {
        await BookingService.validateBookingData(invalidData);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.details).toHaveProperty('busId');
        expect(error.details).toHaveProperty('fare');
      }
    });
  });
});
