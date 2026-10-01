const asyncHandler = require('../utils/asyncHandler');
const blocklistExportService = require('../services/blocklistExportService');

exports.exportBlocklistExcel = asyncHandler(async (req, res) => {
  const { buffer, filename } = await blocklistExportService.exportBlocklistExcel(req);

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, private'
  );
  res.setHeader(
    'X-Content-Type-Options',
    'nosniff'
  );
  
  res.send(buffer);
});
