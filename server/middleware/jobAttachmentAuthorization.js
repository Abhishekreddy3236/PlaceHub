const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const Job = require('../models/Job');
const { authorizeWithPermission } = require('./auth');

const canManageAttachments = authorizeWithPermission(['admin'], 'jobs', 'write');

const canViewAttachments = asyncHandler(async (req, res, next) => {
  if (req.user.role === 'admin') {
    return next();
  }
  
  if (req.user.role === 'staff') {
    const permissions = req.user.permissions || {};
    const level = permissions['jobs'] || 'none';
    if (level === 'read' || level === 'write') {
      return next();
    }
    return next(new AppError('You do not have permission to view jobs', 403));
  }

  const jobId = req.params.jobId;
  const job = await Job.findById(jobId).lean();
  
  if (!job) {
    return next(new AppError('Job not found', 404));
  }

  if (req.user.role === 'student') {
    if (!job.isActive || job.isDeleted) {
      return next(new AppError('Job is not accessible', 403));
    }
    
    const studentSchool = req.user.school || 'B. Tech';
    const hasSchool = !job.eligibleSchools?.length || job.eligibleSchools.includes(studentSchool);
    
    const studentGradYear = req.user.graduationYear ? Number(req.user.graduationYear) : null;
    let hasYear = !job.graduationYears?.length;
    if (!hasYear && studentGradYear) {
      hasYear = job.graduationYears.includes(studentGradYear);
    }

    if (!hasSchool || !hasYear) {
      return next(new AppError('You are not eligible to view this job', 403));
    }
    return next();
  }

  return next(new AppError('Unauthorized access', 403));
});

module.exports = {
  canManageAttachments,
  canViewAttachments,
};
