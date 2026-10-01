const express = require('express');
const { protect } = require('../middleware/auth'); // Assume standard auth middleware
const notificationController = require('../controllers/notificationController');
const { validateSubscribe, validateObjectIdParam } = require('../validators/notificationValidator');
const { subscriptionLimiter, dashboardLimiter, statusUpdateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ALL notification routes require a valid JWT
router.use(protect);

router.post(
  '/subscribe',
  subscriptionLimiter,
  validateSubscribe,
  notificationController.subscribe
);

router.delete(
  '/unsubscribe',
  subscriptionLimiter,
  notificationController.unsubscribe
);

router.get(
  '/',
  dashboardLimiter,
  notificationController.getNotifications
);

router.put(
  '/read-all',
  statusUpdateLimiter,
  notificationController.markAllAsRead
);

router.put(
  '/:id/read',
  statusUpdateLimiter,
  validateObjectIdParam('id'),
  notificationController.markAsRead
);

module.exports = router;
