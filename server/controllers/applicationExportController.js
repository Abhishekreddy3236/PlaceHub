const asyncHandler = require('../utils/asyncHandler');
const { exportStudentApplications } = require('../services/applicationExportService');

exports.exportStudentApplications = asyncHandler(async (req, res) => {
  await exportStudentApplications(req, res);
});
