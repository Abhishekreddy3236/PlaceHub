const express = require('express');
const router = express.Router();
const {
  applyToJob,
  applyToJobByBody,
  getMyApplications,
  checkApplication,
  getJobApplicants,
  getAllApplicants,
  getCompanyApplicants,
  updateApplicationStatus,
  bulkUpdateApplicationStatus,
  getAdminStats,
  downloadApplicationResume,
  bulkAction,
  exportJobApplicants,
  markApplicationsAsRead,
} = require('../controllers/applicationController');
const { uploadCsvAndUpdateStatus, executeCsvStatusUpdate } = require('../controllers/applicationCsvController');
const {
  authenticate,
  protect,
  authorize,
  authorizeWithPermission,
  checkPermission,
  hrCompanyOnly,
} = require('../middleware/auth');
const validate = require('../middleware/validate');
const { applicationSchemas } = require('../validators/schemas');
const { applyJobLimiter, statusUpdateLimiter, bulkOperationLimiter, resumeDownloadLimiter, csvStatusLimiter } = require('../middleware/rateLimiter');
const csvUploadMiddleware = require('../middleware/csvUploadMiddleware');

router.post('/apply', authenticate, authorize('student'), applyJobLimiter, validate(applicationSchemas.apply), applyToJobByBody);
router.post('/:jobId/apply', authenticate, authorize('student'), applyJobLimiter, applyToJob);
router.get(
  '/my',
  authenticate,
  authorize('student'),
  getMyApplications
);
router.get('/check/:jobId', authenticate, authorize('student'), checkApplication);
router.patch('/read', authenticate, authorize('student'), markApplicationsAsRead);

router.get(
  '/admin/stats',
  authenticate,
  checkPermission('applications', 'read'),
  getAdminStats
);
router.get(
  '/admin/all',
  authenticate,
  checkPermission('applications', 'read'),
  getAllApplicants
);
router.get(
  '/admin/job/:jobId',
  authenticate,
  checkPermission('applications', 'read'),
  getJobApplicants
);

router.post(
  '/admin/job/:jobId/export',
  authenticate,
  authorizeWithPermission(['admin', 'hr'], 'applications', 'read'),
  validate(applicationSchemas.exportJobApplicants),
  exportJobApplicants
);

router.get(
  '/:id/resume',
  authenticate,
  resumeDownloadLimiter,
  authorizeWithPermission(['student', 'hr'], 'applications', 'read'),
  downloadApplicationResume
);
router.put(
  '/:id/status',
  authenticate,
  authorizeWithPermission(['admin', 'hr'], 'applications', 'write'),
  statusUpdateLimiter,
  validate(applicationSchemas.updateStatus),
  updateApplicationStatus
);
router.post(
  '/bulk-update',
  authenticate,
  authorizeWithPermission(['admin', 'hr'], 'applications', 'write'),
  bulkOperationLimiter,
  validate(applicationSchemas.bulkUpdate),
  bulkUpdateApplicationStatus
);

router.post(
  '/csv/preview',
  authenticate,
  authorizeWithPermission(['admin', 'hr'], 'applications', 'write'),
  csvStatusLimiter,
  csvUploadMiddleware.single('file'),
  uploadCsvAndUpdateStatus // Using same skeleton for now
);

router.post(
  '/csv/execute',
  authenticate,
  authorizeWithPermission(['admin', 'hr'], 'applications', 'write'),
  csvStatusLimiter,
  csvUploadMiddleware.single('file'),
  executeCsvStatusUpdate
);

router.post('/bulk-action', protect, authorizeWithPermission(['admin', 'hr'], 'applications', 'write'), bulkOperationLimiter, bulkAction);



router.get(
  '/hr/applicants',
  authenticate,
  authorize('hr'),
  hrCompanyOnly,
  getCompanyApplicants
);

module.exports = router;
