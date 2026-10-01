const express = require('express');
const router = express.Router();
const resumeR2Controller = require('../controllers/resumeR2Controller');
const { protect, authorize } = require('../middleware/auth');
const { resumeDownloadLimiter } = require('../middleware/rateLimiter');

router.use(protect);

router.post('/r2/generate-upload-url', authorize('student'), resumeR2Controller.generateUploadUrl);
router.post('/r2/confirm-upload', authorize('student'), resumeR2Controller.confirmUpload);
router.get('/:id', resumeDownloadLimiter, resumeR2Controller.getResumeById);
router.delete('/:id', authorize('student'), resumeR2Controller.deleteResume);

module.exports = router;
