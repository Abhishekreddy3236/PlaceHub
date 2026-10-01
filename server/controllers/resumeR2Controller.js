const mongoose = require('mongoose');
const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const r2Service = require('../services/r2Service');
const Resume = require('../models/Resume');
const Application = require('../models/Application');
const User = require('../models/User');
const { successResponse } = require('../utils/response');
const userService = require('../services/userService');

const normalizeSha256Hash = (hash) => {
  const normalized = String(hash || '').trim().toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new AppError('Resume hash is required', 400);
  }

  return normalized;
};

exports.generateUploadUrl = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') {
    throw new AppError('Only students can upload resumes', 403);
  }

  const pendingResumes = await Resume.find({
    userId: req.user._id,
    status: 'pending'
  });

  await Promise.all(
    pendingResumes.map(async (resume) => {
      try {
        await r2Service.deleteObject(resume.key);
      } catch (err) {
        console.error('R2 deletion failed:', err);
        throw new AppError('Storage deletion failed', 500);
      }
    })
  );
  await Resume.deleteMany({
    userId: req.user._id,
    status: 'pending'
  });

  const fileId = crypto.randomUUID();
  const key = `resumes/active/${req.user._id}/${fileId}.pdf`;

  const uploadUrl = await r2Service.generateUploadUrl(key);

  const resume = await Resume.create({
    userId: req.user._id,
    key,
    status: 'pending'
  });

  successResponse(res, { data: { uploadUrl, id: resume._id } });
});

exports.confirmUpload = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') {
    throw new AppError('Only students can confirm uploads', 403);
  }

  const id = req.body.id;
  if (!id) {
    throw new AppError('Resume ID is required', 400);
  }

  const resume = await Resume.findOne({
    _id: id,
    userId: req.user._id,
    status: 'pending',
  });

  if (!resume) {
    throw new AppError('Resume not found or already confirmed', 404);
  }

  let hash;
  try {
    hash = normalizeSha256Hash(req.body.hash);
  } catch (error) {
    try {
      await r2Service.deleteObject(resume.key);
    } catch (err) {
      console.error('R2 deletion failed:', err);
    }
    await Resume.deleteOne({ _id: resume._id });
    throw error;
  }

  if (typeof hash === 'undefined') {
    throw new AppError("Hash is required", 400);
  }

  if (!hash || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) {
    throw new AppError("Invalid hash format", 400);
  }

  let normalizedHash = hash.toLowerCase();

  if (resume.hash && resume.hash !== normalizedHash) {
    console.warn("Hash mismatch detected", {
      existing: resume?.hash || null,
      incoming: normalizedHash || null
    });
  }

  let metadata;
  try {
    metadata = await r2Service.getFileMetadata(resume.key);
  } catch (err) {
    await Resume.deleteOne({ _id: resume._id });
    throw new AppError('File not found in storage', 400);
  }

  const contentLength = Number(metadata.ContentLength || 0);
  const MAX_RESUME_SIZE = 1 * 1024 * 1024; // 1MB

  // STRICT SIZE VALIDATION
  if (contentLength <= 0 || contentLength > MAX_RESUME_SIZE) {
    try {
      await r2Service.deleteObject(resume.key);
    } catch (err) {
      console.error('R2 deletion failed:', err);
    }
    await Resume.deleteOne({ _id: resume._id });
    throw new AppError('Resume must be a valid PDF and ≤ 1MB', 400);
  }

  // STRICT FILE TYPE VALIDATION (FROM METADATA)
  const contentType = metadata.ContentType || '';

  if (contentType !== 'application/pdf') {
    try {
      await r2Service.deleteObject(resume.key);
    } catch (err) {
      console.error('R2 deletion failed:', err);
    }
    await Resume.deleteOne({ _id: resume._id });
    throw new AppError('Only PDF files are allowed', 400);
  }

  // MAGIC BYTE VALIDATION
  try {
    const stream = await r2Service.getObjectStream(resume.key, { Range: 'bytes=0-4' });
    const chunks = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const header = Buffer.concat(chunks).subarray(0, 5);
    if (header.toString('ascii') !== '%PDF-') {
      throw new Error('Invalid PDF signature');
    }
  } catch (err) {
    try {
      await r2Service.deleteObject(resume.key);
    } catch (cleanupErr) {
      console.error('R2 deletion failed during magic byte cleanup:', cleanupErr);
    }
    await Resume.deleteOne({ _id: resume._id });
    throw new AppError('File is not a valid PDF', 400);
  }

  const latestMetadata = await r2Service.getFileMetadata(resume.key);
  const latestSize = Number(latestMetadata.ContentLength || 0);
  const latestType = latestMetadata.ContentType || '';

  // Detect overwrite after validation
  if (latestSize !== contentLength || latestType !== contentType) {
    try {
      await r2Service.deleteObject(resume.key);
    } catch (err) {
      console.error('R2 deletion failed during overwrite cleanup:', err);
    }

    await Resume.deleteOne({ _id: resume._id });

    throw new AppError('File was modified during upload. Please re-upload.', 400);
  }

  let oldActiveResumes = [];
  let transactionCommitted = false;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const txResume = await Resume.findOne({
      _id: resume._id,
      userId: resume.userId,
      status: 'pending'
    }).session(session);

    if (!txResume) {
      throw new AppError('Resume is no longer pending or was already confirmed.', 409);
    }

    oldActiveResumes = await Resume.find({
      userId: resume.userId,
      status: 'active',
      _id: { $ne: resume._id }
    }).session(session);

    for (const old of oldActiveResumes) {
      await Resume.deleteOne({ _id: old._id }).session(session);
    }

    const result = await Resume.updateOne(
      {
        _id: resume._id,
        userId: resume.userId,
        status: 'pending'
      },
      {
        $set: {
          status: 'active',
          size: contentLength,
          hash: normalizedHash
        }
      },
      { session }
    );

    if (result.modifiedCount !== 1) {
      throw new AppError('Resume is no longer pending or was already confirmed.', 409);
    }

    await session.commitTransaction();
    transactionCommitted = true;
  } catch (err) {
    if (session.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        console.error('Transaction abort failed:', abortErr);
      }
    }
    if (err.code === 11000 && err.keyPattern && err.keyPattern.userId === 1) {
      throw new AppError('Another resume was confirmed simultaneously.', 409);
    }
    throw err;
  } finally {
    await session.endSession();
  }

  if (transactionCommitted) {
    for (const old of oldActiveResumes) {
      try {
        await r2Service.deleteObject(old.key);
      } catch (err) {
        console.error('Cleanup failed:', err);
      }
    }
  }

  const { data } = await userService.getProfile(req);

  successResponse(res, { message: 'Upload confirmed', data });
});

exports.getResumeById = asyncHandler(async (req, res) => {
  const resume = await Resume.findById(req.params.id);

  if (!resume || !resume.userId) {
    throw new AppError('Resume not found or invalid', 404);
  }

  // STUDENT → only own resume
  if (req.user.role === 'student') {
    if (resume.userId.toString() !== req.user._id.toString()) {
      throw new AppError('Unauthorized', 403);
    }
  }
  // HR → ONLY resumes of candidates who applied to THEIR company
  else if (req.user.role === 'hr') {
    throw new AppError(
      'HR must access resumes via application endpoint only',
      403
    );
  }
  // ADMIN → full access
  else if (req.user.role === 'admin') {
    // allow
  }
  // STAFF → requires users: read or write
  else if (req.user.role === 'staff') {
    const usersPerm = req.user.permissions?.users;
    if (usersPerm !== 'read' && usersPerm !== 'write') {
      throw new AppError('Unauthorized', 403);
    }
  }
  // OTHER → block access
  else {
    throw new AppError('Unauthorized', 403);
  }

  const user = await User.findById(resume.userId).select('name rollNumber');
  const rawName = String(user?.name || 'student');

  let safeName = rawName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');

  if (!safeName) safeName = 'student';

  const rollNum = user?.rollNumber 
    ? String(user.rollNumber).trim().toUpperCase() 
    : '';
  const prefix = rollNum ? `${rollNum}_` : '';

  const filename = `${prefix}${safeName}_resume.pdf`;
  const mode = req.query.download === 'true' ? 'attachment' : 'inline';
  const resumeUrl = await r2Service.generateDownloadUrl(resume.key, filename, mode);
  return successResponse(res, { data: { resumeUrl } });
});

exports.deleteResume = asyncHandler(async (req, res) => {
  const result = await userService.deleteResume(req);
  return successResponse(res, result);
});
