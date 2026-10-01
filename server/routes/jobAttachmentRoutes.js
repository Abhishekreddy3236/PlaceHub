const express = require('express');
const { validationResult } = require('express-validator');
const router = express.Router({ mergeParams: true });

const jobAttachmentController = require('../controllers/jobAttachmentController');
const { authenticate } = require('../middleware/auth');
const { canManageAttachments, canViewAttachments } = require('../middleware/jobAttachmentAuthorization');
const { validateJobIdParam, validateAttachmentIdParam, validateCompleteUpload } = require('../validators/jobAttachmentValidator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.use(authenticate);
router.use(validateJobIdParam, handleValidationErrors);

// Admin/Staff with jobs.write
router.post('/upload-url', canManageAttachments, jobAttachmentController.getUploadUrl);
router.post('/complete', canManageAttachments, validateCompleteUpload, handleValidationErrors, jobAttachmentController.completeUpload);
router.delete('/:attachmentId', canManageAttachments, validateAttachmentIdParam, handleValidationErrors, jobAttachmentController.deleteAttachment);

// Viewers (Admin, Staff, or Eligible Students)
router.get('/', canViewAttachments, jobAttachmentController.getAttachments);
router.get('/:attachmentId/download', canViewAttachments, validateAttachmentIdParam, handleValidationErrors, jobAttachmentController.downloadAttachment);

module.exports = router;
