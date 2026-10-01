const express = require('express');
const router = express.Router();
const {
  saveJob,
  unsaveJob,
  getSavedJobs,
  checkSaved,
} = require('../controllers/savedJobController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('student'), getSavedJobs);
router.get('/check/:jobId', authenticate, authorize('student'), checkSaved);
router.post('/:jobId', authenticate, authorize('student'), saveJob);
router.delete('/:jobId', authenticate, authorize('student'), unsaveJob);

module.exports = router;
