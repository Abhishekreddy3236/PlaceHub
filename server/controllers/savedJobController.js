const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const savedJobService = require('../services/savedJobService');

exports.saveJob = asyncHandler(async (req, res) => {
  const result = await savedJobService.saveJob(req);
  successResponse(res, result);
});

exports.unsaveJob = asyncHandler(async (req, res) => {
  const result = await savedJobService.unsaveJob(req);
  successResponse(res, result);
});

exports.getSavedJobs = asyncHandler(async (req, res) => {
  const result = await savedJobService.getSavedJobs(req);
  successResponse(res, result);
});

exports.checkSaved = asyncHandler(async (req, res) => {
  const result = await savedJobService.checkSaved(req);
  successResponse(res, result);
});
