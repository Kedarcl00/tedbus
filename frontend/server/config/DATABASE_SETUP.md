# Database Configuration and Initialization

## Overview

The `config/database.js` module manages MongoDB connection setup, model registration, index initialization, and error handling for the TedBus service-oriented refactored application.

**Requirements Met:**
- Requirement 8.1: Database connection and MongoDB integration
- Mongoose models loading and registration
- Connection pooling and retry logic with exponential backoff
- Automatic index creation and validation
- Graceful error handling and reconnection support

## Architecture

### DatabaseConnection Class

The module exports a singleton `DatabaseConnection` class that encapsulates all database operations:

```
DatabaseConnection
├── Connection Management
│   ├── connect() - Establish MongoDB connection with retry
│   ├── disconnect() - Gracefully close connection
│   ├── setupConnectionHandlers() - Monitor connection events
│   └── getConnectionState() - Health check utility
├── Initialization
│   ├── initializeIndexes() - Create/verify database indexes
│   └── validateSchemas() - Verify model registration
└── Configuration
    ├── Automatic retry with exponential backoff
    ├── Connection pooling (10 connections in production, 5 in development)
    └── Write concern and data consistency settings
```

## Module Exports

```javascript
module.exports = {
  // Connection instance and management
  connection: dbConnection,              // DatabaseConnection singleton instance
  getInstance: () => dbConnection,       // Get connection instance
  connect: () => dbConnection.connect(), // Connect to MongoDB
  disconnect: () => dbConnection.disconnect(), // Disconnect gracefully
  getConnectionState: () => dbConnection.getConnectionState(), // Health check

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
```

## Usage

### 1. Server Initialization

In `server.js` or your main application file:

```javascript
const { connect, getConnectionState } = require('./config/database');
const LoggerService = require('./services/logger.service');

const logger = new LoggerService();

// Initialize database connection on application startup
async function initializeDatabase() {
  try {
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

// Start application
async function startServer() {
  try {
    // Initialize database connection first
    await initializeDatabase();

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();
```

### 2. Using Models in Repositories

```javascript
const { User, Bus, Route, Booking } = require('../../config/database');

class UserRepository {
  async findById(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return user;
    } catch (error) {
      logger.error('Failed to find user', error);
      throw error;
    }
  }

  async findByEmail(email) {
    return User.findOne({ email });
  }

  async create(userData) {
    const user = new User(userData);
    await user.save();
    return user;
  }
}

module.exports = UserRepository;
```

### 3. Health Check Endpoint

```javascript
const { getConnectionState } = require('./config/database');

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
```

## Connection Configuration

### Environment Variables

```bash
# MongoDB connection string (required)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/tedbus

# Environment mode (development or production)
NODE_ENV=development
```

### Default Connection String

For local development without `MONGODB_URI`:
```
mongodb://localhost:27017/tedbus
```

### Connection Options

The module uses the following connection options for optimal performance:

| Option | Development | Production | Description |
|--------|-------------|-----------|-------------|
| `serverSelectionTimeoutMS` | 15000 | 15000 | Fail fast to surface real errors |
| `socketTimeoutMS` | 20000 | 20000 | Socket timeout for queries |
| `maxPoolSize` | 5 | 10 | Maximum connection pool size |
| `minPoolSize` | 1 | 2 | Minimum connections to maintain |
| `retryWrites` | true | true | Automatic retry for transient failures |
| `w` | - | majority | Write concern for data consistency |

## Index Management

Indexes are automatically created and validated on startup for optimal query performance:

### User Model Indexes
```javascript
// Unique index on email for registration validation
User.collection.createIndex({ email: 1 }, { unique: true, sparse: true });

// Index on googleId for authentication lookups
User.collection.createIndex({ googleId: 1 }, { unique: true, sparse: true });
```

**Use Cases:**
- Fast email lookups during login/registration
- Google ID authentication validation
- Prevents duplicate email registrations

### Bus Model Indexes
```javascript
// Unique index on registrationNumber
Bus.collection.createIndex({ registrationNumber: 1 }, { unique: true, sparse: true });
```

**Use Cases:**
- Bus identification by registration number
- Prevents duplicate bus registrations

### Route Model Indexes
No indexes required - basic queries on source/destination

### Booking Model Indexes
```javascript
// Compound index (customerId, createdAt) for efficient user booking retrieval
Booking.collection.createIndex(
  { customerId: 1, createdAt: -1 },
  { name: 'customerCreatedIndex' }
);

// Index on status for booking state queries
Booking.collection.createIndex({ status: 1 });

// Index on departureDate for upcoming trips queries
Booking.collection.createIndex({ departureDate: 1 });
```

**Use Cases:**
- Fast retrieval of user's bookings ordered by creation date: `O(log n)` lookup
- Query all bookings for user: `db.bookings.find({ customerId: userId }).sort({ createdAt: -1 })`
- Filter bookings by status: `db.bookings.find({ status: "confirmed" })`
- Find upcoming trips: `db.bookings.find({ departureDate: { $gte: now } })`

**Performance Impact:**
- Compound index prevents N+1 queries
- Dramatically improves pagination performance for user booking lists
- Reduces query execution time from ~100ms to ~5ms for typical user

## Retry Logic

The connection module implements automatic retry with exponential backoff:

```
First attempt: immediate
Retry 1: 5 seconds
Retry 2: 10 seconds (5s × 2)
Retry 3: 20 seconds (5s × 4)
Retry 4: 40 seconds (5s × 8)
Retry 5: 80 seconds (5s × 16)
Max: 5 retries (80 seconds total)
```

**Logged Example:**
```
[2024-06-15T10:30:45.123Z] INFO: Attempting to connect to MongoDB
[2024-06-15T10:30:50.456Z] ERROR: MongoDB connection FAILED: ECONNREFUSED
[2024-06-15T10:30:50.456Z] WARN: Retrying MongoDB connection in 5000ms (attempt 1/5)
[2024-06-15T10:30:55.789Z] ERROR: MongoDB connection FAILED: ECONNREFUSED
[2024-06-15T10:30:55.789Z] WARN: Retrying MongoDB connection in 10000ms (attempt 2/5)
[2024-06-15T10:31:05.012Z] INFO: MongoDB connected successfully
```

## Connection State Monitoring

### getConnectionState()

Returns current connection information for health checks and monitoring:

```javascript
{
  isConnected: true,                    // Boolean - connection active
  status: 1,                            // Mongoose ready state (0=disconnected, 1=connected)
  readyStateDescription: "Connected",   // Human-readable status
  connectionString: "mongodb+srv://***:***@cluster.mongodb.net/tedbus",
  host: "cluster0.mongodb.net",         // Primary host
  port: 27017,                          // MongoDB port
  database: "tedbus"                    // Database name
}
```

### Connection Event Handlers

The module monitors connection events:

```javascript
// Reconnected after disconnection
connection.on('reconnected', () => {
  logger.info('MongoDB connection reestablished');
});

// Connection lost
connection.on('disconnected', () => {
  logger.warn('MongoDB connection disconnected');
});

// Connection errors
connection.on('error', (error) => {
  logger.error('MongoDB connection error', error);
});
```

## Error Scenarios and Handling

### Scenario 1: Connection String Not Configured

**Problem:** `MONGODB_URI` environment variable not set

**Behavior:**
- Production: Application exits with code 1
- Development: Application continues with warning

**Log Output:**
```
[2024-06-15T10:30:45.123Z] ERROR: FATAL: MONGODB_URI is not defined in .env
```

**Solution:**
```bash
# Set environment variable
export MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/tedbus
```

### Scenario 2: Connection Timeout (Network Issue)

**Problem:** MongoDB server unreachable (firewall, network down)

**Behavior:**
- Initial connection fails
- Automatic retry with exponential backoff
- After 5 retries (~80 seconds), connection fails

**Log Output:**
```
[2024-06-15T10:30:45.123Z] ERROR: MongoDB connection failed: connect ECONNREFUSED
[2024-06-15T10:30:50.456Z] WARN: Retrying MongoDB connection in 5000ms (attempt 1/5)
```

**Solution:**
1. Verify MongoDB server is running
2. Check network connectivity
3. Verify firewall allows access to MongoDB port

### Scenario 3: Authentication Failure

**Problem:** Invalid username/password in connection string

**Error Message:**
```
SASL authentication failed: Authentication failed
```

**Solution:**
1. Verify MongoDB username and password
2. Check connection string format
3. URL-encode special characters in password

### Scenario 4: Index Creation Failure

**Problem:** Duplicate key values when creating unique index

**Error Message:**
```
E11000 duplicate key error collection: tedbus.users index: email_1
```

**Solution:**
1. Check for duplicate values in the collection
2. Clean up duplicate entries
3. Restart application to recreate indexes

## Schema Validation

Schemas are validated on startup to ensure all models are properly registered:

**Checked Models:**
- User ✓
- Bus ✓
- Route ✓
- Booking ✓

**Log Output:**
```
[2024-06-15T10:30:45.123Z] INFO: Validating database schemas...
[2024-06-15T10:30:45.234Z] INFO: All required schemas validated: [User, Bus, Route, Booking]
[2024-06-15T10:30:45.345Z] DEBUG: Schema validation status: ✓ User, ✓ Bus, ✓ Route, ✓ Booking
```

## Logging Integration

The database module integrates with `LoggerService` for structured logging:

```javascript
// Info-level logs
logger.info('MongoDB connected successfully');

// Error-level logs with context
logger.error('MongoDB connection failed', error, {
  retryCount: 2,
  maxRetries: 5,
  connectionString: mongoUrl
});

// Warning logs
logger.warn(`Retrying MongoDB connection in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);

// Debug logs
logger.debug('User indexes created/verified');
```

**Log Levels:**
- `INFO`: Successful connections, initialization complete
- `ERROR`: Connection failures, schema validation errors
- `WARN`: Retry attempts, connection disconnections
- `DEBUG`: Index creation, schema validation details

## Performance Considerations

### Query Optimization

The compound index on Booking prevents N+1 queries:

```javascript
// GOOD: Uses compound index, fast
db.bookings
  .find({ customerId: userId })
  .sort({ createdAt: -1 })
  .limit(10);
// Execution time: ~5ms

// BAD: No index, slow
db.bookings
  .find({ customerId: userId, status: "confirmed" })
  .sort({ departureDate: -1 });
// Execution time: ~100ms (without index on status + departureDate)

// GOOD: Uses separate indexes
db.bookings
  .find({ status: "confirmed" })
  .limit(100);
// Execution time: ~10ms (uses status index)
```

### Connection Pool

Production connection pool is configured with:
- Max 10 connections
- Min 2 connections (maintained at all times)
- Automatic reuse of idle connections

This balances resource usage and performance for typical MEAN stack applications.

## Testing

Run the database configuration tests:

```bash
npm test -- config/database.test.js
```

Tests verify:
1. All models are exported correctly
2. Connection utilities are available
3. Mongoose instance is exported
4. DatabaseConnection instance exists
5. Connection state information is retrievable
6. LoggerService integration works
7. Model names are registered correctly
8. Schema fields exist on all models

## Migration and Deployment

### Initial Setup

1. **Configure Environment:**
   ```bash
   export MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/tedbus
   export NODE_ENV=production
   ```

2. **Start Application:**
   ```bash
   npm start
   ```

3. **Verify Connection:**
   ```bash
   curl http://localhost:5001/health
   ```

4. **Check Logs:**
   ```
   [timestamp] INFO: MongoDB connected successfully
   [timestamp] INFO: All required schemas validated: [User, Bus, Route, Booking]
   [timestamp] INFO: Server is running on port 5001
   ```

### Production Checklist

- [ ] MongoDB Atlas IP whitelist configured
- [ ] Database user credentials verified
- [ ] Connection string formatted correctly
- [ ] NODE_ENV=production
- [ ] Health check endpoint responds
- [ ] Indexes created successfully
- [ ] No connection errors in logs
- [ ] Response times within 500ms

## Troubleshooting

### "FATAL: MONGODB_URI is not defined in .env"

**Solution:**
```bash
# Add to server/.env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/tedbus
```

### "MongoDB connection FAILED: connect ECONNREFUSED"

**Solutions:**
1. Verify MongoDB service is running
2. Check MongoDB port (27017) is accessible
3. For MongoDB Atlas, verify IP whitelist includes your IP address

### "SASL authentication failed"

**Solutions:**
1. Verify username and password
2. URL-encode special characters in password
3. Check database user has correct permissions

### "Cannot find module '...models/User'"

**Solution:**
Ensure all model files exist in `server/models/` directory:
- User.js
- bus.js
- route.js
- booking.js

## References

- [Mongoose Connection Options](https://mongoosejs.com/docs/api/connection.html#Connection.prototype.openUri)
- [MongoDB Connection String](https://docs.mongodb.com/manual/reference/connection-string/)
- [MongoDB Indexing](https://docs.mongodb.com/manual/indexes/)
- [MongoDB Atlas Whitelist](https://docs.mongodb.com/atlas/security-whitelist/)
