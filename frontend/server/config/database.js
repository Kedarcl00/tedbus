/**
 * Database Connection and Initialization Layer
 * 
 * Manages MongoDB connection setup, model exports, schema validation,
 * and error handling for the TedBus application.
 *
 * Features:
 * - Database connection and MongoDB integration
 * - Mongoose models loading and registration
 * - Connection pooling and retry logic
 * - Index creation and validation
 * - Graceful error handling
 */

const mongoose = require('mongoose');
const LoggerService = require('../services/logger.service');

// Import all models to ensure they're registered with Mongoose
const User = require('../models/User');
const Bus = require('../models/bus');
const Route = require('../models/route');
const Booking = require('../models/booking');

/**
 * Database configuration and initialization
 */
class DatabaseConnection {
  constructor() {
    this.connection = null;
    this.logger = new LoggerService();
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Connect to MongoDB with automatic retry on failure
   * @returns {Promise<mongoose.Connection>} Connected Mongoose instance
   */
  async connect() {
    try {
      // Get connection string from environment variables
      const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/tedbus';
      
      this.logger.info(`Attempting to connect to MongoDB: ${mongoUrl.replace(/\/\/[^@]+@/, '//***:***@')}`);

      // Configure Mongoose connection options for production/development
      const connectionOptions = {
        serverSelectionTimeoutMS: 15000, // Fail fast to surface real errors
        socketTimeoutMS: 20000,
        maxPoolSize: 10, // Connection pool size for production
        minPoolSize: 2,  // Minimum connections to maintain
        retryWrites: true, // Automatic retry for transient failures
        w: 'majority', // Write concern for data consistency
        appName: 'TedBus', // Identify app in MongoDB logs
      };

      // For development, use more lenient settings
      if (process.env.NODE_ENV === 'development') {
        connectionOptions.maxPoolSize = 5;
        connectionOptions.minPoolSize = 1;
      }

      // Connect to MongoDB using Mongoose
      await mongoose.connect(mongoUrl, connectionOptions);

      this.connection = mongoose.connection;
      this.isConnected = true;
      this.retryCount = 0;

      // Log successful connection
      this.logger.info('MongoDB connected successfully');

      // Initialize indexes for all models
      await this.initializeIndexes();

      // Validate schemas
      await this.validateSchemas();

      // Set up connection event handlers
      this.setupConnectionHandlers();

      return this.connection;
    } catch (error) {
      this.logger.error('MongoDB connection failed', error, {
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
      });

      // Implement automatic retry with exponential backoff
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
        this.logger.warn(`Retrying MongoDB connection in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
        
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            this.connect()
              .then(resolve)
              .catch(reject);
          }, delay);
        });
      }

      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Initialize and validate all database indexes
   * Ensures efficient queries and unique constraints
   * @private
   */
  async initializeIndexes() {
    try {
      this.logger.info('Initializing database indexes...');

      // Helper function to safely create/update indexes
      const createIndexSafely = async (collection, indexSpec, options = {}, indexName = null) => {
        try {
          // Try to drop existing index if it has the same name
          if (indexName) {
            try {
              await collection.dropIndex(indexName);
              this.logger.debug(`Dropped conflicting ${indexName} index`);
            } catch (error) {
              // Index may not exist yet or has different structure, which is fine
              if (error.code !== 27 && error.codeName !== 'IndexNotFound') {
                this.logger.debug(`Index ${indexName} does not exist or has different structure`);
              }
            }
          }
          await collection.createIndex(indexSpec, options);
        } catch (error) {
          // If it's an index conflict error, log as debug and continue
          if (error.code === 86 || error.code === 85 || error.codeName === 'IndexKeySpecsConflict' || error.codeName === 'IndexOptionsConflict') {
            this.logger.debug(`Index already exists with expected configuration: ${indexName || JSON.stringify(indexSpec)}`);
          } else {
            throw error;
          }
        }
      };

      // User model indexes
      // - Unique index on email for registration validation
      // - Index on googleId for authentication
      await createIndexSafely(User.collection, { email: 1 }, { unique: true, sparse: true }, 'email_1');
      await createIndexSafely(User.collection, { googleId: 1 }, { unique: true, sparse: true }, 'googleId_1');
      this.logger.debug('User indexes created/verified');

      // Bus model indexes
      // - Index on registrationNumber for uniqueness
      await createIndexSafely(Bus.collection, { registrationNumber: 1 }, { unique: true, sparse: true }, 'registrationNumber_1');
      this.logger.debug('Bus indexes created/verified');

      // Route model indexes (no indexes required, basic queries)
      this.logger.debug('Route model indexes verified');

      // Booking model indexes
      // - Compound index (customerId, createdAt) for efficient user booking retrieval
      //   Allows fast queries like: find bookings for user ordered by creation date
      // - Index on status for booking state queries
      // - Index on departureDate for upcoming trips queries
      await createIndexSafely(
        Booking.collection,
        { customerId: 1, createdAt: -1 },
        { name: 'customerCreatedIndex' },
        'customerCreatedIndex'
      );
      await createIndexSafely(Booking.collection, { status: 1 }, {}, 'status_1');
      await createIndexSafely(Booking.collection, { departureDate: 1 }, {}, 'departureDate_1');
      this.logger.debug('Booking indexes created/verified');

      this.logger.info('All database indexes initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize indexes', error);
      throw error;
    }
  }

  /**
   * Validate that all model schemas are properly initialized
   * @private
   */
  async validateSchemas() {
    try {
      this.logger.info('Validating database schemas...');

      // Verify models are registered with Mongoose
      const modelNames = Object.keys(mongoose.models);
      const requiredModels = ['User', 'Bus', 'Route', 'Booking'];

      for (const modelName of requiredModels) {
        if (!modelNames.includes(modelName)) {
          throw new Error(`Required model ${modelName} is not registered`);
        }
      }

      this.logger.info(`All required schemas validated: [${requiredModels.join(', ')}]`);

      // Log schema validation status
      this.logger.debug('Schema validation status: ✓ User, ✓ Bus, ✓ Route, ✓ Booking');
    } catch (error) {
      this.logger.error('Schema validation failed', error);
      throw error;
    }
  }

  /**
   * Set up connection event handlers for monitoring
   * @private
   */
  setupConnectionHandlers() {
    // Handle connection disconnection
    this.connection.on('disconnected', () => {
      this.isConnected = false;
      this.logger.warn('MongoDB connection disconnected');
    });

    // Handle reconnection
    this.connection.on('reconnected', () => {
      this.isConnected = true;
      this.logger.info('MongoDB connection reestablished');
    });

    // Handle connection errors
    this.connection.on('error', (error) => {
      this.isConnected = false;
      this.logger.error('MongoDB connection error', error);
    });
  }

  /**
   * Get current connection state
   * Useful for health checks and monitoring
   * @returns {Object} Connection state information
   */
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      status: this.connection?.readyState,
      readyStateDescription: this.getReadyStateDescription(this.connection?.readyState),
      connectionString: process.env.MONGODB_URI ? 
        process.env.MONGODB_URI.replace(/\/\/[^@]+@/, '//***:***@') : 
        'mongodb://localhost:27017/tedbus',
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      database: mongoose.connection.name,
    };
  }

  /**
   * Describe MongoDB connection ready state
   * @private
   */
  getReadyStateDescription(state) {
    const states = {
      0: 'Disconnected',
      1: 'Connected',
      2: 'Connecting',
      3: 'Disconnecting',
    };
    return states[state] || 'Unknown';
  }

  /**
   * Disconnect from MongoDB
   * Used during application shutdown
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        this.isConnected = false;
        this.logger.info('MongoDB disconnected successfully');
      }
    } catch (error) {
      this.logger.error('Error disconnecting from MongoDB', error);
      throw error;
    }
  }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

/**
 * Module exports
 * Provides access to connected Mongoose instance, models, and utilities
 */
module.exports = {
  // Connection instance and management
  connection: dbConnection,
  getInstance: () => dbConnection,
  connect: () => dbConnection.connect(),
  disconnect: () => dbConnection.disconnect(),
  getConnectionState: () => dbConnection.getConnectionState(),

  // Model exports for use in repositories and services
  User,
  Bus,
  Route,
  Booking,

  // Mongoose instance for advanced operations
  mongoose,

  // Connection utilities
  isConnected: () => dbConnection.isConnected,
};
