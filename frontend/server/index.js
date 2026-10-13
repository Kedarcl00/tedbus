require('dotenv').config();
const express = require('express');
const bodyparser = require('body-parser');
const cors = require('cors');

// Import database configuration
const { connect, getConnectionState } = require('./config/database');
const LoggerService = require('./services/logger.service');

const app = express();
const logger = new LoggerService();

// CORS configuration - Allow Angular frontend to make requests
const corsOptions = {
  origin: [
    'http://localhost:4200',  // Angular dev server
    'http://localhost:3000',  // Alternative dev port
  ],
  credentials: true,           // Allow cookies and auth headers
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id']  // Added X-User-Id
};

app.use(cors(corsOptions));

// Security headers - Allow Google Sign-In popup
app.use((req, res, next) => {
  // 'unsafe-none' allows Google Sign-In popup to post back the credential message
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  next();
});

app.use(bodyparser.json());

// Convenience helper so controllers can call res.sendError('CODE', status)
app.use((req, res, next) => {
  res.sendError = (code, status = 500, message = '') => {
    const messages = {
      UNAUTHORIZED: 'Authentication required',
      JOURNEY_REQUIRED: 'Only verified travellers (with at least one completed booking) may post',
      VALIDATION: 'Invalid request data',
      NOT_FOUND: 'Resource not found',
      SERVER_ERROR: 'Internal server error',
    };
    return res.status(status).json({
      success: false,
      error: { code, message: message || messages[code] || code, statusCode: status }
    });
  };
  next();
});

const customerroutes = require('./routes/customer');
const routesroute = require('./routes/route');
const bookingroute = require('./routes/booking');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');

app.use(bookingroute);
app.use(routesroute);
app.use(customerroutes);
app.use('/auth', authRoutes);
app.use('/api/users', usersRoutes);
const communityRoutes = require('./routes/community');
app.use(communityRoutes);
const notificationRoutes = require('./routes/notification');
app.use(notificationRoutes);

/**
 * Initialize database connection on application startup
 */
async function initializeDatabase() {
  try {
    // Check if MONGODB_URI is defined
    if (!process.env.MONGODB_URI && process.env.NODE_ENV === 'production') {
      logger.error('FATAL: MONGODB_URI is not defined in .env', new Error('Missing MONGODB_URI'));
      process.exit(1);
    }

    // Connect to MongoDB with automatic retry
    await connect();
    
    // Log connection state for debugging
    const connectionState = getConnectionState();
    logger.info('Database connection established', connectionState);
  } catch (error) {
    logger.error('Failed to initialize database connection', error);
    // In production, exit. In development, continue with warning
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

/**
 * Health check endpoint for database connection
 */
app.get('/health', (req, res) => {
  const connectionState = getConnectionState();
  if (connectionState.isConnected) {
    res.status(200).json({
      success: true,
      message: 'Server is healthy',
      database: connectionState,
    });
  } else {
    res.status(503).json({
      success: false,
      message: 'Server is unhealthy - database disconnected',
      database: connectionState,
    });
  }
});

app.get('/', (req, res) => {
  res.send('Hello, Ted bus is working');
});

const PORT = process.env.PORT || 5001;

/**
 * Start server with database initialization
 */
async function startServer() {
  try {
    // Initialize database connection first
    await initializeDatabase();

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`, { port: PORT });
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the application
startServer();
