require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const Application = require('../models/Application');
const SavedJob = require('../models/SavedJob');
const logger = require('../config/logger');
const { releaseSnapshotsForApplications } = require('../services/resumeFileService');

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    logger.error('MONGO_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  logger.info('Connected to MongoDB');

  // Step 1: Backfill normalizedTitle on all jobs that don't have it
  const jobsWithoutNormalized = await Job.find({
    $or: [
      { normalizedTitle: { $exists: false } },
      { normalizedTitle: null },
      { normalizedTitle: '' },
    ],
  });

  logger.info(`[Step 1] ${jobsWithoutNormalized.length} jobs need normalizedTitle backfill`);

  for (const job of jobsWithoutNormalized) {
    job.normalizedTitle = (job.title || '').trim().toLowerCase();
    await job.save({ validateBeforeSave: false });
  }

  if (jobsWithoutNormalized.length > 0) {
    logger.info(`[Step 1] Backfilled ${jobsWithoutNormalized.length} jobs`);
  }

  // Step 2: Find duplicates (same companyId + normalizedTitle among non-deleted jobs)
  const duplicates = await Job.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: { companyId: '$companyId', normalizedTitle: '$normalizedTitle' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
        createdAts: { $push: '$createdAt' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (duplicates.length === 0) {
    logger.info('[Step 2] No duplicate jobs found. Database is clean.');
    await mongoose.disconnect();
    return;
  }

  logger.info(`[Step 2] Found ${duplicates.length} duplicate groups`);

  let totalDeleted = 0;

  for (const group of duplicates) {
    const { ids } = group;
    const title = group._id.normalizedTitle;

    // Keep the most recent one (last in ids since $push preserves order, but let's sort to be safe)
    const jobs = await Job.find({ _id: { $in: ids } })
      .sort({ createdAt: -1 })
      .lean();

    const keepId = jobs[0]._id;
    const removeIds = jobs.slice(1).map((j) => j._id);

    logger.info(
      `"${title}" - keeping ${keepId}, removing ${removeIds.length} duplicate(s)`
    );

    // Delete orphaned applications and saved jobs for the duplicates
    const applicationsToDelete = await Application.find({ job: { $in: removeIds } }).select('snapshotId').lean();
    const validApps = applicationsToDelete.filter(app => app.snapshotId);
    if (validApps.length) {
      await releaseSnapshotsForApplications(validApps);
    }
    
    await Application.deleteMany({ job: { $in: removeIds } });
    await SavedJob.deleteMany({ job: { $in: removeIds } });
    await Job.deleteMany({ _id: { $in: removeIds } });

    totalDeleted += removeIds.length;
  }

  logger.info(`[Done] Removed ${totalDeleted} duplicate jobs and their related data.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  logger.error(err.stack || err.message || 'Migration failed');
  process.exit(1);
});
