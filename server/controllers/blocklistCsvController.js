const asyncHandler = require('../utils/asyncHandler');
const blocklistCsvService = require('../services/blocklistCsvService');

exports.previewCsv = asyncHandler(async (req, res) => {
  const result = await blocklistCsvService.processBlocklistCsvPreview(req);

  res.status(200).json({
    success: true,
    message: 'CSV preview generated successfully',
    data: result
  });
});

exports.executeCsv = asyncHandler(async (req, res) => {
  const result = await blocklistCsvService.executeBlocklistCsv(req);

  res.status(200).json({
    success: true,
    message: 'CSV bulk block executed successfully',
    data: result
  });
});
