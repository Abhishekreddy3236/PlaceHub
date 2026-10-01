const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const logger = require('../config/logger');

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Primary key: strict user ID for authenticated requests.
 * Ensures each student on the same WiFi each get their own bucket.
 */
const userKeyGenerator = (req) => {
  if (!req.user?.id) {
    throw new Error('User ID required for rate limiting');
  }
  return `user:${req.user.id}`;
};

const normalize = (value) => {
  if (typeof value !== 'string') return null;
  return value.trim().toLowerCase();
};

const getUserKey = (req) => {
  const identifier = normalize(req.body?.identifier);
  const email = normalize(req.body?.email);

  // 1. Use identifier FIRST (universal login field)
  if (identifier) {
    return `user:${identifier}`;
  }

  // 2. Fallback to email (legacy)
  if (email) {
    return `user:${email}`;
  }

  // 3. Authenticated users (protected routes)
  if (req.user?._id) {
    return `user:${req.user._id}`;
  }

  if (req.user?.email) {
    return `user:${req.user.email.toLowerCase()}`;
  }

  // 4. FINAL FALLBACK
  return ipKeyGenerator(req);
};

// Role-aware dynamic limit

const getRoleLimit = (req) => {
  const role = req.user?.role;

  switch (role) {
    case 'admin':
      return 200;
    case 'hr':
      return 150;
    case 'staff':
      return 120;
    case 'student':
      return 80;
    default:
      return 30;
  }
};

// Unified 429 handler with observability

const safeHandler = (req, res) => {
  logger.warn('rate-limit:hit', {
    route: req.originalUrl,
    method: req.method,
    user: req.user?.id || 'anonymous',
    role: req.user?.role || 'none',
  });

  const retryAfterSeconds = 60;
  res.set('Retry-After', String(retryAfterSeconds));

  res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later.',
    retryAfterSeconds,
  });
};

// Route-specific limiters (Layer 1 — per-email/user)

/**
 * POST /login — strict per-email, skip successful requests.
 * Failed login spam from one email gets blocked; successful logins don't count.
 */
const loginUserLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: IS_PROD ? 5 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const key = getUserKey(req);
    return key || ipKeyGenerator(req);
  },
  handler: safeHandler,
  skipSuccessfulRequests: true,
});

const loginLimiter = [loginUserLimiter];

/**
 * POST /send-otp, POST /forgot-password — strict per-email.
 */
const otpUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const key = getUserKey(req);
    return key || ipKeyGenerator(req);
  },
  handler: safeHandler,
  skipSuccessfulRequests: false,
});

const otpLimiter = [otpUserLimiter];

/**
 * POST /verify-otp — strict per-email to prevent OTP brute-force.
 * 6-digit OTP = 1M combinations; 5 attempts/min makes brute-force infeasible.
 */
const verifyOtpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const key = getUserKey(req);
    return key || ipKeyGenerator(req);
  },
  handler: safeHandler,
  skipSuccessfulRequests: false,
});

/**
 * POST /reset-password — strict per-email.
 */
const resetPasswordUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const key = getUserKey(req);
    return key || ipKeyGenerator(req);
  },
  handler: safeHandler,
  skipSuccessfulRequests: false,
});

const resetPasswordLimiter = [resetPasswordUserLimiter];

/**
 * POST /apply — moderate per-user (always authenticated).
 * No IP fallback needed because `authenticate` middleware runs first.
 */
const applyJobLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 40 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: safeHandler,
  skipSuccessfulRequests: false,
});


// New limiters for previously unprotected endpoints

/**
 * Resume upload — per-user, prevents storage abuse.
 */
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: IS_PROD ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: safeHandler,
  skipSuccessfulRequests: false,
});

/**
 * Application status update, job CRUD — moderate per-user.
 */
const statusUpdateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 60 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: safeHandler,
  skipSuccessfulRequests: false,
});

/**
 * Bulk operations — strict per-user, these are expensive.
 */
const bulkOperationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 10 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: safeHandler,
  skipSuccessfulRequests: false,
});

/**
 * Dashboard data — per-user read limiter.
 */
const dashboardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 60 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: safeHandler,
  skipSuccessfulRequests: false,
});

/**
 * Admin routes — global limiter applied via router.use() in adminRoutes.
 * Moved here from adminRoutes.js to centralize all limiter definitions.
 */
const adminRouteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 200 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?._id) return `admin-user:${req.user._id}`;
    return `admin-ip:${ipKeyGenerator(req)}`;
  },
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many admin requests, please try again later.',
  },
});

const resumeDownloadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // safe for HR usage I guess will change if required
  keyGenerator: userKeyGenerator,
  message: {
    status: 'fail',
    message: 'Too many resume requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * CSV Status Update — strict per-user. Uploading CSV is an expensive action.
 */
const csvStatusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 10 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: safeHandler,
  skipSuccessfulRequests: false,
});

/**
 * Public resume share — strict IP limiter
 */
const publicShareIpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 300 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  handler: safeHandler,
  skipSuccessfulRequests: false,
});

/**
 * Public resume share — token limiter
 */
const publicShareTokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: IS_PROD ? 20 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `token:${req.params.token}`,
  handler: safeHandler,
  skipSuccessfulRequests: false,
});

/**
 * Subscription endpoints — per-user limiter.
 */
const subscriptionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 20 : 100,
  standardHeaders: true,
  keyGenerator: (req) => {
    if (!req.user?.id && !req.user?._id) {
      throw new Error('User ID required for rate limiting');
    }
    const userId = req.user.id || req.user._id;
    return `subscription:${userId}`;
  },
  handler: safeHandler,
  skipSuccessfulRequests: false,
});

module.exports = {
  loginLimiter,
  otpLimiter,
  verifyOtpLimiter,
  resetPasswordLimiter,
  applyJobLimiter,
  uploadLimiter,
  statusUpdateLimiter,
  csvStatusLimiter,
  bulkOperationLimiter,
  dashboardLimiter,
  adminRouteLimiter,
  resumeDownloadLimiter,
  publicShareIpLimiter,
  publicShareTokenLimiter,
  subscriptionLimiter,
  userKeyGenerator,
  getRoleLimit,
  safeHandler,
};
