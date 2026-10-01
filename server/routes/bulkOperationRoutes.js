const express = require('express');
const router = express.Router();
const bulkOperationController = require('../controllers/bulkOperationController');
const { bulkOperationLimiter } = require('../middleware/rateLimiter');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/:id', protect, adminOnly, bulkOperationLimiter, bulkOperationController.getBulkOperationById);
router.post('/:id/retry', protect, adminOnly, bulkOperationLimiter, bulkOperationController.retryBulkOperation);

module.exports = router;
