const Company = require('../models/Company');
const AppError = require('./AppError');

const normalizeCompanyName = (name = '') =>
  String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const createSlug = (value = '') =>
  normalizeCompanyName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const resolveCompanyForJob = async ({
  companyId,
  companyName,
  createdBy,
}) => {
  if (companyId) {
    const company = await Company.findById(companyId).lean();
    if (!company || !company.isActive) {
      throw new AppError('Company not found or inactive', 404);
    }

    return company;
  }

  const normalizedName = normalizeCompanyName(companyName);
  if (!normalizedName) {
    throw new AppError('Company is required', 400);
  }

  const slug = createSlug(normalizedName);

  const existingCompany = await Company.findOne({
    $or: [
      { normalizedName },
      { slug }
    ]
  }).lean();

  if (existingCompany) {
    return existingCompany;
  }

  return Company.create({
    name: String(companyName).trim(),
    normalizedName,
    slug,
    createdBy,
  });
};

module.exports = {
  createSlug,
  normalizeCompanyName,
  resolveCompanyForJob,
};
