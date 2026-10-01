const logger = require('../config/logger');

/**
 * Middleware that logs API response time for every request.
 * Non-blocking — uses the `finish` event on the response.
 * Does NOT log sensitive data (no body, no auth headers).
 */
const requestTimer = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(
      `api:response method=${req.method} path=${req.originalUrl} status=${res.statusCode} duration=${durationMs.toFixed(1)}ms`
    );
  });

  next();
};

module.exports = { requestTimer };
