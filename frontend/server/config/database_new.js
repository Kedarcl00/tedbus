/**
 * Database Connection and Initialization Layer
 * 
 * Manages MongoDB connection setup, model exports, schema validation,
 * and error handling for the TedBus application.
 * 
 * Requirements Met:
 * - 8.1: Database connection and MongoDB integration
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
