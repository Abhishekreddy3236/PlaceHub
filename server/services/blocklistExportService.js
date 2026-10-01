const BlockedUser = require('../models/BlockedUser');
const AppError = require('../utils/AppError');
const { generateBlocklistExportWorkbook } = require('../utils/blocklistExcelExporter');

const VALID_REASONS = ['None', 'Placed', 'Unauthorised', 'Opted Out', 'Active Backlogs', 'Low CGPA', 'DC', 'Other'];
const MAX_EXPORT_ROWS = 10000;

const normalizeQueryArray = (value) =>
  typeof value === 'string' ? value.split(',') : [];

const exportBlocklistExcel = async (req) => {
  const schools = normalizeQueryArray(req.query.schools);
  const graduationYears = normalizeQueryArray(req.query.graduationYears);
  const reasons = normalizeQueryArray(req.query.reasons);
  const status = req.query.status;

  const query = {};

  if (schools.length > 0) {
    query.school = { $in: schools };
  }

  if (graduationYears.length > 0) {
    query.graduationYear = { $in: graduationYears.map(Number) };
  }

  if (reasons.length > 0) {
    for (const r of reasons) {
      if (!VALID_REASONS.includes(r)) {
        throw new AppError(`Invalid reason filter value: ${r}`, 400);
      }
    }
    query.reason = { $in: reasons };
  }

  if (status) {
    if (status !== 'Blocked' && status !== 'Unblocked') {
      throw new AppError(`Invalid status filter value: ${status}`, 400);
    }
    query.isBlocked = status === 'Blocked';
  }

  const totalCount = await BlockedUser.countDocuments(query);
  if (totalCount > MAX_EXPORT_ROWS) {
    throw new AppError(`Export exceeds maximum limit of ${MAX_EXPORT_ROWS} records. Please apply stricter filters.`, 400);
  }

  const blocklistRecords = await BlockedUser.find(query)
    .select('email admissionId school graduationYear reason isBlocked')
    .lean()
    .sort({ school: 1, graduationYear: 1, email: 1 });

  const filtersMeta = {
    schools,
    graduationYears,
    reasons,
    status
  };

  const buffer = await generateBlocklistExportWorkbook(blocklistRecords, filtersMeta);

  return {
    buffer,
    filename: 'PlaceHub_Candidate_Blocklist.xlsx'
  };
};

module.exports = {
  exportBlocklistExcel
};
