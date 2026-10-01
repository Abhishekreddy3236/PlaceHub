const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const userService = require('../services/userService');
const Resume = require('../models/Resume');
const r2Service = require('../services/r2Service');

exports.getProfile = asyncHandler(async (req, res) => {
  const result = await userService.getProfile(req);
  successResponse(res, result);
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const result = await userService.updateProfile(req);
  successResponse(res, result);
});

exports.getApplicationReadiness = asyncHandler(async (req, res) => {
  const result = await userService.getApplicationReadiness(req);
  successResponse(res, result);
});

exports.addProfileLink = asyncHandler(async (req, res) => {
  const result = await userService.addProfileLink(req);
  successResponse(res, result);
});

exports.updateProfileLink = asyncHandler(async (req, res) => {
  const result = await userService.updateProfileLink(req);
  successResponse(res, result);
});

exports.deleteProfileLink = asyncHandler(async (req, res) => {
  const result = await userService.deleteProfileLink(req);
  successResponse(res, result);
});

exports.deleteResume = asyncHandler(async (req, res) => {
  const result = await userService.deleteResume(req);
  successResponse(res, result);
});

exports.getMyResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findOne({ userId: req.user._id, status: 'active' })
    .select('key')
    .lean();

  if (!resume?.key || typeof resume.key !== 'string') {
    return res.json({
      success: true,
      data: { resumeUrl: '' }
    });
  }

  const url = await r2Service.generateDownloadUrl(resume.key);

  return res.json({
    success: true,
    data: { resumeUrl: url }
  });
});
