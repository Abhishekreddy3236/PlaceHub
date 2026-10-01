const crypto = require('crypto');
const ApplicationShareToken = require('../models/ApplicationShareToken');
const Application = require('../models/Application');
const Job = require('../models/Job');
const r2Service = require('./r2Service');
const AppError = require('../utils/AppError');

exports.generateTokensBulk = async (applications, daysValid, createdBy) => {
  const tokens = [];
  const operations = [];
  const now = new Date();

  // Calculate expiration date
  const expiresAt = new Date(now.getTime() + daysValid * 24 * 60 * 60 * 1000);

  for (const app of applications) {
    if (!app.resumeSnapshot || !app.resumeSnapshot.key) {
      continue; // Skip applications without a resume snapshot
    }

    const token = crypto.randomBytes(32).toString('hex');

    tokens.push({
      applicationId: app._id.toString(),
      token
    });

    operations.push({
      insertOne: {
        document: {
          token,
          applicationId: app._id,
          jobId: app.jobId._id || app.jobId,
          createdBy,
          expiresAt,
          status: 'active',
          createdAt: now,
        }
      }
    });
  }

  if (operations.length > 0) {
    await ApplicationShareToken.bulkWrite(operations);
  }


  const tokenMap = {};
  for (const t of tokens) {
    tokenMap[t.applicationId] = t.token;
  }

  return tokenMap;
};

exports.resolveTokenToSignedUrl = async (token) => {
  const shareToken = await ApplicationShareToken.findOne({
    token,
    status: 'active'
  });

  if (!shareToken) {
    throw new AppError('Resume link is invalid or has expired', 404);
  }

  if (shareToken.expiresAt < new Date()) {
    throw new AppError('Resume link is invalid or has expired', 404);
  }

  const application = await Application.findById(shareToken.applicationId).lean();

  if (!application) {
    throw new AppError('Application not found', 404);
  }

  const job = await Job.findById(shareToken.jobId).lean();
  if (!job || job.isDeleted) {
    throw new AppError('Resume link is invalid or has expired', 404);
  }

  if (application.isDeleted) {
    throw new AppError('Application has been deleted', 404);
  }

  // Assuming 'withdrawn' is a status
  if (application.status === 'withdrawn') {
    throw new AppError('Application has been withdrawn', 404);
  }

  const snapshotKey = application.resumeSnapshot?.key;
  if (!snapshotKey) {
    throw new AppError('Resume snapshot is no longer available', 404);
  }

  // Generate safe filename for the download
  const rawName = String(application.profileSnapshot?.name || 'student');
  let safeName = rawName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');

  if (!safeName) safeName = 'student';

  const rollNum = application.profileSnapshot?.rollNumber 
    ? String(application.profileSnapshot.rollNumber).trim().toUpperCase() 
    : '';
  const prefix = rollNum ? `${rollNum}_` : '';

  const filename = `${prefix}${safeName}_resume.pdf`;

  // Always generate an inline 180s signed URL
  const resumeUrl = await r2Service.generateDownloadUrl(snapshotKey, filename, 'inline');

  return resumeUrl;
};
