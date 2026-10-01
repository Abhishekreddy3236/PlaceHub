const rateLimit = require('express-rate-limit');

const profileWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 60 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (!req.user?._id) {
      throw new Error("Authentication required for profile operations");
    }
    return `profile-write:${req.user._id.toString()}`;
  },
  message: {
    success: false,
    message: 'Too many profile updates. Please try again later.',
  },
});

module.exports = {
  profileWriteLimiter,
};
