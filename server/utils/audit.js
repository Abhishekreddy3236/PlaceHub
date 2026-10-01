const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

const createAuditLog = async ({
  action,
  req,
  performedBy = null,
  performedByEmail = '',
  performedByRole = '',
  target = {},
  targetId = null,
  targetType = '',
  metadata = {},
  timestamp = new Date(),
}) => {
  try {
    const actor = req?.user || {};

    await AuditLog.create({
      action,
      performedBy,
      performedByEmail: performedByEmail || actor.email || '',
      performedByRole: performedByRole || actor.role || '',
      target,
      targetId,
      targetType,
      metadata,
      timestamp,
      ipAddress: req?.ip || '',
      userAgent: req?.get?.('user-agent') || '',
    });
  } catch (error) {
    // Audit logging must never break the main request path.
    logger.error(`audit:write-failed error=${error.message}`);
  }
};

module.exports = {
  createAuditLog,
};
