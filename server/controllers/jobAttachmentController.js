const JobAttachment = require('../models/JobAttachment');
const Job = require('../models/Job');
const jobAttachmentR2Service = require('../services/jobAttachmentR2Service');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

exports.getUploadUrl = asyncHandler(async (req, res, next) => {
  const { jobId } = req.params;
  const { extension } = req.body;

  if (!extension) {
    return next(new AppError('Extension is required', 400));
  }

  const jobExists = await Job.exists({ _id: jobId, isDeleted: false });
  if (!jobExists) {
    return next(new AppError('Job not found', 404));
  }

  const attachmentCount = await JobAttachment.countDocuments({ jobId });
  if (attachmentCount >= 5) {
    return next(new AppError('Maximum of 5 attachments allowed per job', 400));
  }

  const { uploadUrl, r2Key } = await jobAttachmentR2Service.generateUploadUrl(jobId, extension);

  res.status(200).json({
    success: true,
    data: { uploadUrl, r2Key }
  });
});

exports.completeUpload = asyncHandler(async (req, res, next) => {
  const { jobId } = req.params;
  const { r2Key, fileName, size, mimeType } = req.body;

  const expectedPrefix = `job-attachments/${jobId}/`;
  if (!r2Key.startsWith(expectedPrefix)) {
    return next(new AppError('Attachment key does not belong to the requested job', 400));
  }

  const jobExists = await Job.exists({ _id: jobId, isDeleted: false });
  if (!jobExists) {
    return next(new AppError('Job not found', 404));
  }

  const extensionMatch = r2Key.match(/\.[^.]+$/);
  if (!extensionMatch) {
    return next(new AppError('Invalid r2Key extension', 400));
  }
  const ext = extensionMatch[0].toLowerCase();
  
  const ALLOWED_MIME_TYPES = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint'
  };

  if (ALLOWED_MIME_TYPES[ext] !== mimeType) {
    return next(new AppError('MIME type does not match file extension', 400));
  }

  try {
    await jobAttachmentR2Service.validateUploadedFile(r2Key, mimeType);

    const attachmentCount = await JobAttachment.countDocuments({ jobId });
    if (attachmentCount >= 5) {
      throw new AppError('Maximum of 5 attachments allowed per job', 400);
    }
  } catch (error) {
    try {
      await jobAttachmentR2Service.deleteFile(r2Key);
    } catch (cleanupError) {
      console.error(`Cleanup failed for r2Key ${r2Key}:`, cleanupError.message);
    }
    return next(error);
  }

  try {
    const attachment = await JobAttachment.create({
      jobId,
      originalName: fileName,
      r2Key,
      size,
      mimeType,
      uploadedBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      data: attachment
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('This file has already been processed', 400));
    }
    
    try {
      await jobAttachmentR2Service.deleteFile(r2Key);
    } catch (cleanupError) {
      console.error(`Cleanup failed for r2Key ${r2Key}:`, cleanupError.message);
    }
    return next(error);
  }
});

exports.getAttachments = asyncHandler(async (req, res, next) => {
  const { jobId } = req.params;

  const attachments = await JobAttachment.find({ jobId }).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: attachments
  });
});

exports.downloadAttachment = asyncHandler(async (req, res, next) => {
  const { jobId, attachmentId } = req.params;

  const attachment = await JobAttachment.findOne({ _id: attachmentId, jobId });
  if (!attachment) {
    return next(new AppError('Attachment not found for this job', 404));
  }

  const downloadUrl = await jobAttachmentR2Service.generateDownloadUrl(attachment.r2Key, attachment.originalName);

  res.status(200).json({
    success: true,
    data: { downloadUrl }
  });
});

exports.deleteAttachment = asyncHandler(async (req, res, next) => {
  const { jobId, attachmentId } = req.params;

  const attachment = await JobAttachment.findOne({ _id: attachmentId, jobId });
  if (!attachment) {
    return next(new AppError('Attachment not found', 404));
  }

  await JobAttachment.findByIdAndDelete(attachmentId);

  await jobAttachmentR2Service.deleteFile(attachment.r2Key).catch(err => {
    console.error(`Cleanup failed for r2Key ${attachment.r2Key}:`, err.message);
  });

  res.status(200).json({
    success: true,
    message: 'Attachment deleted successfully'
  });
});
