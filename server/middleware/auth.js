const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/tokens');
const User = require('../models/User');

const defaultStaffPermissions = {
  users: 'none',
  jobs: 'none',
  applications: 'none',
  accessControl: 'none',
  settings: 'none',
};

const extractBearerToken = (req) => {
  const authorizationHeader = req.headers.authorization || '';

  if (authorizationHeader.startsWith('Bearer ')) {
    return authorizationHeader.slice(7).trim();
  }

  return null;
};

const canAccessBeforePasswordChange = (req) => {
  const path = (req.originalUrl || '').split('?')[0];

  return (
    path.endsWith('/auth/change-password') ||
    path.endsWith('/admin/change-password') ||
    path.endsWith('/auth/me') ||
    path.endsWith('/auth/logout')
  );
};

const getUserIdFromAccessToken = (decoded) => {
  const userId = decoded.userId || decoded.id;
  if (!userId) {
    return null;
  }

  return String(userId);
};

const buildRequestUser = (user) => {
  const permissions =
    user.role === 'staff'
      ? { ...defaultStaffPermissions, ...(user.permissions || {}) }
      : {};

  return {
    _id: user._id,
    id: user._id.toString(),
    email: user.email || '',
    username: user.username || '',
    role: user.role,
    companyId: user.companyId ?? null,
    jobId: user.jobId ?? null,
    permissions,
    mustChangePassword: Boolean(user.mustChangePassword),
    school: user.school,
    graduationYear: user.graduationYear ?? null,
  };
};

const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req);

  if (!token) {
    return next(new AppError('Not authenticated', 401));
  }

  const decoded = verifyAccessToken(token);

  if (decoded.type !== 'access') {
    return next(new AppError('Invalid access token', 401));
  }

  const userId = getUserIdFromAccessToken(decoded);

  if (!userId) {
    return next(new AppError('Invalid access token', 401));
  }

  const dbUser = await User.findById(userId)
    .setOptions({ withDeleted: true })
    .lean();

  if (!dbUser || dbUser.isDeleted) {
    return next(new AppError('User account is inactive', 401));
  }

  const decodedTokenVersion = Number(decoded.tokenVersion || 0);
  const currentTokenVersion = Number(dbUser.tokenVersion || 0);

  if (decodedTokenVersion !== currentTokenVersion) {
    return next(new AppError('Session expired. Please login again.', 401));
  }

  if (dbUser.isActive === false) {
    return next(new AppError('Account is blocked', 403));
  }

  const user = buildRequestUser(dbUser);

  if (user.mustChangePassword && !canAccessBeforePasswordChange(req)) {
    return next(new AppError('Password change required before accessing system', 403, {
      code: 'PASSWORD_CHANGE_REQUIRED',
      mustChangePassword: true,
    }));
  }

  req.user = user;
  req.auth = decoded;
  next();
});

const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    const role = req.user.role?.toLowerCase();

    const hasPermission = roles.includes(role);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    next();
  };
};

const adminOnly = authorize('admin');

const permissionRank = {
  none: 0,
  read: 1,
  write: 2,
};

const protectedResources = new Set(['users', 'jobs', 'applications', 'accessControl']);
const protectedActions = new Set(['read', 'write']);

const checkPermission = (resource, action = 'read') => (req, res, next) => {
  if (!req.user) {
    next(new AppError('Not authenticated', 401));
    return;
  }

  if (!protectedResources.has(resource) || !protectedActions.has(action)) {
    next(new AppError('Invalid permission check', 500));
    return;
  }

  if (req.user.role === 'admin') {
    next();
    return;
  }

  if (req.user.role !== 'staff') {
    next(new AppError('You do not have permission to perform this action', 403));
    return;
  }

  const permissions = req.user.permissions || {};
  const currentLevel = permissions[resource] || 'none';

  if ((permissionRank[currentLevel] || 0) < permissionRank[action]) {
    next(new AppError('You do not have permission to perform this action', 403));
    return;
  }

  next();
};

const authorizeWithPermission = (roles = [], resource, level = 'read') => (req, res, next) => {
  if (!req.user) {
    next(new AppError('Not authenticated', 401));
    return;
  }

  if (roles.includes(req.user.role)) {
    next();
    return;
  }

  checkPermission(resource, level)(req, res, next);
};

const hrCompanyOnly = (req, res, next) => {
  if (req.user.role !== 'hr') {
    next(new AppError('HR access required', 403));
    return;
  }

  if (!req.user.companyId) {
    next(new AppError('HR account is not linked to a company', 403));
    return;
  }

  next();
};

/**
 * NOTE:
 * This helper is currently NOT used anywhere in the project.
 *
 * It only works correctly when passing a single role or an array:
 *   requireRole(['admin', 'staff'])
 *
 * Do NOT use:
 *   requireRole('admin', 'staff')
 *
 * If this helper is used in the future, update the implementation to pass
 * the roles array directly to authorize() first.
 */
const requireRole = (...roles) => authorize(...roles);

module.exports = {
  adminOnly,
  authenticate,
  protect: authenticate,
  authorize,
  authorizeWithPermission,
  checkPermission,
  hrCompanyOnly,
  requirePermission: checkPermission,
  requireRole,
};
