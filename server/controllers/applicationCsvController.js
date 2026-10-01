const asyncHandler = require('../utils/asyncHandler');
const applicationCsvService = require('../services/applicationCsvService');
const AppError = require('../utils/AppError');


exports.uploadCsvAndUpdateStatus = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('CSV file is required', 400);
  }

  const result = await applicationCsvService.processApplicationCsv(req);


  res.status(200).json({
    success: result.success,
    message: result.message,
    data: result.data
  });
});

exports.executeCsvStatusUpdate = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('CSV file is required', 400);
  }

  const result = await applicationCsvService.executeCsvStatusUpdate(req);

  res.status(200).json({
    success: true,
    message: result.message,
    data: result.data
  });
});
