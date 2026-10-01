const express = require('express');
const router = express.Router();
const {
  getAllJobs,
  getClosedJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  bulkDeleteJobs,
  getRecommendedJobs,
  getJobDetailsContext,
  exportJobs,
} = require('../controllers/jobController');
const {
  authenticate,
  authorize,
  authorizeWithPermission,
  checkPermission,
} = require('../middleware/auth');
const upload = require('../middleware/upload');
const logoUpload = require('../middleware/logoUpload');
const { statusUpdateLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { adminSchemas } = require('../validators/schemas');
const jobAttachmentRoutes = require('./jobAttachmentRoutes');

router.use('/:jobId/attachments', jobAttachmentRoutes);

router.get(
  '/',
  authenticate,
  authorizeWithPermission(['student', 'hr'], 'jobs', 'read'),
  getAllJobs
);
router.get(
  '/closed',
  authenticate,
  authorize('student'),
  getClosedJobs
);
router.get(
  '/recommended',
  authenticate,
  authorize('student'),
  getRecommendedJobs
);
router.get(
  '/:id/context',
  authenticate,
  authorize('student'),
  getJobDetailsContext
);
router.get('/:id', authenticate, authorizeWithPermission(['student', 'hr'], 'jobs', 'read'), getJobById);

router.post(
  '/export',
  authenticate,
  checkPermission('jobs', 'read'),
  validate(adminSchemas.exportJobs),
  statusUpdateLimiter,
  exportJobs
);

router.post('/', authenticate, checkPermission('jobs', 'write'), statusUpdateLimiter, logoUpload.single('logo'), createJob);
router.put('/:id', authenticate, checkPermission('jobs', 'write'), statusUpdateLimiter, logoUpload.single('logo'), updateJob);
router.post('/bulk-delete', authenticate, checkPermission('jobs', 'write'), statusUpdateLimiter, bulkDeleteJobs);
router.delete('/:id', authenticate, checkPermission('jobs', 'write'), statusUpdateLimiter, deleteJob);

module.exports = router;
