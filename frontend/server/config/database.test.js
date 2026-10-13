/**
 * Database Configuration Tests
 * 
 * Tests verify:
 * 1. Database module exports correct models and utilities
 * 2. Connection state can be checked
 * 3. Logger integration works
 * 4. Index initialization structure is correct
 */

const db = require('./database');
const LoggerService = require('../services/logger.service');

describe('Database Configuration', () => {
  test('should export all required models', () => {
    expect(db.User).toBeDefined();
    expect(db.Bus).toBeDefined();
    expect(db.Route).toBeDefined();
    expect(db.Booking).toBeDefined();
  });

  test('should export connection utilities', () => {
    expect(typeof db.getInstance).toBe('function');
    expect(typeof db.connect).toBe('function');
    expect(typeof db.disconnect).toBe('function');
    expect(typeof db.getConnectionState).toBe('function');
    expect(typeof db.isConnected).toBe('function');
  });

  test('should export mongoose instance', () => {
    expect(db.mongoose).toBeDefined();
    expect(typeof db.mongoose.connect).toBe('function');
  });

  test('should have DatabaseConnection instance', () => {
    expect(db.connection).toBeDefined();
    expect(db.connection.constructor.name).toBe('DatabaseConnection');
  });

  test('should provide connection state information', () => {
    const state = db.getConnectionState();
    expect(state).toHaveProperty('isConnected');
    expect(state).toHaveProperty('connectionString');
    expect(state).toHaveProperty('database');
  });

  test('should integrate with LoggerService', () => {
    const logger = new LoggerService();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.logQueryTime).toBe('function');
  });

  test('should have model names registered correctly', () => {
    expect(db.User.modelName).toBe('User');
    expect(db.Bus.modelName).toBe('Bus');
    expect(db.Route.modelName).toBe('Route');
    expect(db.Booking.modelName).toBe('Booking');
  });

  test('should validate schema fields exist on models', () => {
    // User model schema fields
    expect(db.User.schema.paths.googleId).toBeDefined();
    expect(db.User.schema.paths.email).toBeDefined();
    expect(db.User.schema.paths.name).toBeDefined();

    // Bus model schema fields
    expect(db.Bus.schema.paths.operatorName).toBeDefined();
    expect(db.Bus.schema.paths.totalSeats).toBeDefined();
    expect(db.Bus.schema.paths.registrationNumber).toBeDefined();

    // Route model schema fields
    expect(db.Route.schema.paths.source).toBeDefined();
    expect(db.Route.schema.paths.destination).toBeDefined();

    // Booking model schema fields
    expect(db.Booking.schema.paths.customerId).toBeDefined();
    expect(db.Booking.schema.paths.busId).toBeDefined();
    expect(db.Booking.schema.paths.paymentMethod).toBeDefined();
  });
});
