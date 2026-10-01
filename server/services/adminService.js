
const logger = require('../config/logger');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Company = require('../models/Company');
const User = require('../models/User');
const Application = require('../models/Application');
const BlockedUser = require('../models/BlockedUser');
const Job = require('../models/Job');
const SavedJob = require('../models/SavedJob');
const Resume = require('../models/Resume');
const PushSubscription = require('../models/PushSubscription');
const {
  releaseSnapshotsForApplications,
} = require('./resumeFileService');
const { generateStudentExportWorkbook } = require('../utils/studentExcelExporter');
const r2Service = require('./r2Service');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');
const { normalizeCompanyName, createSlug } = require('../utils/company');
const {
  parsePagination,
  createSearchRegex,
  hasPaginationRequest,
  DEFAULT_LIMITS,
  FALLBACK_LIMIT,
} = require('../utils/query');
const { serializeCompany } = require('../utils/serializers');

const { sendStaffCredentialsEmail, sendHrCredentialsEmail } = require('../config/email');

const { getAllowedYears } = require('../utils/constants');

const PASSWORD_CHARSET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const STAFF_PERMISSION_FIELDS = ['users', 'jobs', 'applications', 'accessControl'];

const generateRandomPassword = (length = 8) => {
  let password = '';

  while (password.length < length) {
    const randomIndex = crypto.randomInt(0, PASSWORD_CHARSET.length);
    password += PASSWORD_CHARSET[randomIndex];
  }

  return password;
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validateObjectId = (id, fieldName = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
};

const getStaffIdFromBody = (body = {}) => body.staffId || body.id || body.userId;

const requireAdmin = (req) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }
};

const preventSelfDeletion = (targetUserId, currentUserId) => {
  if (
    targetUserId &&
    currentUserId &&
    targetUserId.toString() === currentUserId.toString()
  ) {
    throw new AppError('You cannot delete your own account', 400);
  }
};

const getActorSnapshot = (req) => ({
  performedByEmail: req.user?.email || req.user?.username || '',
  performedByRole: req.user?.role || '',
});

const normalizeStaffPermissions = (permissions = {}, options = {}) => {
  if (
    permissions === null ||
    typeof permissions !== 'object' ||
    Array.isArray(permissions)
  ) {
    throw new AppError('Permissions must be an object', 400);
  }

  const normalized = {
    users: 'none',
    jobs: 'none',
    applications: 'none',
    settings: 'none',
  };
  const allowedFields = new Set([...STAFF_PERMISSION_FIELDS, 'settings']);

  Object.keys(permissions).forEach((field) => {
    if (!allowedFields.has(field)) {
      throw new AppError(`Unknown permission field: ${field}`, 400);
    }
  });

  STAFF_PERMISSION_FIELDS.forEach((field) => {
    if (options.requireAll && permissions[field] === undefined) {
      throw new AppError(`${field} permission is required`, 400);
    }

    if (permissions[field] === undefined || permissions[field] === null || permissions[field] === '') {
      return;
    }

    if (!['none', 'read', 'write'].includes(permissions[field])) {
      throw new AppError(`Invalid ${field} permission`, 400);
    }

    normalized[field] = permissions[field];
  });

  if (permissions.settings !== undefined && permissions.settings !== 'none') {
    throw new AppError('Settings permission is restricted for staff', 403);
  }

  return normalized;
};

const serializeStaff = (staff) => {
  const value = staff?.toObject ? staff.toObject() : staff;
  const permissions = value?.permissions || {};

  return {
    _id: value._id,
    name: value.name || '',
    email: value.email || '',
    role: value.role,
    isActive: value.isActive !== false,
    isDeleted: value.isDeleted === true,
    deletedAt: value.deletedAt || null,
    mustChangePassword: value.mustChangePassword === true,
    permissions: {
      users: permissions.users || 'none',
      jobs: permissions.jobs || 'none',
      applications: permissions.applications || 'none',
      accessControl: permissions.accessControl || 'none',
    },
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const hasActiveJobsForStaff = async (staffId) => {
  const activeJob = await Job.findOne({ postedBy: staffId, isActive: true })
    .select('_id')
    .lean();

  return Boolean(activeJob);
};

const getRequestedStaffActiveState = (body = {}) => {
  if (typeof body.isActive === 'boolean') {
    return body.isActive;
  }

  if (typeof body.block === 'boolean') {
    return !body.block;
  }

  const action = String(body.action || '').trim().toLowerCase();
  if (action === 'block') {
    return false;
  }
  if (action === 'unblock') {
    return true;
  }

  throw new AppError('Provide isActive, block, or action for staff status update', 400);
};

const sanitizeForUsername = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const generateUniqueUsername = async (companyName, role) => {
  const safeCompany = sanitizeForUsername(companyName).slice(0, 12);
  const safeRole = sanitizeForUsername(role).slice(0, 14);

  if (!safeCompany) {
    throw new AppError('Company name is required to generate username', 400);
  }

  const base = safeRole
    ? `${safeCompany}_${safeRole}`
    : `${safeCompany}_hr`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = crypto.randomInt(1000, 9999).toString();
    const candidate = `${base}_${suffix}`.slice(0, 30);
    const existingUser = await User.findOne({ username: candidate }).select('_id isDeleted').setOptions({ withDeleted: true }).lean();

    if (!existingUser) {
      return candidate;
    }
  }

  throw new AppError('Failed to generate a unique HR username after 20 attempts', 500);
};

const getEligibleSchoolsForJob = (job) => {
  return job?.eligibleSchools || [];
};

const cleanupInvalidApplicationsForSchool = async (studentId, newSchool, session) => {
  const query = Application.find({ student: studentId }).populate(
    'jobId',
    'eligibleSchools'
  );

  if (session) {
    query.session(session);
  }

  const applications = await query.lean();
  const invalidApplications = applications.filter((application) => {
    if (!application.jobId) {
      return true;
    }

    const eligibleSchools = getEligibleSchoolsForJob(application.jobId);
    return eligibleSchools.length > 0 && !eligibleSchools.includes(newSchool);
  });
  const invalidIds = invalidApplications.map((application) => application._id);

  if (invalidIds.length) {
    const deleteQuery = Application.deleteMany({ _id: { $in: invalidIds } });

    if (session) {
      deleteQuery.session(session);
    }

    await deleteQuery;

    const validApps = invalidApplications.filter(app => app.snapshotId);
    if (validApps.length) {
      await releaseSnapshotsForApplications(validApps);
    }
  }

  return { invalidIds, invalidApplications };
};

const createCompany = async (req) => {
  const { name, website = '', description = '' } = req.body;
  const normalizedName = normalizeCompanyName(name);

  const existingCompany = await Company.findOne({ normalizedName }).setOptions({
    withDeleted: true,
  });

  if (existingCompany && !existingCompany.isDeleted) {
    throw new AppError('Company already exists', 400);
  }

  let company;

  if (existingCompany && existingCompany.isDeleted) {
    existingCompany.name = normalizedName;
    existingCompany.normalizedName = normalizedName;
    existingCompany.slug = createSlug(normalizedName);
    existingCompany.website = website || '';
    existingCompany.description = description || '';
    existingCompany.isDeleted = false;
    existingCompany.isActive = true;
    company = await existingCompany.save();
  } else {
    company = await Company.create({
      name: String(name).trim(),
      normalizedName,
      slug: createSlug(normalizedName),
      website: website || '',
      description: description || '',
      createdBy: req.user._id,
    });
  }

  await createAuditLog({
    action: 'CREATE_COMPANY',
    req,
    performedBy: req.user._id,
    targetId: company._id,
    metadata: {
      companyName: company.name,
    },
  });

  return {
    statusCode: 201,
    message: 'Company created successfully',
    data: serializeCompany(company),
  };
};

const createHr = async (req) => {
  const { name, jobId, email = '', deliveryEmail } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedDeliveryEmail = normalizeEmail(deliveryEmail);

  if (!normalizedDeliveryEmail || !isValidEmail(normalizedDeliveryEmail)) {
    throw new AppError('A valid delivery email is required', 400);
  }

  // 1. Validate the job exists and is active
  const job = await Job.findById(jobId).select('isActive companyId title').lean();
  if (!job || !job.isActive) {
    throw new AppError('Job not found or inactive', 404);
  }

  // 2. Validate the company exists
  const company = await Company.findById(job.companyId).select('isActive name').lean();
  if (!company || !company.isActive) {
    throw new AppError('Company not found or inactive', 404);
  }

  // 3. Enforce: exactly 1 HR per job
  const existingHr = await User.findOne({ role: 'hr', jobId }).select('_id isDeleted').setOptions({ withDeleted: true }).lean();
  if (existingHr && !existingHr.isDeleted) {
    throw new AppError('An HR account already exists for this job', 400);
  }

  // 4. Email uniqueness check
  if (normalizedEmail) {
    const existingEmailUser = await User.findOne({ email: normalizedEmail }).setOptions({
      withDeleted: true,
    });

    if (existingEmailUser && !existingEmailUser.isDeleted) {
      throw new AppError('Email is already in use', 400);
    }
  }

  // 5. Generate immutable username: companyName_jobTitle_random
  const username = await generateUniqueUsername(company.name, job.title);
  const plainPassword = generateRandomPassword(8);
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  const hrUser = await User.create({
    name: name.trim(),
    email: normalizedEmail || undefined,
    username,
    password: hashedPassword,
    role: 'hr',
    companyId: company._id,
    jobId: job._id,
    isVerified: true,
    mustChangePassword: true,
    isActive: true,
    deliveryEmail: normalizedDeliveryEmail,
  });

  // Send credentials to delivery email; rollback user on failure
  try {
    await sendHrCredentialsEmail({
      deliveryEmail: normalizedDeliveryEmail,
      username,
      temporaryPassword: plainPassword,
      companyName: company.name,
      jobTitle: job.title,
    });
  } catch (error) {
    await User.deleteOne({ _id: hrUser._id, role: 'hr' });
    throw error;
  }

  // Update job with HR reference for O(1) checks
  await Job.findByIdAndUpdate(job._id, { hrId: hrUser._id });

  await createAuditLog({
    action: 'CREATE_HR',
    performedBy: req.user._id,
    targetId: hrUser._id,
    targetType: 'HR',
    metadata: {
      companyId: company._id,
      jobId: job._id,
      username,
      jobTitle: job.title,
      deliveryEmail: normalizedDeliveryEmail,
    },
  });

  return {
    statusCode: 201,
    message: 'HR credentials generated and emailed successfully',
    data: {
      hr: {
        _id: hrUser._id,
        name: hrUser.name,
        username: hrUser.username,
        email: hrUser.email || '',
        companyId: company._id,
        company: company.name,
        jobId: job._id,
        jobTitle: job.title,
        mustChangePassword: true,
      },
    },
  };
};

const createStaff = async (req) => {
  requireAdmin(req);

  const email = String(req.body.email || '').trim().toLowerCase();

  if (!email) {
    throw new AppError("Email is required", 400);
  }

  if (!isValidEmail(email)) {
    throw new AppError('Valid staff email is required', 400);
  }

  const normalizedName =
    String(req.body.name || '').trim() || email.split('@')[0] || 'Staff User';

  const permissions = normalizeStaffPermissions(req.body.permissions || {});

  const existingUser = await User.findOne({ email }).select('_id').lean();

  if (existingUser) {
    throw new AppError("Email already in use", 400);
  }

  const temporaryPassword = generateRandomPassword(12);
  const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

  let staffUser = null;

  try {
    staffUser = await User.create({
      name: normalizedName,
      email,
      role: 'staff',
      password: hashedPassword,
      mustChangePassword: true,
      isActive: true,
      isVerified: true,
      permissions,
    });

    // STEP 5: Send credentials
    await sendStaffCredentialsEmail({
      email,
      temporaryPassword,
    });

  } catch (error) {
    // rollback if partial insert happened
    if (staffUser?._id) {
      await User.deleteOne({ _id: staffUser._id, role: 'staff' });
    }

    // Handle Mongo duplicate safely
    if (error.code === 11000) {
      throw new AppError('Email already in use', 400);
    }

    throw error;
  }

  // STEP 6: Audit log (FIXED BUG HERE)
  try {
    await createAuditLog({
      action: 'CREATE_STAFF',
      req,
      performedBy: req.user._id,
      ...getActorSnapshot(req),
      target: { email }, // FIXED (was wrong variable before)
      targetId: staffUser._id,
      targetType: 'Staff',
      metadata: { permissions },
    });
  } catch (err) {
    console.error("Audit failed:", err);
  }

  return {
    statusCode: 201,
    message: 'Staff account created and credentials emailed successfully',
    data: {
      staff: serializeStaff(staffUser),
    },
  };
};


const getAllStaff = async (req) => {
  requireAdmin(req);

  const staff = await User.find({ role: 'staff' })
    .setOptions({ withDeleted: true })
    .select('_id name email role isActive isDeleted deletedAt mustChangePassword permissions createdAt updatedAt')
    .sort({ createdAt: -1 })
    .lean();

  return {
    message: 'Staff fetched successfully',
    data: {
      staff: staff.map(serializeStaff),
    },
  };
};

const updateStaffPermissions = async (req) => {
  requireAdmin(req);

  const staffId = getStaffIdFromBody(req.body);
  validateObjectId(staffId, 'staffId');

  const permissions = normalizeStaffPermissions(req.body.permissions, {
    requireAll: true,
  });

  const staff = await User.findById(staffId)
    .setOptions({ withDeleted: true })
    .select('_id name email role isActive isDeleted deletedAt mustChangePassword permissions');

  if (!staff) {
    throw new AppError('Staff not found', 404);
  }

  if (staff.role !== 'staff') {
    throw new AppError('Permissions can only be updated for staff accounts', 400);
  }

  if (staff.isDeleted) {
    throw new AppError('Cannot update permissions for deleted staff', 400);
  }

  staff.permissions = permissions;
  await staff.save();


  await createAuditLog({
    action: 'UPDATE_PERMISSIONS',
    req,
    performedBy: req.user._id,
    ...getActorSnapshot(req),
    target: { staffId, email: staff.email },
    targetId: staff._id,
    targetType: 'Staff',
    metadata: { permissions },
    timestamp: new Date(),
  });

  return {
    message: 'Staff permissions updated successfully',
    data: {
      staff: serializeStaff(staff),
    },
  };
};

const resetStaffPassword = async (req) => {
  requireAdmin(req);

  const staffId = getStaffIdFromBody(req.body);
  validateObjectId(staffId, 'staffId');

  const staff = await User.findOne({ _id: staffId, role: 'staff' })
    .setOptions({ withDeleted: true })
    .select('_id email isDeleted password mustChangePassword tokenVersion')
    .lean();

  if (!staff) {
    throw new AppError('Staff not found', 404);
  }

  if (staff.isDeleted) {
    throw new AppError('Cannot reset password for deleted staff', 400);
  }

  if (!isValidEmail(staff.email)) {
    throw new AppError('Staff account does not have a valid email address', 400);
  }

  const temporaryPassword = generateRandomPassword(12);
  const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

  const updatedStaff = await User.findOneAndUpdate(
    { _id: staffId, role: 'staff', isDeleted: false },
    {
      $set: {
        password: hashedPassword,
        mustChangePassword: true,
      },
      $inc: { tokenVersion: 1 },
    },
    { new: true, runValidators: true }
  )
    .select('_id email isActive mustChangePassword')
    .lean();

  if (!updatedStaff) {
    throw new AppError('Staff not found or deleted', 404);
  }


  try {
    await sendStaffCredentialsEmail({
      email: staff.email,
      temporaryPassword,
      isReset: true,
    });
  } catch (error) {
    await User.updateOne(
      { _id: staffId, role: 'staff', password: hashedPassword },
      {
        $set: {
          password: staff.password,
          mustChangePassword: staff.mustChangePassword,
          tokenVersion: staff.tokenVersion || 0,
        },
      }
    );


    throw error;
  }

  await createAuditLog({
    action: 'RESET_PASSWORD',
    req,
    performedBy: req.user._id,
    ...getActorSnapshot(req),
    target: { staffId, email: staff.email },
    targetId: staffId,
    targetType: 'Staff',
    metadata: { role: 'staff' },
    timestamp: new Date(),
  });

  return {
    message: 'Staff password reset and credentials emailed successfully',
    data: {
      staff: {
        _id: updatedStaff._id,
        email: updatedStaff.email,
        isActive: updatedStaff.isActive,
        mustChangePassword: updatedStaff.mustChangePassword,
      },
    },
  };
};

const updateStaffStatus = async (req) => {
  requireAdmin(req);

  const staffId = getStaffIdFromBody(req.body);
  const nextIsActive = getRequestedStaffActiveState(req.body);
  validateObjectId(staffId, 'staffId');

  const staff = await User.findOne({ _id: staffId, role: 'staff' })
    .setOptions({ withDeleted: true })
    .select('_id isActive isDeleted')
    .lean();

  if (!staff) {
    throw new AppError('Staff not found', 404);
  }

  if (staff.isDeleted) {
    throw new AppError('Cannot update a deleted staff account', 400);
  }

  if (staff.isActive === nextIsActive) {
    throw new AppError(
      nextIsActive ? 'Staff account is already unblocked' : 'Staff account is already blocked',
      409
    );
  }

  const updatePayload = {
    $set: { isActive: nextIsActive },
    ...(!nextIsActive ? { $inc: { tokenVersion: 1 } } : {}),
  };

  const updatedStaff = await User.findOneAndUpdate(
    {
      _id: staffId,
      role: 'staff',
      isDeleted: false,
      isActive: { $ne: nextIsActive },
    },
    updatePayload,
    { new: true, runValidators: true }
  )
    .select('_id email isActive')
    .lean();

  if (!updatedStaff) {
    throw new AppError('Staff status was already updated by another request', 409);
  }


  await createAuditLog({
    action: nextIsActive ? 'UNBLOCK' : 'BLOCK',
    req,
    performedBy: req.user._id,
    ...getActorSnapshot(req),
    target: { staffId, email: updatedStaff.email },
    targetId: staffId,
    targetType: 'Staff',
    metadata: { isActive: nextIsActive, role: 'staff' },
    timestamp: new Date(),
  });

  return {
    message: `Staff account ${nextIsActive ? 'unblocked' : 'blocked'} successfully`,
    data: { staff: updatedStaff },
  };
};

const deleteStaff = async (req) => {
  requireAdmin(req);

  const staffId = getStaffIdFromBody(req.body) || req.params.id;
  const deleteType = String(req.query.type || req.body.type || req.body.deleteType || 'soft')
    .trim()
    .toLowerCase();
  validateObjectId(staffId, 'staffId');
  preventSelfDeletion(staffId, req.user._id);

  if (!['soft', 'hard'].includes(deleteType)) {
    throw new AppError('Delete type must be soft or hard', 400);
  }

  const staff = await User.findOne({ _id: staffId, role: 'staff' })
    .setOptions({ withDeleted: true })
    .lean();

  if (!staff) {
    throw new AppError('Staff not found', 404);
  }

  if (await hasActiveJobsForStaff(staffId)) {
    throw new AppError('Cannot delete staff with active jobs. Please block instead.', 400);
  }

  const auditSnapshot = {
    action: 'DELETE_STAFF',
    req,
    performedBy: req.user._id,
    ...getActorSnapshot(req),
    target: { staffId },
    targetId: staffId,
    targetType: 'Staff',
    metadata: { type: deleteType },
  };

  if (deleteType === 'hard') {
    if (String(req.body.confirmation || '').trim() !== 'HARD_DELETE_STAFF') {
      throw new AppError('Confirmation strictly required for hard delete', 400);
    }



    const result = await User.deleteOne({ _id: staffId, role: 'staff' });
    if (result.deletedCount !== 1) {
      throw new AppError('Staff account was already deleted', 409);
    }

    await createAuditLog(auditSnapshot);

    return { message: 'Staff account permanently deleted' };
  }

  if (staff.isDeleted) {
    throw new AppError('Staff account is already deleted', 409);
  }

  const deletedAt = new Date();
  const deletedStaff = await User.findOneAndUpdate(
    { _id: staffId, role: 'staff', isDeleted: false },
    {
      $set: {
        isDeleted: true,
        isActive: false,
        deletedAt,
      },
    },
    { new: true, runValidators: true }
  )
    .select('_id email isActive isDeleted deletedAt')
    .lean();

  if (!deletedStaff) {
    throw new AppError('Staff account was already deleted by another request', 409);
  }

  await createAuditLog(auditSnapshot);


  return {
    message: 'Staff account deleted successfully',
    data: { staff: deletedStaff },
  };
};

const getAllStudents = async (req) => {
  const { branch, minCgpa, maxCgpa, search = '' } = req.query;
  const { page, limit, skip } = hasPaginationRequest(req)
    ? parsePagination(req.query, DEFAULT_LIMITS.admin)
    : { page: 1, limit: FALLBACK_LIMIT, skip: 0 };

  const studentFilter = {
    role: 'student',
    isVerified: true,
  };

  if (branch) {
    const branchRegex = createSearchRegex(branch);
    if (branchRegex) {
      studentFilter.branch = branchRegex;
    }
  }

  if (minCgpa || maxCgpa) {
    studentFilter.cgpa = {};
    if (minCgpa) {
      studentFilter.cgpa.$gte = Number(minCgpa);
    }
    if (maxCgpa) {
      studentFilter.cgpa.$lte = Number(maxCgpa);
    }
  }

  const searchRegex = createSearchRegex(search);
  if (searchRegex) {
    studentFilter.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { branch: searchRegex },
      { rollNumber: searchRegex },
      { admissionId: searchRegex },
    ];
  }

  if (req.query.schools) {
    const schoolsArray = String(req.query.schools).split(',').map(s => s.trim()).filter(Boolean);
    if (schoolsArray.length > 0) {
      studentFilter.school = { $in: schoolsArray };
    }
  }

  if (req.query.graduationYears) {
    const yearsArray = String(req.query.graduationYears).split(',').map(Number).filter(y => !isNaN(y));
    if (yearsArray.length > 0) {
      studentFilter.graduationYear = { $in: yearsArray };
    }
  }

  const [students, total] = await Promise.all([
    User.find(studentFilter)
      .select('name email branch cgpa tenthPercentage twelfthPercentage personalEmail mobileNumber gender links skills school rollNumber admissionId graduationYear resume resumeUrl resumePublicId')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(studentFilter),
  ]);

  const studentIds = students.map((student) => student._id);

  const activeResumes = await Resume.find({
    userId: { $in: studentIds },
    status: 'active'
  }).lean();

  const resumeMap = new Map();
  for (const r of activeResumes) {
    resumeMap.set(r.userId.toString(), r);
  }

  for (const student of students) {
    const resume = resumeMap.get(student._id.toString());
    if (resume?._id) {
      student.resumeId = resume._id;
    } else {
      student.resumeId = null;
    }
  }

  const applications = await Application.find({ student: { $in: studentIds } })
    .populate({
      path: 'jobId',
      select: '_id title company companyId location jobType deadline rounds',
      populate: {
        path: 'companyId',
        select: 'name',
      },
    })
    .lean()
    .then(apps =>
      apps.map(app => ({
        ...app,
        job: app.jobId
      }))
    );

  const applicationsByStudentId = applications.reduce((accumulator, application) => {
    const studentId = application.student.toString();

    if (!accumulator[studentId]) {
      accumulator[studentId] = [];
    }

    if (application.jobId) {
      const companyName = application.jobId.companyId?.name || application.jobId.company;

      accumulator[studentId].push({
        _id: application._id,
        status: application.status,
        currentRound: application.currentRound,
        rejectedAtRound: application.rejectedAtRound,
        job: {
          _id: application.jobId._id,
          title: application.jobId.title,
          company: {
            _id: application.jobId.companyId?._id || application.companyId || null,
            name: companyName,
          },
        },
        jobTitle: application.jobId.title,
        company: companyName,
      });
    }

    return accumulator;
  }, {});

  const result = students.map((student) => ({
    _id: student._id,
    name: student.name,
    email: student.email,
    branch: student.branch || 'N/A',
    cgpa: student.cgpa ?? 'N/A',
    tenthPercentage: student.tenthPercentage ?? 'N/A',
    twelfthPercentage: student.twelfthPercentage ?? 'N/A',
    personalEmail: student.personalEmail || 'N/A',
    mobileNumber: student.mobileNumber || 'N/A',
    gender: student.gender || 'N/A',
    links: student.links || [],
    school: student.school || 'N/A',
    rollNumber: student.rollNumber || 'N/A',
    admissionId: student.admissionId || 'N/A',
    graduationYear: student.graduationYear ?? 'N/A',
    skills: student.skills || [],
    resumeId: student.resumeId,
    applications: applicationsByStudentId[student._id.toString()] || [],
  }));

  return {
    items: result,
    total,
    page,
    limit,
    message: 'Students fetched successfully',
  };
};

const updateStudentDetails = async (req) => {
  const { school, graduationYear, rollNumber, admissionId } = req.body;
  const { id } = req.params;

  // 1. Validate the student exists
  const existingStudent = await User.findById(id).lean();
  if (!existingStudent || existingStudent.role !== 'student') {
    throw new AppError('Student not found', 404);
  }

  // 2. Build sanitized updates
  const updates = {};

  if (school !== undefined) {
    updates.school = String(school || '').trim();
  }

  if (rollNumber !== undefined) {
    updates.rollNumber = String(rollNumber || '').trim();
  }

  if (admissionId !== undefined) {
    updates.admissionId = String(admissionId || '').trim();
  }

  if (graduationYear !== undefined) {
    const year = Number(String(graduationYear).trim());

    if (isNaN(year)) {
      throw new AppError("Invalid graduation year", 400);
    }

    const allowedYears = getAllowedYears();

    if (!allowedYears.includes(year)) {
      throw new AppError("Invalid graduation year", 400);
    }

    updates.graduationYear = year;
  }

  // 3. Check admission ID uniqueness
  if (updates.admissionId) {
    const existingAdmission = await User.findOne({
      admissionId: updates.admissionId,
      _id: { $ne: id },
    }).setOptions({ withDeleted: true });

    if (existingAdmission && !existingAdmission.isDeleted) {
      throw new AppError('Admission ID already registered', 400);
    }
  }

  // 4. Remove applications that no longer match the student's school,
  // then update the student in the same transaction.
  let invalidApplicationIds = [];
  let invalidApplicationsForRelease = [];
  let updatedUser;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      if (updates.school !== undefined && existingStudent.school !== updates.school) {
        const cleanupResult = await cleanupInvalidApplicationsForSchool(
          id,
          updates.school,
          session
        );
        invalidApplicationIds = cleanupResult.invalidIds;
        invalidApplicationsForRelease = cleanupResult.invalidApplications;
      }

      updatedUser = await User.findByIdAndUpdate(
        id,
        updates,
        { new: true, runValidators: true, session }
      )
        .select('name email branch cgpa tenthPercentage twelfthPercentage personalEmail mobileNumber gender links skills school rollNumber admissionId graduationYear resume resumeUrl resumePublicId')
        .lean();

      if (!updatedUser) {
        throw new AppError('Student not found', 404);
      }
    });
  } finally {
    session.endSession();
  }

  await releaseSnapshotsForApplications(invalidApplicationsForRelease);

  // 5. Fetch applications so the admin UI can merge them into local state
  const applications = await Application.find({ student: id })
    .populate({
      path: 'jobId',
      select: '_id title company companyId location jobType deadline rounds',
      populate: { path: 'companyId', select: 'name' },
    })
    .lean();

  const mappedApplications = applications
    .filter((app) => app.jobId)
    .map((app) => {
      const companyName = app.jobId.companyId?.name || app.jobId.company;
      return {
        _id: app._id,
        status: app.status,
        currentRound: app.currentRound,
        rejectedAtRound: app.rejectedAtRound,
        job: {
          _id: app.jobId._id,
          title: app.jobId.title,
          company: {
            _id: app.jobId.companyId?._id || app.companyId || null,
            name: companyName,
          },
        },
        jobTitle: app.jobId.title,
        company: companyName,
      };
    });

  // 6. Audit log
  await createAuditLog({
    action: 'UPDATE_STUDENT_DETAILS',
    req,
    performedBy: req.user._id,
    targetId: id,
    targetType: 'Student',
    metadata: {
      school: updates.school,
      rollNumber: updates.rollNumber,
      admissionId: updates.admissionId,
      graduationYear: updates.graduationYear,
      invalidApplicationsRemoved: invalidApplicationIds.length,
    },
  });



  // 8. Return full student object matching the shape used in getAllStudents
  return {
    message: 'Student details updated successfully',
    data: {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      branch: updatedUser.branch || 'N/A',
      cgpa: updatedUser.cgpa ?? 'N/A',
      tenthPercentage: updatedUser.tenthPercentage ?? 'N/A',
      twelfthPercentage: updatedUser.twelfthPercentage ?? 'N/A',
      personalEmail: updatedUser.personalEmail || 'N/A',
      mobileNumber: updatedUser.mobileNumber || 'N/A',
      gender: updatedUser.gender || 'N/A',
      links: updatedUser.links || [],
      school: updatedUser.school || 'N/A',
      rollNumber: updatedUser.rollNumber || 'N/A',
      admissionId: updatedUser.admissionId || 'N/A',
      graduationYear: updatedUser.graduationYear ?? 'N/A',
      skills: updatedUser.skills || [],
      resumeUrl: '',
      applications: mappedApplications,
    },
  };
};

const deleteStudent = async (req) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new AppError('Invalid student identifier', 400);
  }

  preventSelfDeletion(req.params.id, req.user._id);

  const student = await User.findOne({ _id: req.params.id, role: 'student' }).setOptions({ withDeleted: true });

  if (!student) {
    throw new AppError('Student not found', 404);
  }



  const resumes = await Resume.find({ userId: student._id }).lean();
  const applicationsToDelete = await Application.find({
    $or: [
      { student: student._id },
      { userId: student._id },
    ],
  })
    .select('_id snapshotId resumeSnapshot')
    .lean();

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await Application.deleteMany({
        $or: [
          { student: student._id },
          { userId: student._id },
        ],
      }).session(session);
      await SavedJob.deleteMany({ student: student._id }).session(session);
      await User.findByIdAndDelete(student._id).session(session);
      await Resume.deleteMany({ userId: student._id }).session(session);
      await PushSubscription.deleteMany({ userId: student._id }).session(session);
    });

    await releaseSnapshotsForApplications(applicationsToDelete);

    for (const resume of resumes) {
      try {
        await r2Service.deleteObject(resume.key);
      } catch (err) {
        logger.warn(`admin:r2-resume-delete-failed error=${err.message}`);
      }
    }

    await createAuditLog({
      action: 'DELETE_STUDENT',
      req,
      performedBy: req.user._id,
      targetId: req.params.id,
      targetType: 'Student',
    });



    return {
      message: 'Student and all data deleted permanently',
    };
  } finally {
    session.endSession();
  }
};


const getAllHrs = async () => {
  const hrs = await User.find({ role: 'hr', isDeleted: false })
    .populate('companyId', 'name')
    .populate('jobId', 'title')
    .select('-password -otp -otpExpiry -otpHash -otpExpiresAt -resetOTP -resetOTPExpiry -resetOTPHash -resetOTPExpiresAt')
    .sort({ createdAt: -1 })
    .lean();

  return { message: 'HRs fetched successfully', data: hrs };
};

const updateStudentSchool = async (req) => {
  const { school } = req.body;
  const nextSchool = String(school || '').trim();
  let student;
  let invalidApplicationIds = [];
  let invalidApplicationsForRelease = [];
  let schoolChanged = false;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      student = await User.findById(req.params.id).session(session);
      if (!student || student.role !== 'student') throw new AppError('Student not found', 404);

      schoolChanged = student.school !== nextSchool;

      if (schoolChanged) {
        const cleanupResult = await cleanupInvalidApplicationsForSchool(
          student._id,
          nextSchool,
          session
        );
        invalidApplicationIds = cleanupResult.invalidIds;
        invalidApplicationsForRelease = cleanupResult.invalidApplications;
      }

      student.school = nextSchool;
      await student.save({ session });
    });
  } finally {
    session.endSession();
  }

  await releaseSnapshotsForApplications(invalidApplicationsForRelease);

  await createAuditLog({
    action: 'UPDATE_STUDENT_SCHOOL',
    performedBy: req.user._id,
    targetId: student._id,
    targetType: 'Student',
    metadata: {
      newSchool: nextSchool,
      invalidApplicationsRemoved: invalidApplicationIds.length,
    }
  });



  return { message: 'School updated successfully', data: student };
};

const updateHrStatus = async (req) => {
  const { isActive } = req.body;
  const hr = await User.findById(req.params.id);
  if (!hr || hr.role !== 'hr') throw new AppError('HR not found', 404);

  const wasActive = hr.isActive !== false;
  hr.isActive = isActive;

  if (wasActive && !isActive) {
    hr.tokenVersion = (hr.tokenVersion || 0) + 1;
  }

  await hr.save();


  await createAuditLog({
    action: isActive ? 'UNBLOCK_HR' : 'BLOCK_HR',
    performedBy: req.user._id,
    targetId: hr._id,
    targetType: 'HR'
  });

  return { message: `HR account ${isActive ? 'unblocked' : 'blocked'} successfully` };
};

const resetHrPassword = async (req) => {
  const hr = await User.findById(req.params.id).select('+password');
  if (!hr || hr.role !== 'hr') throw new AppError('HR not found', 404);

  // Use delivery email from request body (override) or stored value
  const deliveryEmail = normalizeEmail(req.body.deliveryEmail || hr.deliveryEmail);
  if (!deliveryEmail || !isValidEmail(deliveryEmail)) {
    throw new AppError('A valid delivery email is required', 400);
  }

  // Capture old values for rollback
  const oldPassword = hr.password;
  const oldMustChangePassword = hr.mustChangePassword;
  const oldTokenVersion = hr.tokenVersion || 0;

  const plainPassword = generateRandomPassword(8);
  hr.password = await bcrypt.hash(plainPassword, 12);
  hr.mustChangePassword = true;
  hr.tokenVersion = (hr.tokenVersion || 0) + 1;

  // Update deliveryEmail if a new one was provided
  if (req.body.deliveryEmail) {
    hr.deliveryEmail = deliveryEmail;
  }

  await hr.save();


  // Send credentials; rollback on email failure
  try {
    await sendHrCredentialsEmail({
      deliveryEmail,
      username: hr.username,
      temporaryPassword: plainPassword,
      isReset: true,
    });
  } catch (error) {
    await User.updateOne(
      { _id: hr._id, role: 'hr' },
      {
        $set: {
          password: oldPassword,
          mustChangePassword: oldMustChangePassword,
          tokenVersion: oldTokenVersion,
        },
      }
    );

    throw error;
  }

  await createAuditLog({
    action: 'RESET_HR_PASSWORD',
    performedBy: req.user._id,
    targetId: hr._id,
    targetType: 'HR',
    metadata: { deliveryEmail },
  });

  return {
    message: 'HR password reset and credentials emailed successfully',
  };
};

const deleteHr = async (req) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid HR identifier', 400);
  }

  preventSelfDeletion(id, req.user._id);

  const hr = await User.findOne({ _id: id, role: 'hr' }).setOptions({ withDeleted: true });
  if (!hr) {
    throw new AppError('HR not found', 404);
  }



  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await User.findOneAndDelete({ _id: id, role: 'hr' }).session(session);

      if (hr.jobId) {
        await Job.findByIdAndUpdate(hr.jobId, { $unset: { hrId: "" } }).session(session);
      }
    });

    await createAuditLog({
      action: 'DELETE_HR',
      performedBy: req.user._id,
      targetId: id,
      targetType: 'HR',
      metadata: { companyId: hr.companyId },
    });



    return { message: 'HR account permanently deleted' };
  } finally {
    session.endSession();
  }
};

const getBlocklist = async () => {
  const blocklist = await BlockedUser.find().sort({ createdAt: -1 });
  return { message: 'Blocklist fetched successfully', data: blocklist };
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getBlocklistV2Service = async ({ page = 1, limit = 50, search, reason, schools, graduationYears }) => {
  const query = {};
  const andConditions = [];

  if (search) {
    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      const safe = escapeRegex(trimmedSearch);
      const regex = new RegExp(safe, 'i');

      andConditions.push({
        $or: [
          { email: regex },
          { admissionId: regex }
        ]
      });
    }
  }

  if (reason === 'None') {
    andConditions.push({
      $or: [
        { reason: 'None' },
        { reason: { $exists: false } }
      ]
    });
  } else if (reason) {
    andConditions.push({ reason });
  }

  if (schools) {
    const schoolsArray = schools.split(',').map(s => s.trim()).filter(Boolean);
    if (schoolsArray.length > 0) {
      andConditions.push({ school: { $in: schoolsArray } });
    }
  }

  if (graduationYears) {
    const yearsArray = graduationYears.split(',').map(y => parseInt(y.trim(), 10)).filter(y => !isNaN(y));
    if (yearsArray.length > 0) {
      andConditions.push({ graduationYear: { $in: yearsArray } });
    }
  }

  if (andConditions.length > 0) {
    query.$and = andConditions;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 50), 100);
  const skip = (parsedPage - 1) * parsedLimit;

  const items = await BlockedUser.find(query)
    .skip(skip)
    .limit(parsedLimit)
    .sort({ createdAt: -1 });

  const total = await BlockedUser.countDocuments(query);

  return {
    items,
    total,
    page: parsedPage,
    pages: Math.ceil(total / parsedLimit)
  };
};

const addToBlocklist = async (req) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();
  const reason = req.body.reason;

  const targetUser = await User.findOne({ email }).select('role admissionId school graduationYear').lean();
  if (targetUser && ['admin', 'staff', 'hr'].includes(targetUser.role)) {
    throw new AppError('Cannot block internal accounts', 403);
  }

  const school = targetUser?.school || null;
  const graduationYear = targetUser?.graduationYear || null;
  const admissionId = targetUser?.admissionId || null;

  let blocked = await BlockedUser.findOne({ email }).select('_id isBlocked').lean();
  if (blocked) {
    if (blocked.isBlocked) throw new AppError('Email is already blocked', 400);
    await BlockedUser.updateOne({ _id: blocked._id }, { $set: { isBlocked: true, reason, school, graduationYear, admissionId } }, { runValidators: true });
    blocked.isBlocked = true;
    blocked.reason = reason;
  } else {
    blocked = await BlockedUser.create({ email, reason, school, graduationYear, admissionId });
  }

  const user = await User.findOne({ email }).select('_id').lean();
  if (user) {
    await User.updateOne(
      { _id: user._id, isActive: true },
      { $set: { isActive: false }, $inc: { tokenVersion: 1 } }
    );
    try {
      await PushSubscription.updateMany(
        {
          userId: user._id
        },
        {
          $set: {
            isActive: false,
            inactiveAt: new Date()
          }
        }
      );
    } catch (error) {
      console.error('Push subscription deactivation failed:', error);
    }
  }

  await createAuditLog({
    action: 'BLOCK_CANDIDATE',
    performedBy: req.user._id,
    targetId: blocked._id,
    targetType: 'Candidate',
    metadata: { email }
  });

  return { message: 'Email added to blocklist', data: blocked };
};

const updateBlocklistStatus = async (req) => {
  const { isBlocked } = req.body;
  const blocked = await BlockedUser.findById(req.params.id).select('_id email isBlocked').lean();
  if (!blocked) throw new AppError('Blocklist entry not found', 404);

  const targetUser = await User.findOne({ email: blocked.email }).select('role').lean();
  if (targetUser && ['admin', 'staff', 'hr'].includes(targetUser.role)) {
    throw new AppError('Cannot block internal accounts', 403);
  }

  await BlockedUser.updateOne({ _id: blocked._id }, { $set: { isBlocked } });
  blocked.isBlocked = isBlocked;

  const user = await User.findOne({ email: blocked.email }).select('_id').lean();
  if (user) {
    if (isBlocked) {
      await User.updateOne(
        { _id: user._id, isActive: true },
        { $set: { isActive: false }, $inc: { tokenVersion: 1 } }
      );
      try {
        await PushSubscription.updateMany(
          {
            userId: user._id
          },
          {
            $set: {
              isActive: false,
              inactiveAt: new Date()
            }
          }
        );
      } catch (error) {
        console.error('Push subscription deactivation failed:', error);
      }
    } else {
      await User.updateOne(
        { _id: user._id },
        { $set: { isActive: true } }
      );
    }
  }

  await createAuditLog({
    action: isBlocked ? 'BLOCK_CANDIDATE' : 'UNBLOCK_CANDIDATE',
    performedBy: req.user._id,
    targetId: blocked._id,
    targetType: 'Candidate',
    metadata: { email: blocked.email }
  });

  return { message: `Email ${isBlocked ? 'blocked' : 'unblocked'} successfully`, data: blocked };
};

const removeFromBlocklist = async (req) => {
  const blocked = await BlockedUser.findById(req.params.id).lean();
  if (!blocked) throw new AppError('Blocklist entry not found', 404);

  const user = await User.findOne({ email: blocked.email }).select('_id').lean();
  if (user) {
    await User.updateOne(
      { _id: user._id },
      { $set: { isActive: true } }
    );
  }

  await BlockedUser.findByIdAndDelete(req.params.id);

  await createAuditLog({
    action: 'UNBLOCK_CANDIDATE',
    performedBy: req.user._id,
    targetId: blocked._id,
    targetType: 'Candidate',
    metadata: { email: blocked.email }
  });

  return { message: 'Email removed from blocklist' };
};

const getDashboardStats = async () => {
  const [
    totalStudents,
    totalJobs,
    totalApplications,
    inProgress,
    rejected,
    selected,
    companies,
  ] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    Job.countDocuments(),
    Application.countDocuments(),
    Application.countDocuments({
      status: { $in: ['in_progress', 'Pending', 'Shortlisted'] }
    }),
    Application.countDocuments({
      status: { $in: ['rejected', 'Rejected'] }
    }),
    Application.countDocuments({
      status: { $in: ['selected', 'Selected'] }
    }),
    Application.aggregate([
      {
        $lookup: {
          from: 'jobs',
          localField: 'jobId',
          foreignField: '_id',
          as: 'jobData'
        }
      },
      { $unwind: '$jobData' },
      {
        $group: {
          _id: '$jobData.company',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).allowDiskUse(true),
  ]);

  return {
    data: {
      totalStudents,
      totalJobs,
      totalApplications,
      inProgress,
      rejected,
      selected,
      // Legacy aliases for backward compatibility
      shortlisted: inProgress,
      pending: inProgress,
      companies
    }
  };
};

const exportStudents = async (req) => {
  const { schools, graduationYears, selectedColumns } = req.body;

  const match = { role: 'student', isDeleted: false };
  
  if (Array.isArray(schools) && schools.length > 0) {
    match.school = { $in: schools };
  }
  
  if (Array.isArray(graduationYears) && graduationYears.length > 0) {
    match.graduationYear = { $in: graduationYears };
  }

  const students = await User.find(match)
    .select('rollNumber admissionId name school graduationYear branch cgpa tenthPercentage twelfthPercentage email personalEmail mobileNumber gender age skills createdAt')
    .sort({ createdAt: 1 })
    .lean();

  const buffer = await generateStudentExportWorkbook(students, selectedColumns, { schools, graduationYears });
  
  const d = new Date();
  const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  
  return {
    buffer,
    filename: `PlaceHub_Students_${dateStr}.xlsx`
  };
};

module.exports = {
  createCompany,
  createHr,
  createStaff,
  getAllStaff,
  updateStaffPermissions,
  resetStaffPassword,
  updateStaffStatus,
  deleteStaff,
  getAllStudents,
  updateStudentDetails,
  deleteStudent,
  getAllHrs,
  updateStudentSchool,
  updateHrStatus,
  resetHrPassword,
  deleteHr,
  getBlocklist,
  getBlocklistV2Service,
  addToBlocklist,
  updateBlocklistStatus,
  removeFromBlocklist,
  getDashboardStats,
  exportStudents,
};
