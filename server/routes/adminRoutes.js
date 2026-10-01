const express = require('express');
const router = express.Router();
const {
  getConfig,
  updateConfig,
  createCompany,
  createHr,
  createStaff,
  getAllStaff,
  updateStaffPermissions,
  getAllStudents,
  updateStudentDetails,
  updateStudentSchool,
  deleteStudent,
  bulkDeleteStudents,
  getAllHrs,
  updateStaffStatus,
  resetStaffPassword,
  deleteStaff,
  updateHrStatus,
  resetHrPassword,
  deleteHr,
  getBlocklistV2,
  addToBlocklist,
  updateBlocklistStatus,
  removeFromBlocklist,
  getDashboardStats,
  cleanupSnapshots,
  uploadWhitelistCsv,
  addManualWhitelist,
  removeManualWhitelist,
  getWhitelistStatus,
  getWhitelistDbStats,
  getWhitelistDbList,
  bulkDeleteWhitelist,
  exportStudents,
  getNotificationHealth
} = require('../controllers/adminController');
const { changePassword } = require('../controllers/authController');
const {
  getAllApplicants,
  updateApplicationStatusWithEmail,
} = require('../controllers/applicationController');
const { exportStudentApplications } = require('../controllers/applicationExportController');
const { createJob } = require('../controllers/jobController');
const blocklistCsvController = require('../controllers/blocklistCsvController');
const blocklistExportController = require('../controllers/blocklistExportController');
const Config = require('../models/Config');
const { protect, authorize, adminOnly, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/upload');
const logoUpload = require('../middleware/logoUpload');
const csvUploadMiddleware = require('../middleware/csvUploadMiddleware');
const validate = require('../middleware/validate');
const { adminSchemas, applicationSchemas, authSchemas } = require('../validators/schemas');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { createAuditLog } = require('../utils/audit');
const { successResponse } = require('../utils/response');
const { adminRouteLimiter } = require('../middleware/rateLimiter');

const serializeConfig = (config) => ({
  registrationEnabled: config.registrationEnabled !== false,
  domainRestrictionEnabled: config.domainRestrictionEnabled === true,
  yearRestrictionEnabled: config.yearRestrictionEnabled === true,
  allowedDomains: Array.isArray(config.allowedDomains) ? config.allowedDomains : [],
  allowedYears: Array.isArray(config.allowedYears) ? config.allowedYears : [],
  updatedAt: config.updatedAt,
});

const requireConfigAdmin = (req) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Access denied', 403);
  }
};

const parseBoolean = (body, fieldName) => {
  if (typeof body?.[fieldName] !== 'boolean') {
    throw new AppError(`${fieldName} must be a boolean`, 400);
  }

  return body[fieldName];
};

const normalizeYearsForRoute = (years) => {
  try {
    return Config.normalizeAllowedYears(years);
  } catch (error) {
    throw new AppError(error.message, 400);
  }
};

const normalizeDomainsForRoute = (domains) => {
  try {
    return Config.normalizeAllowedDomains(domains);
  } catch (error) {
    throw new AppError(error.message, 400);
  }
};

const updateConfigForRoute = async (updates) => {
  try {
    return await Config.updateGlobalConfig(updates);
  } catch (error) {
    throw new AppError(error.message, 400);
  }
};

const preventEmptyDomainLockout = (domainRestrictionEnabled, allowedDomains) => {
  if (domainRestrictionEnabled === true && allowedDomains.length === 0) {
    throw new AppError(
      'At least one allowed domain is required when domain restriction is enabled',
      400
    );
  }
};

const auditRegistrationConfigUpdate = async (req, config) => {
  const configSnapshot = serializeConfig(config);

  await createAuditLog({
    action: 'UPDATE_REGISTRATION_CONFIG',
    req,
    performedBy: req.user._id,
    performedByEmail: req.user.email || req.user.username || '',
    performedByRole: req.user.role,
    metadata: {
      registrationEnabled: configSnapshot.registrationEnabled,
      domainRestrictionEnabled: configSnapshot.domainRestrictionEnabled,
      yearRestrictionEnabled: configSnapshot.yearRestrictionEnabled,
      allowedDomains: configSnapshot.allowedDomains,
      allowedYears: configSnapshot.allowedYears,
    },
    timestamp: new Date(),
  });
};

router.use(adminRouteLimiter);

router.get('/dashboard', protect, adminOnly, getDashboardStats);
router.get('/notifications/health', protect, adminOnly, getNotificationHealth);
router.get('/config', protect, adminOnly, getConfig);


router.patch('/config', protect, adminOnly, updateConfig);
router.put('/config', protect, adminOnly, validate(adminSchemas.updateConfig), updateConfig);
router.patch('/config/registration', protect, adminOnly, updateConfig);
router.patch('/config/domain-toggle', protect, adminOnly, updateConfig);
router.patch('/config/year-restriction-toggle', protect, adminOnly, updateConfig);
router.patch('/config/domains', protect, adminOnly, updateConfig);
router.patch('/config/years', protect, adminOnly, updateConfig);

router.post('/create-company', protect, adminOnly, validate(adminSchemas.createCompany), createCompany);
router.post('/create-hr', protect, checkPermission('accessControl', 'write'), validate(adminSchemas.createHr), createHr);
router.get('/staff', protect, adminOnly, getAllStaff);
router.post('/staff/create', protect, adminOnly, createStaff);
router.patch('/staff/permissions', protect, adminOnly, updateStaffPermissions);
router.post('/staff/reset-password', protect, adminOnly, resetStaffPassword);
router.patch('/staff/block', protect, adminOnly, updateStaffStatus);
router.delete('/staff/delete', protect, adminOnly, deleteStaff);
router.delete('/staff/:id', protect, adminOnly, deleteStaff);
router.post('/create-job', protect, checkPermission('jobs', 'write'), logoUpload.single('logo'), createJob);
router.put('/change-password', protect, adminOnly, validate(authSchemas.changePassword), changePassword);
router.get('/students', protect, checkPermission('users', 'read'), getAllStudents);
router.post('/students/export', protect, checkPermission('users', 'read'), validate(adminSchemas.exportStudents), exportStudents);
router.post('/applications/export', protect, checkPermission('applications', 'read'), validate(adminSchemas.exportApplications), exportStudentApplications);
router.put('/students/:id', protect, checkPermission('users', 'write'), validate(adminSchemas.updateStudent), updateStudentDetails);
router.post('/students/bulk-delete', protect, checkPermission('users', 'write'), bulkDeleteStudents);
router.put('/students/:id/school', protect, checkPermission('users', 'write'), updateStudentSchool);
router.delete('/students/:id', protect, checkPermission('users', 'write'), deleteStudent);
router.get('/all-applicants', protect, checkPermission('applications', 'read'), getAllApplicants);
router.put('/update-status', protect, checkPermission('applications', 'write'), validate(applicationSchemas.updateStatus), updateApplicationStatusWithEmail);

router.get('/hr', protect, checkPermission('accessControl', 'read'), getAllHrs);
router.put('/hr/:id/status', protect, checkPermission('accessControl', 'write'), updateHrStatus);
router.post('/hr/:id/reset-password', protect, checkPermission('accessControl', 'write'), resetHrPassword);
router.delete('/hr/:id', protect, checkPermission('accessControl', 'write'), deleteHr);

router.get('/blocklist-v2', protect, checkPermission('accessControl', 'read'), getBlocklistV2);
router.post('/access-control', protect, checkPermission('accessControl', 'write'), addToBlocklist);
router.put('/access-control/:id/status', protect, checkPermission('accessControl', 'write'), updateBlocklistStatus);
router.delete('/access-control/:id', protect, checkPermission('accessControl', 'write'), removeFromBlocklist);
router.post('/blocklist/csv/preview', protect, checkPermission('accessControl', 'write'), csvUploadMiddleware.single('file'), blocklistCsvController.previewCsv);
router.post('/blocklist/csv/execute', protect, checkPermission('accessControl', 'write'), csvUploadMiddleware.single('file'), blocklistCsvController.executeCsv);
router.get('/blocklist/export', protect, checkPermission('accessControl', 'read'), blocklistExportController.exportBlocklistExcel);
router.post('/cleanup-snapshots', protect, adminOnly, cleanupSnapshots);

router.post('/whitelist/upload', protect, adminOnly, upload.single('file'), uploadWhitelistCsv);
router.delete('/whitelist/bulk-delete', protect, adminOnly, bulkDeleteWhitelist);
router.post('/whitelist/manual-add', protect, adminOnly, addManualWhitelist);
router.post('/whitelist/manual-remove', protect, adminOnly, removeManualWhitelist);
router.get('/whitelist/status', protect, adminOnly, getWhitelistStatus);
router.get('/whitelist/db-stats', protect, adminOnly, getWhitelistDbStats);
router.get('/whitelist/db-list', protect, adminOnly, getWhitelistDbList);

module.exports = router;

