const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const dashboardService = require('../services/dashboardService');

exports.getDashboardData = asyncHandler(async (req, res) => {
  const result = await dashboardService.getDashboardData(req);
  successResponse(res, result);
});
