const express = require('express');
const router = express.Router();
const {
  addProfileLink,
  deleteProfileLink,
  getApplicationReadiness,
  updateProfileLink,
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { profileWriteLimiter } = require('../middleware/profileRateLimits');
const validate = require('../middleware/validate');
const { userSchemas } = require('../validators/schemas');

router.get('/application-readiness', authenticate, authorize('student'), getApplicationReadiness);
router.post('/link', authenticate, authorize('student'), profileWriteLimiter, validate(userSchemas.profileLink), addProfileLink);
router.put(
  '/link/:id',
  authenticate,
  authorize('student'),
  profileWriteLimiter,
  validate(userSchemas.profileLinkParams, 'params'),
  validate(userSchemas.profileLink),
  updateProfileLink
);
router.delete(
  '/link/:id',
  authenticate,
  authorize('student'),
  profileWriteLimiter,
  validate(userSchemas.profileLinkParams, 'params'),
  deleteProfileLink
);

module.exports = router;
