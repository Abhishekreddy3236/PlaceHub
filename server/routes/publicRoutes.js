const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const { publicShareIpLimiter, publicShareTokenLimiter } = require('../middleware/rateLimiter');

router.get(
  '/application-share/:token',
  publicShareIpLimiter,
  publicShareTokenLimiter,
  publicController.handleResumeShare
);

module.exports = router;
