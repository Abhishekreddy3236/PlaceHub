const mongoose = require('mongoose');
const { parse } = require('csv-parse/sync');
const AppError = require('../utils/AppError');
const z = require('zod');
const User = require('../models/User');
const BlockedUser = require('../models/BlockedUser');
const PushSubscription = require('../models/PushSubscription');
const AuditLog = require('../models/AuditLog');

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const VALID_REASONS = ['None', 'Placed', 'Unauthorised', 'Opted Out', 'Active Backlogs', 'Low CGPA', 'DC', 'Other'];
const VALID_OPERATIONS = ['BLOCK', 'UNBLOCK', 'UNBLOCK_AND_DELETE'];

const processBlocklistCsvPreview = async (req) => {
  const operation = req.body.operation;
  if (!operation || !VALID_OPERATIONS.includes(operation)) {
    throw new AppError('Invalid or missing operation', 400);
  }

  if (!req.file || !req.file.buffer) {
    throw new AppError('CSV file is required', 400);
  }

  let csvString = req.file.buffer.toString('utf8');

  if (csvString.charCodeAt(0) === 0xFEFF) {
    csvString = csvString.slice(1);
  }

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

  if (header[0].toLowerCase() !== 'email') {
    throw new AppError('Invalid CSV: Header must strictly be "email"', 400);
  }

  const dataRows = records.slice(1);
  if (dataRows.length === 0) {
    throw new AppError('CSV contains no data rows', 400);
  }

  if (dataRows.length > 200) {
    throw new AppError(`CSV contains ${dataRows.length} rows. Maximum allowed is 200.`, 400);
  }

  const preview = [];
  const uniqueNormalizedEmails = [];
  const invalidCount = { count: 0 };
  const duplicateCount = { count: 0 };

  const emailSet = new Set();
  const emailMap = new Map();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.length !== 1) {
      throw new AppError(`Row ${i + 2} has multiple data columns. Expected 1.`, 400);
    }

    if (row[0].toLowerCase() === 'email') {
      throw new AppError(`Duplicate header row found at line ${i + 2}`, 400);
    }

    const rawEmail = row[0];

    if (rawEmail.length > 1000) {
      throw new AppError(`Row ${i + 2} contains excessively large cell data`, 400);
    }

    if (rawEmail.length > 254) {
      preview.push({ email: rawEmail, status: 'INVALID', message: 'Email too long' });
      invalidCount.count++;
      continue;
    }

    const validation = emailSchema.safeParse(rawEmail);

    if (!validation.success) {
      preview.push({ email: rawEmail, status: 'INVALID', message: 'Invalid email format' });
      invalidCount.count++;
    } else {
      const normalizedEmail = validation.data;
      if (emailSet.has(normalizedEmail)) {
        duplicateCount.count++;
      } else {
        emailSet.add(normalizedEmail);
        uniqueNormalizedEmails.push(normalizedEmail);
      }

      if (!emailMap.has(normalizedEmail)) {
        emailMap.set(normalizedEmail, { email: normalizedEmail });
      }
    }
  }

  const users = await User.find({ email: { $in: uniqueNormalizedEmails } })
    .select('email role admissionId school graduationYear')
    .lean();

  const userDict = {};
  for (const user of users) {
    userDict[user.email] = user;
  }

  const blockedUsers = await BlockedUser.find({ email: { $in: uniqueNormalizedEmails } })
    .select('email isBlocked admissionId school graduationYear')
    .lean();

  const blockedDict = {};
  for (const bUser of blockedUsers) {
    blockedDict[bUser.email] = bUser;
  }

  let invalidCountNum = invalidCount.count;
  let notFoundCount = 0;

  let readyBlockCount = 0;
  let unknownEmailCount = 0;
  let internalRejectedCount = 0;
  let alreadyBlockedCount = 0;

  let readyToUnblockCount = 0;
  let alreadyUnblockedCount = 0;

  let readyToDeleteCount = 0;

  for (const normalizedEmail of uniqueNormalizedEmails) {
    const previewItem = emailMap.get(normalizedEmail);
    const userDoc = userDict[normalizedEmail];
    const blockedDoc = blockedDict[normalizedEmail];

    previewItem.admissionId = blockedDoc?.admissionId || userDoc?.admissionId || null;
    previewItem.school = blockedDoc?.school || userDoc?.school || null;
    previewItem.graduationYear = blockedDoc?.graduationYear || userDoc?.graduationYear || null;

    if (operation === 'BLOCK') {
      if (userDoc && ['admin', 'staff', 'hr'].includes(userDoc.role)) {
        previewItem.status = 'REJECTED_INTERNAL';
        previewItem.message = 'Cannot block internal accounts';
        internalRejectedCount++;
        continue;
      }

      if (blockedDoc && blockedDoc.isBlocked) {
        previewItem.status = 'ALREADY_BLOCKED';
        alreadyBlockedCount++;
        continue;
      }

      if (userDoc && userDoc.role === 'student') {
        previewItem.status = 'READY';
        readyBlockCount++;
        continue;
      }

      previewItem.status = 'UNKNOWN';
      previewItem.message = 'Will block future registration';
      unknownEmailCount++;
    } else if (operation === 'UNBLOCK' || operation === 'UNBLOCK_AND_DELETE') {
      if (!blockedDoc) {
        previewItem.status = 'NOT_FOUND';
        previewItem.message = 'Not in blocklist';
        notFoundCount++;
      } else if (!blockedDoc.isBlocked && operation === 'UNBLOCK') {
        previewItem.status = 'ALREADY_UNBLOCKED';
        previewItem.message = 'Already unblocked';
        alreadyUnblockedCount++;
      } else {
        if (operation === 'UNBLOCK') {
          previewItem.status = 'READY_TO_UNBLOCK';
          readyToUnblockCount++;
        } else {
          previewItem.status = 'READY_TO_DELETE';
          readyToDeleteCount++;
        }
      }
    }
  }

  const finalPreview = [];
  for (const item of preview) {
    if (item.status === 'INVALID') {
      finalPreview.push(item);
    }
  }
  for (const normalizedEmail of uniqueNormalizedEmails) {
    finalPreview.push(emailMap.get(normalizedEmail));
  }

  const responseData = {
    totalRows: dataRows.length,
    uniqueRows: uniqueNormalizedEmails.length,
    duplicateCount: duplicateCount.count,
    invalidCount: invalidCountNum,
    preview: finalPreview
  };

  if (operation === 'BLOCK') {
    Object.assign(responseData, {
      readyBlockCount,
      unknownEmailCount,
      alreadyBlockedCount,
      internalRejectedCount
    });
  } else if (operation === 'UNBLOCK') {
    Object.assign(responseData, {
      readyToUnblockCount,
      alreadyUnblockedCount,
      notFoundCount
    });
  } else if (operation === 'UNBLOCK_AND_DELETE') {
    Object.assign(responseData, {
      readyToDeleteCount,
      notFoundCount
    });
  }

  return responseData;
};

const executeBlocklistCsv = async (req) => {
  const operation = req.body.operation;
  if (!operation || !VALID_OPERATIONS.includes(operation)) {
    throw new AppError('Invalid or missing operation', 400);
  }

  const reason = req.body.reason;
  if (operation === 'BLOCK') {
    if (!reason || !VALID_REASONS.includes(reason)) {
      throw new AppError('Invalid or missing block reason', 400);
    }
  }

  if (!req.file || !req.file.buffer) {
    throw new AppError('CSV file is required', 400);
  }

  let csvString = req.file.buffer.toString('utf8');

  if (csvString.charCodeAt(0) === 0xFEFF) {
    csvString = csvString.slice(1);
  }

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

  if (header[0].toLowerCase() !== 'email') {
    throw new AppError('Invalid CSV: Header must strictly be "email"', 400);
  }

  const dataRows = records.slice(1);
  if (dataRows.length === 0) {
    throw new AppError('CSV contains no data rows', 400);
  }

  if (dataRows.length > 200) {
    throw new AppError(`CSV contains ${dataRows.length} rows. Maximum allowed is 200.`, 400);
  }

  const uniqueNormalizedEmails = [];
  const invalidCount = { count: 0 };
  const duplicateCount = { count: 0 };

  const emailSet = new Set();
  const rawEmailResults = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.length !== 1) {
      throw new AppError(`Row ${i + 2} has multiple data columns. Expected 1.`, 400);
    }
    if (row[0].toLowerCase() === 'email') {
      throw new AppError(`Duplicate header row found at line ${i + 2}`, 400);
    }

    const rawEmail = row[0];

    if (rawEmail.length > 1000) {
      throw new AppError(`Row ${i + 2} contains excessively large cell data`, 400);
    }

    if (rawEmail.length > 254) {
      rawEmailResults.push({ email: rawEmail, status: 'INVALID', message: 'Email too long' });
      invalidCount.count++;
      continue;
    }

    const validation = emailSchema.safeParse(rawEmail);

    if (!validation.success) {
      rawEmailResults.push({ email: rawEmail, status: 'INVALID', message: 'Invalid email format' });
      invalidCount.count++;
    } else {
      const normalizedEmail = validation.data;
      if (emailSet.has(normalizedEmail)) {
        duplicateCount.count++;
      } else {
        emailSet.add(normalizedEmail);
        uniqueNormalizedEmails.push(normalizedEmail);
      }
    }
  }

  let successCount = 0;
  let alreadyBlockedCount = 0;
  let internalRejectedCount = 0;
  let unknownSuccessCount = 0;
  let studentSuccessCount = 0;
  let notFoundCount = 0;
  let alreadyUnblockedCount = 0;
  let failedCount = 0;

  const perRowResult = [];

  for (const normalizedEmail of uniqueNormalizedEmails) {
    const session = await mongoose.startSession();
    let txResult = null;

    try {
      await session.withTransaction(async () => {
        txResult = null;

        const targetUser = await User.findOne({ email: normalizedEmail })
          .select('role admissionId school graduationYear _id isActive tokenVersion')
          .session(session)
          .lean();

        let blocked = await BlockedUser.findOne({ email: normalizedEmail })
          .select('_id isBlocked')
          .session(session)
          .lean();

        if (operation === 'BLOCK') {
          if (targetUser && ['admin', 'staff', 'hr'].includes(targetUser.role)) {
            txResult = { type: 'REJECTED_INTERNAL', message: 'Cannot block internal accounts' };
            return;
          }

          const school = targetUser?.school || null;
          const graduationYear = targetUser?.graduationYear || null;
          const admissionId = targetUser?.admissionId || null;

          if (blocked) {
            if (blocked.isBlocked) {
              txResult = { type: 'ALREADY_BLOCKED', message: 'Candidate is already blocked' };
              return;
            }
            await BlockedUser.updateOne(
              { _id: blocked._id },
              { $set: { isBlocked: true, reason, school, graduationYear, admissionId } },
              { runValidators: true, session }
            );
          } else {
            const created = await BlockedUser.create(
              [{ email: normalizedEmail, reason, school, graduationYear, admissionId }],
              { session }
            );
            blocked = created[0];
          }

          if (targetUser) {
            await User.updateOne(
              { _id: targetUser._id, isActive: true },
              { $set: { isActive: false }, $inc: { tokenVersion: 1 } },
              { session }
            );
          }

          await AuditLog.create([{
            action: 'BLOCK_CANDIDATE',
            performedBy: req.user._id,
            targetId: blocked._id,
            targetType: 'Candidate',
            metadata: { email: normalizedEmail }
          }], { session });

          txResult = { type: 'BLOCKED', message: 'Successfully blocked', targetUserId: targetUser ? targetUser._id : null };

        } else if (operation === 'UNBLOCK') {
          if (!blocked) {
            txResult = { type: 'NOT_FOUND', message: 'Not in blocklist' };
            return;
          }
          if (!blocked.isBlocked) {
            txResult = { type: 'NOT_BLOCKED', message: 'Already unblocked' };
            return;
          }

          await BlockedUser.updateOne({ _id: blocked._id }, { $set: { isBlocked: false } }, { session });

          if (targetUser) {
            await User.updateOne({ _id: targetUser._id }, { $set: { isActive: true } }, { session });
          }

          await AuditLog.create([{
            action: 'UNBLOCK_CANDIDATE',
            performedBy: req.user._id,
            targetId: blocked._id,
            targetType: 'Candidate',
            metadata: { email: normalizedEmail }
          }], { session });

          txResult = { type: 'UNBLOCKED', message: 'Successfully unblocked' };

        } else if (operation === 'UNBLOCK_AND_DELETE') {
          if (!blocked) {
            txResult = { type: 'NOT_FOUND', message: 'Not in blocklist' };
            return;
          }

          if (targetUser) {
            await User.updateOne({ _id: targetUser._id }, { $set: { isActive: true } }, { session });
          }

          await BlockedUser.deleteOne({ _id: blocked._id }, { session });

          await AuditLog.create([{
            action: 'DELETE_BLOCKED_CANDIDATE',
            performedBy: req.user._id,
            targetId: blocked._id,
            targetType: 'Candidate',
            metadata: { email: normalizedEmail }
          }], { session });

          txResult = { type: 'DELETED', message: 'Successfully removed from blocklist' };
        }
      });

      if (txResult) {
        perRowResult.push({ email: normalizedEmail, status: txResult.type, message: txResult.message });

        if (txResult.type === 'REJECTED_INTERNAL') {
          internalRejectedCount++;
        } else if (txResult.type === 'ALREADY_BLOCKED') {
          alreadyBlockedCount++;
        } else if (txResult.type === 'NOT_FOUND') {
          notFoundCount++;
        } else if (txResult.type === 'NOT_BLOCKED') {
          alreadyUnblockedCount++;
        } else if (txResult.type === 'BLOCKED') {
          successCount++;
          if (txResult.targetUserId) {
            studentSuccessCount++;
            try {
              await PushSubscription.updateMany(
                { userId: txResult.targetUserId },
                { $set: { isActive: false, inactiveAt: new Date() } }
              );
            } catch (error) {
              console.error('Push subscription deactivation failed during bulk CSV:', error);
            }
          } else {
            unknownSuccessCount++;
          }
        } else if (txResult.type === 'UNBLOCKED' || txResult.type === 'DELETED') {
          successCount++;
          studentSuccessCount++;
        }
      }

    } catch (err) {
      console.error(`Error processing ${normalizedEmail} for ${operation}:`, err);
      failedCount++;
      perRowResult.push({ email: normalizedEmail, status: 'FAILED', message: 'An internal error occurred' });
    } finally {
      await session.endSession();
    }
  }

  const fullPreview = [...rawEmailResults, ...perRowResult];

  return {
    totalRows: dataRows.length,
    uniqueRows: uniqueNormalizedEmails.length,
    duplicateCount: duplicateCount.count,
    successCount,
    alreadyBlockedCount,
    internalRejectedCount,
    invalidCount: invalidCount.count,
    unknownSuccessCount,
    studentSuccessCount,
    notFoundCount,
    alreadyUnblockedCount,
    failedCount,
    results: fullPreview
  };
};

module.exports = {
  processBlocklistCsvPreview,
  executeBlocklistCsv
};
