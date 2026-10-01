require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./config/logger');

let isShuttingDown = false;
let server;

const gracefulShutdown = async (signal, exitCode = 0) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    logger.warn('Graceful shutdown timeout reached. Forcing exit.');
    process.exit(exitCode);
  }, 15000);

  if (server) {
    logger.info('Closing HTTP server...');
    try {
      if (server.closeIdleConnections) {
        server.closeIdleConnections();
      }
      await new Promise((resolve) => server.close(resolve));
      logger.info('HTTP server closed.');
    } catch (err) {
      logger.error(`Error closing HTTP server: ${err.message}`);
    }
  }

  logger.info('Closing MongoDB connection...');
  try {
    await mongoose.connection.close(false);
    logger.info('MongoDB connection closed.');
  } catch (err) {
    logger.error(`Error closing MongoDB: ${err.message}`);
  }

  if (typeof logger.end === 'function') {
    logger.end();
  }

  clearTimeout(shutdownTimeout);
  process.exit(exitCode);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT', 0));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM', 0));

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  gracefulShutdown('uncaughtException', 1);
});

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err?.message || err}`, { stack: err?.stack });
  gracefulShutdown('unhandledRejection', 1);
});
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const morgan = require('morgan');
const connectDB = require('./config/db');
const seedAdmin = require('./config/seedAdmin');
const bootstrapData = require('./config/bootstrapData');

const { errorHandler, notFound } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const profileRoutes = require('./routes/profileRoutes');
const jobRoutes = require('./routes/jobRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const savedJobRoutes = require('./routes/savedJobRoutes');
const adminRoutes = require('./routes/adminRoutes');
const hrRoutes = require('./routes/hrRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const bulkOperationRoutes = require('./routes/bulkOperationRoutes');
const resumeR2Routes = require('./routes/resumeR2Routes');
const publicRoutes = require('./routes/publicRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

const RUN_BOOTSTRAP = process.env.RUN_BOOTSTRAP === 'true';
const RUN_SEED_ADMIN = process.env.RUN_SEED_ADMIN === 'true';


const hasJwtSecrets = Boolean(process.env.JWT_ACCESS_SECRET) && Boolean(process.env.JWT_REFRESH_SECRET);

if (!hasJwtSecrets) {
  logger.error('FATAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables are strictly required.');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  logger.error('FATAL: MONGO_URI environment variable is missing.');
  process.exit(1);
}

if (!process.env.RESEND_API_KEY) {
  logger.warn('Missing RESEND_API_KEY - OTP and notification emails will fail.');
}
if (!process.env.FROM_EMAIL) {
  logger.warn('Missing FROM_EMAIL - email sending will fail.');
}
if (!process.env.CLIENT_URL) {
  logger.warn('Missing CLIENT_URL - CORS may reject frontend requests.');
}

app.set('trust proxy', 2);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const isProd = process.env.NODE_ENV === 'production';

const allowedOrigins = isProd
  ? (process.env.CLIENT_URL || '')
    .split(',')
    .map(url => url.trim())
    .filter(Boolean)
  : [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.CLIENT_URL
  ].filter(Boolean);
logger.info(`CORS Allowed Origins: ${JSON.stringify(allowedOrigins)}`);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests that do not include an Origin header.
      // Examples:
      // - Health checks
      // - Server-to-server requests
      // - curl
      // - Postman
      //
      // Browser security is NOT weakened because browsers always
      // send an Origin header for cross-origin requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(
  morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

// Rate limiting is applied per-route in route files (rateLimiter.js middleware).
// No global IP-based limiter; prevents blocking 1000+ students on shared WiFi.

app.use('/api/v1/auth', authRoutes);

app.use('/api/v1/users', userRoutes);

app.use('/api/v1/profile', profileRoutes);

app.use('/api/v1', dashboardRoutes);

app.use('/api/v1/jobs', jobRoutes);

app.use('/api/v1/applications', applicationRoutes);

app.use('/api/v1/saved-jobs', savedJobRoutes);

app.use('/api/v1/admin', adminRoutes);

app.use('/api/v1/hr', hrRoutes);

app.use('/api/v1/bulk-operations', bulkOperationRoutes);

app.use('/api/v1/resumes', resumeR2Routes);

app.use('/api/v1/public', publicRoutes);

app.use('/api/v1/notifications', notificationRoutes);

const getHealthStatus = () => {
  // readyState 1 means strictly connected. We don't perform network pings,
  // making this a lightweight synchronous readiness check suitable for load balancers.
  const isMongoConnected = mongoose.connection.readyState === 1;
  const statusCode = isMongoConnected ? 200 : 503;

  return {
    statusCode,
    payload: {
      success: isMongoConnected,
      message: isMongoConnected ? 'Service is healthy' : 'Service unavailable: Database disconnected',
      data: {
        status: isMongoConnected ? 'ok' : 'error',
        mongoReadyState: mongoose.connection.readyState,
        timestamp: new Date().toISOString(),
      },
    },
  };
};

app.get('/api/health', (req, res) => {
  const health = getHealthStatus();
  res.status(health.statusCode).json(health.payload);
});

app.get('/api/v1/health', (req, res) => {
  const health = getHealthStatus();
  res.status(health.statusCode).json(health.payload);
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    // Start notification worker
    if (process.env.NOTIFICATIONS_ENABLED !== 'false') {
      const notificationWorker = require('./workers/notificationWorker');
      notificationWorker.start();
    }

    //Controlled execution (FIXED)
    if (RUN_BOOTSTRAP) {
      await bootstrapData();
      logger.info('Bootstrap completed');
    } else {
      logger.info('Bootstrap skipped. Set RUN_BOOTSTRAP=true to enable.');
    }

    if (RUN_SEED_ADMIN) {
      await seedAdmin();
      logger.info('Admin seed completed');
    }

    server = app.listen(PORT, '127.0.0.1', () => {
      logger.info(`Server running on port ${PORT}`);
    });

    // Configure production-safe HTTP timeouts for Nginx compatibility.
    // Node 18 default keepAliveTimeout is 5s. Nginx default is 75seconds
    // If Nginx routes a request right as Node drops the keep-alive, Nginx throws a 502 Bad Gateway.
    // Setting keepAliveTimeout to 65000 (65s) is safely below Nginx's 75s, ensuring Nginx closes it first.
    server.keepAliveTimeout = 65000;

    // headersTimeout must always be slightly larger than keepAliveTimeout (e.g., +1000ms)
    // to give Node enough time to parse headers of a request arriving at the very end of the keep-alive window.
    server.headersTimeout = 66000;
  } catch (error) {
    logger.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();
