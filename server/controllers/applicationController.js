const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { collectionResponse, successResponse } = require('../utils/response');
const applicationService = require('../services/applicationService');
const Application = require('../models/Application');
const BulkOperation = require('../models/BulkOperation');
const crypto = require('crypto');
const r2Service = require('../services/r2Service');
const features = require('../config/features');

const enforceHrJobAccess = (user, jobId) => {
  if (user && user.role === "hr") {
    const hrJobId = String(user.jobId?._id || user.jobId);
    const targetJobId = String(jobId?._id || jobId);
    if (hrJobId !== targetJobId) {
      throw new AppError("Unauthorized", 403);
    }
  }
};

exports.applyToJob = asyncHandler(async (req, res) => {
  const result = await applicationService.applyToJob(req);
  successResponse(res, result);
});

exports.applyToJobByBody = exports.applyToJob;

exports.getMyApplications = asyncHandler(async (req, res) => {
  const result = await applicationService.getMyApplications(req);
  successResponse(res, result);
});

exports.checkApplication = asyncHandler(async (req, res) => {
  const result = await applicationService.checkApplication(req);
  successResponse(res, result);
});

exports.getJobApplicants = asyncHandler(async (req, res) => {
  const result = await applicationService.getJobApplicants(req);
  successResponse(res, result);
});

exports.exportJobApplicants = asyncHandler(async (req, res) => {
  const { buffer, filename } = await applicationService.exportJobApplicants(req);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  let asciiFilename = filename.replace(/[^\x20-\x7E]/g, ''); // Safe ASCII fallback
  if (!asciiFilename.trim()) {
    asciiFilename = 'Applicants.xlsx';
  }
  const encodedFilename = encodeURIComponent(filename);
  res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  res.status(200).send(buffer);
});

exports.getAllApplicants = asyncHandler(async (req, res) => {
  if (!features.GLOBAL_APPLICANTS_ENABLED) {
    return res.status(404).json({
      success: false,
      message: "Not Found"
    });
  }

  const result = await applicationService.getAllApplicants(req);
  successResponse(res, result);
});

exports.getCompanyApplicants = asyncHandler(async (req, res) => {
  const result = await applicationService.getCompanyApplicants(req);
  successResponse(res, result);
});

exports.updateApplicationStatus = asyncHandler(async (req, res) => {
  const { expectedRound, expectedStatus } = req.body;
  const result = await applicationService.updateApplicationStatus(req, expectedRound, expectedStatus);
  successResponse(res, result);
});

exports.updateApplicationStatusWithEmail = exports.updateApplicationStatus;

exports.bulkUpdateApplicationStatus = asyncHandler(async (req, res) => {
  const { expectedRound, expectedStatus } = req.body;
  const result = await applicationService.bulkUpdateApplicationStatus(req, expectedRound, expectedStatus);
  successResponse(res, result);
});

exports.getAdminStats = asyncHandler(async (req, res) => {
  const result = await applicationService.getAdminStats(req);
  successResponse(res, result);
});

exports.downloadApplicationResume = asyncHandler(async (req, res) => {
  const { resumeUrl, filename } = await applicationService.downloadApplicationResume(req);
  if (req.query.mode === 'json') {
    return successResponse(res, { data: { resumeUrl, filename } });
  }
  return res.redirect(resumeUrl);
});



exports.bulkAction = async (req, res, next) => {
  let operation;
  try {
    const { applicants, action } = req.body;

    if (!applicants || !Array.isArray(applicants) || applicants.length === 0 || applicants.length > 100) {
      throw new AppError("Validation error", 400);
    }

    const ids = applicants.map(a => a.id);

    const allowedActions = ['SHORTLIST', 'SELECT', 'REJECT'];
    if (!allowedActions.includes(action)) {
      throw new AppError("Validation error", 400);
    }

    const sortedIds = ids
      .filter(id => id && typeof id.toString === 'function')
      .map(id => id.toString())
      .sort();

    const datasetHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ ids: sortedIds, action }))
      .digest('hex');

    const existing = await BulkOperation.findOne({
      datasetHash,
      status: 'IN_PROGRESS'
    });

    if (existing) {
      return successResponse(res, {
        data: {
          operationId: existing._id,
          updatedCount: 0,
          attemptedCount: 0,
          failedItems: []
        }
      });
    }

    operation = await BulkOperation.create({
      type: "BULK_ACTION",
      action,
      status: "IN_PROGRESS",
      total: ids.length,
      processed: 0,
      success: 0,
      failed: 0,
      failedItems: [],
      datasetHash,
      createdBy: req.user._id
    });

    const { validIds, failedItems, updatedCount } = await exports.processBulkActionLogic(applicants, action, req);

    operation.processed = validIds.length + failedItems.length;
    operation.failed = failedItems.length;
    operation.success = validIds.length;

    const dbFailures = validIds.length - updatedCount;

    operation.failed = failedItems.length + dbFailures;
    operation.success = updatedCount;
    operation.failedItems = failedItems;
    operation.status = "COMPLETED";
    await operation.save();

    const attemptedCount = validIds.length;

    successResponse(res, {
      data: {
        operationId: operation._id,
        updatedCount,
        attemptedCount,
        failedItems
      }
    });
  } catch (err) {
    if (operation) {
      operation.status = "FAILED";
      await operation.save();
    }
    return next(err);
  }
};

exports.processBulkActionLogic = async (applicants, action, req) => {
  const ids = applicants.map(a => a.id);
  const filter = {
    _id: { $in: ids }
  };

  if (req?.user?.role === 'hr') {
    const hrJobId = req.user.jobId?._id || req.user.jobId;
    if (hrJobId) {
      filter.jobId = hrJobId;
    }
  }

  const applications = await Application.find(filter).populate({
    path: 'jobId',
    select: 'rounds title companyId',
    populate: {
      path: 'companyId',
      select: 'name'
    }
  }).lean();
  const validIds = [];
  const failedItems = [];

  const appMap = new Map(
    applications.map(a => [a._id.toString(), a])
  );

  const expectedStateMap = new Map(
    applicants.map(a => [a.id.toString(), { expectedRound: a.expectedRound, expectedStatus: a.expectedStatus }])
  );

  for (const id of ids) {
    const app = appMap.get(id.toString());
    if (!app) {
      failedItems.push({ id, reason: "Application not found" });
      continue;
    }

    try {
      enforceHrJobAccess(req.user, app.jobId);
    } catch (err) {
      failedItems.push({ id, reason: "Unauthorized" });
      continue;
    }

    const status = app.status?.toLowerCase();

    if (status === 'selected' || status === 'rejected') {
      failedItems.push({ id, reason: "Terminal state" });
      continue;
    }

    if (status !== 'in_progress') {
      failedItems.push({ id, reason: "Not in progress" });
      continue;
    }

    const currentRound = Number(app.currentRound) || 1;
    if (!app.jobId || !Array.isArray(app.jobId.rounds)) {
      failedItems.push({ id, reason: "Invalid job configuration" });
      continue;
    }

    const maxRounds = app.jobId.rounds.length;

    if (action === 'SHORTLIST') {
      if (currentRound < maxRounds) {
        validIds.push(id);
      } else {
        failedItems.push({ id, reason: "Already at max round" });
      }
    } else if (action === 'SELECT') {
      if (currentRound === maxRounds) {
        validIds.push(id);
      } else {
        failedItems.push({ id, reason: "Not at final round" });
      }
    } else if (action === 'REJECT') {
      validIds.push(id);
    }
  }

  let updatedCount = 0;

  if (validIds.length > 0) {
    if (action === 'REJECT') {
      let hrJobId = null;
      if (req?.user?.role === 'hr') {
        hrJobId = req.user.jobId?._id || req.user.jobId;
      }

      const bulkOps = validIds.map(id => {
        const expectedState = expectedStateMap.get(id.toString());
        const filter = {
          _id: id,
          status: expectedState.expectedStatus,
          currentRound: expectedState.expectedRound
        };
        if (hrJobId) filter.jobId = hrJobId;

        return {
          updateOne: {
            filter,
            update: { $set: { status: 'rejected', hasUnreadUpdate: true, rejectedAtRound: expectedState.expectedRound } }
          }
        };
      });

      const updateResult = await Application.bulkWrite(bulkOps);
      updatedCount = updateResult.modifiedCount || 0;
    } else {
      const grouped = {};

      for (const id of validIds) {
        const app = appMap.get(id.toString());
        const maxRounds = app.jobId.rounds.length;

        if (!grouped[maxRounds]) grouped[maxRounds] = [];
        grouped[maxRounds].push(id);
      }

      if (action === 'SHORTLIST') {
        for (const [maxRounds, idsGroup] of Object.entries(grouped)) {
          let hrJobId = null;
          if (req?.user?.role === 'hr') {
            hrJobId = req.user.jobId?._id || req.user.jobId;
          }

          const bulkOps = idsGroup.map(id => {
            const expectedState = expectedStateMap.get(id.toString());
            const filter = {
              _id: id,
              status: expectedState.expectedStatus,
              currentRound: expectedState.expectedRound
            };
            if (hrJobId) filter.jobId = hrJobId;

            return {
              updateOne: {
                filter,
                update: { $inc: { currentRound: 1 }, $set: { hasUnreadUpdate: true } }
              }
            };
          });

          const updateResult = await Application.bulkWrite(bulkOps);
          updatedCount += (updateResult.modifiedCount || 0);
        }
      } else if (action === 'SELECT') {
        for (const [maxRounds, idsGroup] of Object.entries(grouped)) {
          let hrJobId = null;
          if (req?.user?.role === 'hr') {
            hrJobId = req.user.jobId?._id || req.user.jobId;
          }

          const bulkOps = idsGroup.map(id => {
            const expectedState = expectedStateMap.get(id.toString());
            const filter = {
              _id: id,
              status: expectedState.expectedStatus,
              currentRound: expectedState.expectedRound
            };
            if (hrJobId) filter.jobId = hrJobId;

            return {
              updateOne: {
                filter,
                update: { $set: { status: 'selected', hasUnreadUpdate: true } }
              }
            };
          });

          const updateResult = await Application.bulkWrite(bulkOps);
          updatedCount += (updateResult.modifiedCount || 0);
        }
      }
    }
  }

  return { validIds, failedItems, updatedCount };
};

exports.markApplicationsAsRead = asyncHandler(async (req, res) => {
  await applicationService.markApplicationsAsRead(req.user._id);
  successResponse(res, { message: 'Applications marked as read' });
});
