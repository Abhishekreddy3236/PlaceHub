const express = require('express');
const { getDashboardData } = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');
const { dashboardLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/dashboard-data', authenticate, authorize('student'), dashboardLimiter, getDashboardData);

module.exports = router;
