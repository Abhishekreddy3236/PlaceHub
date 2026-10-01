const AppError = require('./AppError');
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const FALLBACK_LIMIT = 200;

const DEFAULT_LIMITS = {
  jobs: 12,
  applications: 10,
  admin: 50,
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createSearchRegex = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > 100) {
    throw new AppError('Search query too long', 400);
  }

  return new RegExp(escapeRegex(trimmed), 'i');
};

const parsePagination = (query = {}, fallbackLimit = DEFAULT_LIMIT) => {
  const parsedPage = Number.parseInt(query.page, 10);
  const parsedLimit = Number.parseInt(query.limit, 10);

  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? DEFAULT_PAGE : parsedPage;
  const limit = Number.isNaN(parsedLimit) || parsedLimit < 1
    ? fallbackLimit
    : Math.min(parsedLimit, MAX_LIMIT);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const buildPaginationMeta = ({ total, page, limit }) => ({
  page,
  limit,
  total,
  totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  hasNextPage: page * limit < total,
  hasPreviousPage: page > 1,
});

const normalizeArrayInput = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const hasPaginationRequest = (req) =>
  req.originalUrl.startsWith('/api/v1/') ||
  req.query.page !== undefined ||
  req.query.limit !== undefined;

module.exports = {
  buildPaginationMeta,
  createSearchRegex,
  escapeRegex,
  hasPaginationRequest,
  normalizeArrayInput,
  parsePagination,
  DEFAULT_LIMITS,
  FALLBACK_LIMIT,
};
