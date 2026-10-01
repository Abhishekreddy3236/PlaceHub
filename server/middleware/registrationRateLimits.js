const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const WINDOW_MS = 10 * 60 * 1000;
const IS_PROD = process.env.NODE_ENV === 'production';

const globalIpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // Global IP protection
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req),
});

const isEmail = (value) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const normalize = (val) =>
  typeof val === 'string'
    ? val.trim().toLowerCase()
    : '';

const getUserKey = (req) => {
  // Priority 1: Body email (login, OTP request)
  if (req.body?.email) {
    return `user:${normalize(req.body.email)}`;
  }

  // Priority 2: Identifier (if used anywhere)
  if (req.body?.identifier && isEmail(req.body.identifier)) {
    return `user:${normalize(req.body.identifier)}`;
  }

  // Priority 3: Authenticated user (protected routes)
  if (req.user?.email) {
    return `user:${req.user.email.toLowerCase()}`;
  }

  // Priority 4: OTP flows (VERY IMPORTANT FIX)
  if (req.body?.otp && req.body?.email) {
    return `user:${normalize(req.body.email)}`;
  }

  return null; // NEVER fallback to IP
};

/**
 * Per-email limiter — prevents spamming OTP requests to one email address.
 * Strict: 5 per 10 minutes per email.
 */
const registrationRequestOtpByEmail = rateLimit({
  windowMs: WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const key = getUserKey(req);
    return key || ipKeyGenerator(req);
  },
  message: {
    success: false,
    message: 'Too many OTP requests for this email. Try again in 10 minutes.',
  },
});

const registrationRequestOtpLimiter = [registrationRequestOtpByEmail];

const registrationSubmitLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: IS_PROD ? 50 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const key = getUserKey(req);
    return key || ipKeyGenerator(req);
  },
  message: {
    success: false,
    message: 'Too many registration attempts. Try again in 10 minutes.',
  },
});

module.exports = {
  globalIpLimiter,
  registrationRequestOtpLimiter,
  registrationSubmitLimiter,
};
