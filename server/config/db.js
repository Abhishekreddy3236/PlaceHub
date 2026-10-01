const mongoose = require('mongoose');
const logger = require('./logger');

let retryAttempts = 0;
const MAX_RETRIES = 10;
const RETRY_INTERVAL = 5000;

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is missing");
}

const nodeVersion = process.versions.node.split('.')[0];
if (parseInt(nodeVersion, 10) < 18) {
  logger.warn(`Node version is ${process.version}. Node >= 18 is recommended for MongoDB Atlas TLS connections.`);
}

const getHostFromURI = (uri) => {
  try {
    const parsed = new URL(uri);
    return parsed.host;
  } catch {
    return 'unknown-host';
  }
};

// Disable auto-indexing on model load — indexes are synced explicitly after connection
mongoose.set('autoIndex', false);

mongoose.connection.on('connected', () => {
  // We log success in the connectDB function, but we can also log here
  logger.info('MongoDB connected event fired');
});

mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Reconnecting...');
  connectDB();
});

let connectionPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = (async () => {
      try {
        const host = getHostFromURI(process.env.MONGO_URI);
        logger.info(`Attempting MongoDB connection to host: ${host} (Attempt ${retryAttempts + 1})`);

        await mongoose.connect(process.env.MONGO_URI, {
          maxPoolSize: 50,
          minPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });

        retryAttempts = 0; // Reset on successful connection
        logger.info('MongoDB connected successfully');

        // Sync indexes explicitly — creates missing indexes, drops stale ones
        try {
          await mongoose.connection.syncIndexes();
          logger.info('MongoDB indexes synced successfully');
        } catch (syncErr) {
          logger.error(`MongoDB index sync error: ${syncErr.message}`);
        }

        return mongoose.connection;
      } catch (error) {
        connectionPromise = null;
        logger.error(`MongoDB connection error: ${error.message}`);

        if (process.env.MONGO_URI.startsWith('mongodb+srv') && error.message.includes('querySrv ENOTFOUND')) {
          logger.warn('DNS resolution failed for mongodb+srv URI. Please check your DNS settings or switch to a standard connection string.');
        }

        retryAttempts++;
        if (retryAttempts < MAX_RETRIES) {
          logger.info(`Retrying MongoDB connection in ${RETRY_INTERVAL / 1000} seconds...`);
          return new Promise((resolve) => setTimeout(() => resolve(connectDB()), RETRY_INTERVAL));
        } else {
          logger.error('Max MongoDB connection retries reached. Exiting.');
          process.exit(1);
        }
      }
    })();
  }

  return connectionPromise;
};

module.exports = connectDB;
