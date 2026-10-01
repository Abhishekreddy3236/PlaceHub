const asyncHandler = require('../utils/asyncHandler');
const { collectionResponse, successResponse } = require('../utils/response');
const adminService = require('../services/adminService');
const mongoose = require('mongoose');
const BulkOperation = require('../models/BulkOperation');
const User = require('../models/User');
const Application = require('../models/Application');
const SavedJob = require('../models/SavedJob');
const Resume = require('../models/Resume');
const NotificationJob = require('../models/NotificationJob');
const PushSubscription = require('../models/PushSubscription');
const Notification = require('../models/Notification');
const r2Service = require('../services/r2Service');
const configService = require('../services/configService');
const { releaseSnapshotsForApplications } = require('../services/resumeFileService');
const { canonicalizeEmail } = require('../utils/emailCanonicalization');

exports.getConfig = asyncHandler(async (req, res) => {
  const config = await configService.getConfig();
  successResponse(res, {
    message: 'Registration config fetched successfully',
    data: config
  });
});

exports.updateConfig = asyncHandler(async (req, res) => {
  const updated = await configService.updateConfig(req.body);

  successResponse(res, {
    message: 'Configuration updated successfully',
    data: updated
  });
});

exports.createCompany = asyncHandler(async (req, res) => {
  const result = await adminService.createCompany(req);
  successResponse(res, result);
});

exports.createHr = asyncHandler(async (req, res) => {
  const result = await adminService.createHr(req);
  successResponse(res, result);
});

exports.createStaff = asyncHandler(async (req, res) => {
  const result = await adminService.createStaff(req);
  successResponse(res, result);
});

exports.getAllStaff = asyncHandler(async (req, res) => {
  const result = await adminService.getAllStaff(req);
  successResponse(res, result);
});

exports.updateStaffPermissions = asyncHandler(async (req, res) => {
  const result = await adminService.updateStaffPermissions(req);
  successResponse(res, result);
});

exports.resetStaffPassword = asyncHandler(async (req, res) => {
  const result = await adminService.resetStaffPassword(req);
  successResponse(res, result);
});

exports.updateStaffStatus = asyncHandler(async (req, res) => {
  const result = await adminService.updateStaffStatus(req);
  successResponse(res, result);
});

exports.deleteStaff = asyncHandler(async (req, res) => {
  const result = await adminService.deleteStaff(req);
  successResponse(res, result);
});

exports.getAllStudents = asyncHandler(async (req, res) => {
  const result = await adminService.getAllStudents(req);
  collectionResponse(req, res, result);
});

exports.exportStudents = asyncHandler(async (req, res) => {
  const { buffer, filename } = await adminService.exportStudents(req);
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  return res.send(buffer);
});

exports.updateStudentDetails = asyncHandler(async (req, res) => {
  const result = await adminService.updateStudentDetails(req);
  successResponse(res, result);
});

exports.deleteStudent = asyncHandler(async (req, res) => {
  const result = await adminService.deleteStudent(req);
  successResponse(res, result);
});

exports.bulkDeleteStudents = asyncHandler(async (req, res) => {
  const { ids, confirmText } = req.body;

  if (confirmText !== "DELETE_ALL_USERS_CONFIRM") {
    return res.status(400).json({ success: false, message: 'Invalid confirmation text' });
  }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid IDs provided' });
  }

  const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
  if (validIds.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid IDs provided' });
  }

  if (validIds.length > 50) {
    return res.status(400).json({ success: false, message: 'Maximum 50 students can be deleted at once' });
  }

  const sortedIds = validIds
    .map(id => id.toString())
    .sort();
  const datasetHash = require('crypto')
    .createHash('sha256')
    .update(JSON.stringify({ ids: sortedIds, type: 'DELETE' }))
    .digest('hex');

  const existing = await BulkOperation.findOne({
    datasetHash,
    status: 'IN_PROGRESS'
  });

  if (existing) {
    return res.json({
      success: true,
      operationId: existing._id
    });
  }

  const operation = await BulkOperation.create({
    type: "DELETE",
    status: "IN_PROGRESS",
    total: validIds.length,
    processed: 0,
    success: 0,
    failed: 0,
    datasetHash,
    failedItems: [],
    createdBy: req.user._id
  });

  res.json({
    success: true,
    operationId: operation._id
  });

  const idsCopy = [...validIds];
  const operationId = operation._id;

  setImmediate(async () => {
    let currentOp;
    try {
      const chunkSize = 20;

      for (let i = 0; i < idsCopy.length; i += chunkSize) {
        const chunkIds = idsCopy.slice(i, i + chunkSize);

        let successCount = 0;
        let failureCount = 0;
        const currentFailedItems = [];

        const session = await mongoose.startSession();
        let chunkSnapshotPaths = [];
        let chunkStudentResumes = [];

        try {
          const resumesToDelete = await Resume.find({ userId: { $in: chunkIds } }).lean();
          const resumeKeys = resumesToDelete.map((r) => r.key).filter(Boolean);

          const applications = await Application.find({ student: { $in: chunkIds } })
            .select('_id snapshotId resumeSnapshot')
            .lean();
          chunkSnapshotPaths = applications.map((app) => app.resumeSnapshot?.key).filter(Boolean);

          await session.withTransaction(async () => {
            await Application.deleteMany({ student: { $in: chunkIds } }, { session });
            await SavedJob.deleteMany({ student: { $in: chunkIds } }, { session });
            await Resume.deleteMany({ userId: { $in: chunkIds } }, { session });
            await User.deleteMany({ _id: { $in: chunkIds }, role: 'student' }, { session });
            await PushSubscription.deleteMany({ userId: { $in: chunkIds } }, { session });
          });

          const validApps = applications.filter(app => app.snapshotId || app.resumeSnapshot?.key);
          if (validApps.length) {
            await releaseSnapshotsForApplications(validApps);
          }

          successCount = chunkIds.length;

          try {
            for (const key of resumeKeys) {
              await r2Service.deleteObject(key);
            }
          } catch (err) {
            const failedSet = new Set();
            chunkIds.forEach(id => {
              const key = id.toString();
              if (!failedSet.has(key)) {
                failedSet.add(key);
                currentFailedItems.push({
                  id,
                  reason: "Cloudflare R2 cleanup failed: " + err.message,
                  type: "STORAGE"
                });
              }
            });
          }

        } catch (dbError) {
          successCount = 0;
          failureCount = chunkIds.length;
          chunkIds.forEach(id => {
            currentFailedItems.push({ id, reason: "DB transaction failed: " + dbError.message });
          });
        } finally {
          session.endSession();
        }

        currentOp = await BulkOperation.findById(operationId);
        if (currentOp) {
          currentOp.processed += (successCount + failureCount);
          currentOp.success += successCount;
          currentOp.failed += failureCount;
          if (currentFailedItems.length > 0) {
            currentOp.failedItems.push(...currentFailedItems);
          }
          await currentOp.save();
        }
      }

      currentOp = await BulkOperation.findById(operationId);
      if (currentOp) {
        currentOp.status = "COMPLETED";
      }

    } catch (error) {
      console.error("Bulk delete async error:", error);
      currentOp = await BulkOperation.findById(operationId);
      if (currentOp) {
        currentOp.status = "FAILED";
        currentOp.failedItems.push({ id: "system", reason: "Fatal background error: " + error.message });
      }
    } finally {
      if (currentOp) {
        await currentOp.save();
      }
    }
  });
});

exports.getAllHrs = asyncHandler(async (req, res) => {
  const result = await adminService.getAllHrs(req);
  successResponse(res, result);
});

exports.updateStudentSchool = asyncHandler(async (req, res) => {
  const result = await adminService.updateStudentSchool(req);
  successResponse(res, result);
});

exports.updateHrStatus = asyncHandler(async (req, res) => {
  const result = await adminService.updateHrStatus(req);
  successResponse(res, result);
});

exports.resetHrPassword = asyncHandler(async (req, res) => {
  const result = await adminService.resetHrPassword(req);
  successResponse(res, result);
});

exports.deleteHr = asyncHandler(async (req, res) => {
  const result = await adminService.deleteHr(req);
  successResponse(res, result);
});

exports.getBlocklistV2 = asyncHandler(async (req, res) => {
  const result = await adminService.getBlocklistV2Service(req.query);
  res.json(result);
});

exports.addToBlocklist = asyncHandler(async (req, res) => {
  req.body.reason = req.body.reason || 'None';
  const result = await adminService.addToBlocklist(req);
  successResponse(res, result);
});

exports.updateBlocklistStatus = asyncHandler(async (req, res) => {
  const result = await adminService.updateBlocklistStatus(req);
  successResponse(res, result);
});

exports.removeFromBlocklist = asyncHandler(async (req, res) => {
  const result = await adminService.removeFromBlocklist(req);
  successResponse(res, result);
});

exports.getDashboardStats = asyncHandler(async (req, res) => {
  const result = await adminService.getDashboardStats(req);
  successResponse(res, result);
});

const path = require('path');
const { exec } = require('child_process');

exports.cleanupSnapshots = asyncHandler(async (req, res) => {
  const scriptPath = path.join(__dirname, '../scripts/cleanupSnapshots.js');

  exec(`node "${scriptPath}"`, (err, stdout, stderr) => {
    if (err) {
      console.error('GC execution failed:', err);
      return;
    }
    console.log(stdout);
  });

  return res.status(200).json({
    success: true,
    message: 'Snapshot cleanup job started in background',
  });
});

const whitelistAdminService = require('../services/whitelistAdminService');
const AppError = require('../utils/AppError');
exports.uploadWhitelistCsv = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) throw new AppError('name is required', 400);
  if (!req.file) throw new AppError('csv file is required', 400);

  const result = await whitelistAdminService.uploadSource(req.file.buffer, name);

  successResponse(res, { message: 'Whitelist CSV uploaded successfully', data: result });
});



exports.addManualWhitelist = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new AppError('email is required', 400);

  await whitelistAdminService.addManual(email);
  successResponse(res, { message: 'Email added to whitelist' });
});

exports.removeManualWhitelist = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new AppError('email is required', 400);

  await whitelistAdminService.removeManual(email);
  successResponse(res, { message: 'Email removed from whitelist' });
});

exports.getWhitelistStatus = asyncHandler(async (req, res) => {
  const result = await whitelistAdminService.getStatus();
  successResponse(res, { message: 'Whitelist status', data: result });
});

const WhitelistEmail = require('../models/WhitelistEmail');

exports.getWhitelistDbStats = asyncHandler(async (req, res) => {
  const totalEmails = await WhitelistEmail.countDocuments();
  const sampleEmails = await WhitelistEmail.find()
    .select('email createdAt')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  successResponse(res, {
    message: 'Whitelist DB Stats',
    data: {
      totalEmails,
      sampleEmails
    }
  });
});

exports.getWhitelistDbList = asyncHandler(async (req, res) => {
  const { search, page = 1 } = req.query;
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const skip = (Math.max(Number(page), 1) - 1) * limit;

  const query = {};
  if (search && typeof search === 'string') {
    const canonicalSearch = canonicalizeEmail(search);
    const safeSearch = canonicalSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.email = { $regex: new RegExp(safeSearch, 'i') };
  }

  const emails = await WhitelistEmail.find(query)
    .select('email createdAt')
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await WhitelistEmail.countDocuments(query);

  successResponse(res, {
    message: 'Whitelist DB List',
    data: {
      emails,
      pagination: {
        total,
        page: Number(page),
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  });
});

exports.bulkDeleteWhitelist = asyncHandler(async (req, res) => {
  const { emails } = req.body;

  if (!Array.isArray(emails) || emails.length === 0) {
    throw new AppError('Invalid input: emails array is required', 400);
  }

  if (emails.length > 50) {
    throw new AppError('Max 50 allowed', 400);
  }

  await WhitelistEmail.deleteMany({
    email: { $in: emails.map(e => canonicalizeEmail(e)) }
  });

  successResponse(res, {
    message: 'Whitelist emails deleted successfully'
  });
});

exports.getNotificationHealth = asyncHandler(async (req, res) => {
  const [
    pendingJobs,
    processingJobs,
    failedJobs,
    completedJobs,
    activeSubscriptions,
    inactiveSubscriptions,
    totalNotifications,
    unreadNotifications
  ] = await Promise.all([
    NotificationJob.countDocuments({ status: 'pending' }),
    NotificationJob.countDocuments({ status: 'processing' }),
    NotificationJob.countDocuments({ status: 'failed' }),
    NotificationJob.countDocuments({ status: 'completed' }),
    PushSubscription.countDocuments({ isActive: true }),
    PushSubscription.countDocuments({ isActive: false }),
    Notification.estimatedDocumentCount(),
    Notification.countDocuments({ isRead: false })
  ]);

  successResponse(res, {
    message: 'Notification health metrics retrieved successfully',
    data: {
      jobs: {
        pending: pendingJobs,
        processing: processingJobs,
        failed: failedJobs,
        completed: completedJobs
      },
      pushSubscriptions: {
        active: activeSubscriptions,
        inactive: inactiveSubscriptions
      },
      notifications: {
        total: totalNotifications,
        unread: unreadNotifications
      }
    }
  });
});
