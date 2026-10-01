const asyncHandler = require('../utils/asyncHandler');
const { collectionResponse, successResponse } = require('../utils/response');
const jobService = require('../services/jobService');

exports.getAllJobs = asyncHandler(async (req, res) => {
  const result = await jobService.getAllJobs(req);
  successResponse(res, result);
});

exports.getClosedJobs = asyncHandler(async (req, res) => {
  const result = await jobService.getClosedJobs(req);
  successResponse(res, result);
});

exports.getRecommendedJobs = asyncHandler(async (req, res) => {
  const result = await jobService.getRecommendedJobs(req);
  successResponse(res, result);
});

exports.getJobById = asyncHandler(async (req, res) => {
  const result = await jobService.getJobById(req);
  successResponse(res, result);
});

exports.getJobDetailsContext = asyncHandler(async (req, res) => {
  const result = await jobService.getJobDetailsContext(req);
  successResponse(res, result);
});

exports.createJob = asyncHandler(async (req, res) => {
  const result = await jobService.createJob(req);
  successResponse(res, result);
});

exports.updateJob = asyncHandler(async (req, res) => {
  const result = await jobService.updateJob(req);
  successResponse(res, result);
});

exports.deleteJob = asyncHandler(async (req, res) => {
  const result = await jobService.deleteJob(req);
  successResponse(res, result);
});

exports.bulkDeleteJobs = asyncHandler(async (req, res) => {
  const result = await jobService.bulkDeleteJobs(req);
  successResponse(res, result);
});

exports.exportJobs = asyncHandler(async (req, res) => {
  const { buffer, filename } = await jobService.exportJobs(req);
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  return res.send(buffer);
});
