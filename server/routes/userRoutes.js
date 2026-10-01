const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  deleteResume,
  getMyResume,
} = require('../controllers/userController');
const { authenticate, authorize, protect } = require('../middleware/auth');
const { profileWriteLimiter } = require('../middleware/profileRateLimits');
const { uploadLimiter } = require('../middleware/rateLimiter');

const validate = require('../middleware/validate');
const { userSchemas } = require('../validators/schemas');
const AppError = require('../utils/AppError');

const blockHrFromUsers = (req, res, next) => {
  if (req.user?.role === 'hr') {
    next(new AppError('HR accounts cannot access user profile APIs', 403));
    return;
  }

  next();
};

router.use(authenticate, blockHrFromUsers);

router.get('/profile', getProfile);
router.put('/profile', authorize('student'), profileWriteLimiter, validate(userSchemas.updateProfile), updateProfile);
router.delete('/resumes/:id', authorize('student'), deleteResume);

router.get('/me/resume', protect, getMyResume);


module.exports = router;
