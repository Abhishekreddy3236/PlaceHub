const { parse } = require('csv-parse/sync');
const AppError = require('../utils/AppError');
const z = require('zod');
const Application = require('../models/Application');
const applicationService = require('./applicationService');

const emailSchema = z.string().trim().toLowerCase().email().max(254);


const processApplicationCsv = async (req) => {
  let { jobId } = req.body;

  if (req?.user?.role === 'hr') {
    const hrJobId = req.user.jobId?._id || req.user.jobId;
    if (hrJobId) {
      jobId = hrJobId.toString();
    }
  }

  if (!jobId) {
    throw new AppError('Job context is missing', 400);
  }

  if (!req.file || !req.file.buffer) {
    throw new AppError('CSV file is required', 400);
  }

  const csvString = req.file.buffer.toString('utf8');

  // Check for null bytes
  if (csvString.indexOf('\0') !== -1) {
    throw new AppError('Malformed CSV: Contains null bytes', 400);
  }

  if (!csvString.trim()) {
    throw new AppError('Empty file', 400);
  }

  let records;
  try {
    records = parse(csvString, {
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });
  } catch (error) {
    if (error.code === 'CSV_RECORD_INCONSISTENT_FIELDS_LENGTH') {
      throw new AppError('Malformed CSV: Inconsistent number of columns', 400);
    }
    throw new AppError(`Malformed CSV: ${error.message}`, 400);
  }

  if (records.length === 0) {
    throw new AppError('Empty file', 400);
  }

  const header = records[0];
  if (header.length !== 1) {
    throw new AppError(`Invalid CSV: Expected exactly 1 column, found ${header.length}`, 400);
  }

  if (header[0].toLowerCase() !== 'college_email') {
    throw new AppError('Invalid CSV: Missing "college_email" header', 400);
  }

  const dataRows = records.slice(1);
  if (dataRows.length === 0) {
    throw new AppError('CSV contains no data rows', 400);
  }

  if (dataRows.length > 500) {
    throw new AppError(`CSV contains ${dataRows.length} rows. Maximum allowed is 500.`, 400);
  }

  const validEmails = [];
  const uniqueValidEmails = [];
  const invalidEmails = [];
  const duplicateEmails = [];
  const emailSet = new Set();
  const allEmails = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.length !== 1) {
      throw new AppError(`Row ${i + 2} has multiple data columns. Expected 1.`, 400);
    }

    if (row[0].toLowerCase() === 'college_email') {
      throw new AppError(`Duplicate header row found at line ${i + 2}`, 400);
    }

    const rawEmail = row[0];

    if (rawEmail.length > 1000) {
      throw new AppError(`Row ${i + 2} contains excessively large cell data`, 400);
    }

    if (rawEmail.length > 254) {
      allEmails.push({ email: rawEmail, status: 'invalid', normalized: null });
      invalidEmails.push(rawEmail);
      continue;
    }

    const validation = emailSchema.safeParse(rawEmail);

    if (validation.success) {
      const normalizedEmail = validation.data;
      allEmails.push({ email: rawEmail, status: 'valid', normalized: normalizedEmail });
      validEmails.push(normalizedEmail);

      if (emailSet.has(normalizedEmail)) {
        duplicateEmails.push(normalizedEmail);
      } else {
        emailSet.add(normalizedEmail);
        uniqueValidEmails.push(normalizedEmail);
      }
    } else {
      allEmails.push({ email: rawEmail, status: 'invalid', normalized: null });
      invalidEmails.push(rawEmail);
    }
  }

  const matchedApplications = await Application.find({
    jobId,
    'profileSnapshot.email': { $in: uniqueValidEmails },
    isDeleted: false
  })
    .select('_id profileSnapshot.email status currentRound')
    .lean();

  let foundCount = 0;
  let notFoundCount = 0;
  let eligibleCount = 0;
  let alreadySelectedCount = 0;
  let alreadyRejectedCount = 0;
  let alreadyWithdrawnCount = 0;

  const roundDistribution = {};
  const statusDistribution = {};
  const mixedRoundSet = new Set();

  const appMap = new Map();
  const matchedAppsInternal = [];

  for (const app of matchedApplications) {
    if (app.profileSnapshot?.email) {
      const normalized = app.profileSnapshot.email.toLowerCase();
      appMap.set(normalized, app);

      matchedAppsInternal.push({
        applicationId: app._id,
        email: normalized,
        currentRound: app.currentRound,
        status: app.status
      });
    }
  }

  for (const item of allEmails) {
    if (item.status === 'valid') {
      const app = appMap.get(item.normalized);
      if (app) {
        item.dbStatus = 'found';
        item.applicationId = app._id;

        item.currentRound = app.currentRound;
        item.currentStatus = app.status;

        foundCount++;
        if (app.currentRound != null) {
          mixedRoundSet.add(app.currentRound);
          const rKey = `Round ${app.currentRound}`;
          roundDistribution[rKey] = (roundDistribution[rKey] || 0) + 1;
        }

        const sKey = app.status || 'unknown';
        statusDistribution[sKey] = (statusDistribution[sKey] || 0) + 1;

        if (app.status === 'rejected') {
          item.eligibility = 'already_rejected';
          alreadyRejectedCount++;
        } else if (app.status === 'selected') {
          item.eligibility = 'already_selected';
          alreadySelectedCount++;
        } else if (app.status === 'withdrawn') {
          item.eligibility = 'already_withdrawn';
          alreadyWithdrawnCount++;
        } else {
          item.eligibility = 'eligible';
          eligibleCount++;
        }
      } else {
        item.dbStatus = 'not_found';
        notFoundCount++;
      }
    }
  }

  const frontendEmails = allEmails.map(item => {
    const { applicationId, ...safeItem } = item;
    return safeItem;
  });

  return {
    success: true,
    message: 'CSV parsed and cross-referenced successfully',
    data: {
      totalRows: dataRows.length,
      validEmailsCount: validEmails.length,
      uniqueValidEmailsCount: uniqueValidEmails.length,
      invalidEmailsCount: invalidEmails.length,
      duplicateEmailsCount: duplicateEmails.length,
      validEmails,
      uniqueValidEmails,
      invalidEmails,
      duplicateEmails,

      // Intelligent Preview Additions
      foundCount,
      notFoundCount,
      eligibleCount,
      alreadySelectedCount,
      alreadyRejectedCount,
      alreadyWithdrawnCount,
      roundDistribution,
      statusDistribution,
      mixedRoundWarning: mixedRoundSet.size > 1,

      emails: frontendEmails
    },
    internal: {
      matchedApplications: matchedAppsInternal
    }
  };
};

const executeCsvStatusUpdate = async (req) => {
  const { action, isAbsent } = req.body;
  if (!action) {
    throw new AppError('Action is required (e.g. next_round or reject)', 400);
  }

  // 1. Call processApplicationCsv() to obtain result.internal.matchedApplications
  const previewResult = await processApplicationCsv(req);
  const matchedApplications = previewResult.internal.matchedApplications;

  // 2. Filter ONLY executable applicants (in_progress).
  // Note: We intentionally preserve those in different rounds so bulkUpdateApplicationStatus 
  // can natively throw its 'Mixed Round' 400 validation if necessary, adhering perfectly to DRY.
  const executableIds = matchedApplications
    .filter(app => app.status === 'in_progress')
    .map(app => app.applicationId.toString());

  // 3. If executableIds.length === 0, DO NOT call bulkUpdateApplicationStatus()
  if (executableIds.length === 0) {
    return {
      success: true,
      message: 'No executable applications found. The operation is an idempotent success.',
      data: {
        action,
        jobId: req.body.jobId,
        updated: 0,
        skipped: matchedApplications.length
      }
    };
  }

  // 4. Create a NEW executionRequest object.
  const executionRequest = {
    ...req,
    body: {
      applicantIds: executableIds,
      action,
      isAbsent
    }
  };

  // 5. Delegate executionRequest down to bulkUpdateApplicationStatus()
  const result = await applicationService.bulkUpdateApplicationStatus(executionRequest);

  // 6. Return execution result
  return {
    success: true,
    message: result.message,
    data: {
      action,
      jobId: req.body.jobId,
      updated: result.data.count,
      skipped: matchedApplications.length - executableIds.length
    }
  };
};

module.exports = {
  processApplicationCsv,
  executeCsvStatusUpdate
};
