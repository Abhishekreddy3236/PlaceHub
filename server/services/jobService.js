const Job = require('../models/Job');
const User = require('../models/User');
const Company = require('../models/Company');
const Application = require('../models/Application');
const SavedJob = require('../models/SavedJob');
const JobAttachment = require('../models/JobAttachment');
const mongoose = require('mongoose');
const logger = require('../config/logger');
const streamifier = require('streamifier');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');
const { resolveCompanyForJob } = require('../utils/company');
const { releaseSnapshotsForApplications } = require('./resumeFileService');
const r2Service = require('./r2Service');
const jobAttachmentR2Service = require('./jobAttachmentR2Service');
const notificationQueue = require('./notification/queueService');
const {
  normalizeArrayInput,
  parsePagination,
  createSearchRegex,
  hasPaginationRequest,
  DEFAULT_LIMITS,
  FALLBACK_LIMIT,
} = require('../utils/query');
const { serializeApplication, serializeJob } = require('../utils/serializers');
const { generateJobExportWorkbook } = require('../utils/jobExcelExporter');
const { sanitizeText, sanitizeMarkdown } = require('../utils/sanitize');

const DEFAULT_ROUNDS = [{ name: 'Round 1', description: '', order: 1 }];

const enforceHrJobAccess = (user, jobId) => {
  if (user?.role === "hr") {
    const hrJobId = String(user.jobId?._id || user.jobId);
    const targetJobId = String(jobId?._id || jobId);

    if (!hrJobId) {
      throw new AppError("HR not assigned to job", 403);
    }

    if (hrJobId !== targetJobId) {
      throw new AppError("Unauthorized", 403);
    }
  }
};

const uploadLogoToR2 = async (file, companyName) => {
  if (!file || !file.buffer || file.buffer.length < 12) {
    throw new AppError("Invalid or empty image file", 400);
  }

  const buffer = file.buffer;

  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47;

  const isJpg =
    buffer[0] === 0xFF &&
    buffer[1] === 0xD8 &&
    buffer[2] === 0xFF;

  if (!isPng && !isJpg) {
    throw new AppError("Invalid image file", 400);
  }

  const originalName = (file.originalname || "").toLowerCase();
  if (originalName.endsWith(".png") && !isPng) {
    throw new AppError("Invalid image file", 400);
  }
  if ((originalName.endsWith(".jpg") || originalName.endsWith(".jpeg")) && !isJpg) {
    throw new AppError("Invalid image file", 400);
  }

  let safeName = (companyName || "company")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!safeName) {
    safeName = "company";
  }
  const fileName = `logos/${safeName}_logo_${Date.now()}.png`;

  try {
    const publicUrl = await r2Service.uploadLogoBuffer(fileName, file.buffer, file.mimetype || "image/png");
    return { secure_url: publicUrl, public_id: fileName };
  } catch (error) {
    throw new AppError('Logo upload failed: ' + error.message, 500);
  }
};

const parseRoundsInput = (rawRounds, { allowMissing } = {}) => {
  if (rawRounds === undefined) {
    return allowMissing ? undefined : DEFAULT_ROUNDS;
  }

  let rounds = rawRounds;

  if (typeof rounds === 'string' && rounds.trim().startsWith('[')) {
    try {
      rounds = JSON.parse(rounds);
    } catch (error) {
      throw new AppError('Rounds format is invalid', 400);
    }
  }

  if (!Array.isArray(rounds)) {
    throw new AppError('Rounds format is invalid', 400);
  }

  if (!rounds.length) {
    throw new AppError('At least one round is required', 400);
  }

  const normalizedRounds = rounds.map((round, index) => {
    const name = sanitizeText(round?.name);
    const description = sanitizeText(round?.description);
    const order = Number.isFinite(Number(round?.order))
      ? Number(round.order)
      : index + 1;

    if (!name) {
      throw new AppError('Round name is required', 400);
    }

    if (!Number.isInteger(order) || order < 1) {
      throw new AppError('Round order must be a positive integer', 400);
    }

    return { name, description, order };
  });

  const sortedRounds = [...normalizedRounds].sort((a, b) => a.order - b.order);
  const isSequential = sortedRounds.every((round, index) => round.order === index + 1);

  if (!isSequential) {
    throw new AppError('Round order must be sequential starting from 1', 400);
  }

  return sortedRounds;
};

const parseJobPayload = async (req, options = {}) => {
  const allowedFields = [
    'title', 'company', 'description', 'location',
    'jobType', 'salary', 'deadline', 'skills',
    'requirements', 'eligibleSchools', 'rounds', 'graduationYears'
  ];
  const payload = {};

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      payload[field] = req.body[field];
    }
  });

  payload.title = sanitizeText(payload.title);
  payload.company = sanitizeText(payload.company);
  payload.description = sanitizeMarkdown(payload.description);
  payload.location = sanitizeText(payload.location);
  payload.jobType = String(payload.jobType || '').trim();
  payload.salary = sanitizeText(payload.salary);
  payload.deadline = payload.deadline ? new Date(payload.deadline) : null;

  if (typeof payload.skills === 'string' && payload.skills.startsWith('[')) {
    try {
      payload.skills = JSON.parse(payload.skills);
    } catch (error) {
      throw new AppError('Skills format is invalid', 400);
    }
  }
  payload.skills = normalizeArrayInput(payload.skills);

  if (typeof payload.requirements === 'string' && payload.requirements.startsWith('[')) {
    try {
      payload.requirements = JSON.parse(payload.requirements);
    } catch (error) {
      throw new AppError('Requirements format is invalid', 400);
    }
  }
  payload.requirements = normalizeArrayInput(payload.requirements);

  if (typeof payload.eligibleSchools === 'string' && payload.eligibleSchools.startsWith('[')) {
    try {
      payload.eligibleSchools = JSON.parse(payload.eligibleSchools);
    } catch (error) {
      throw new AppError('Eligible Schools format is invalid', 400);
    }
  }
  if (typeof payload.graduationYears === 'string' && payload.graduationYears.startsWith('[')) {
    try {
      payload.graduationYears = JSON.parse(payload.graduationYears);
    } catch (error) {
      throw new AppError('Graduation Years format is invalid', 400);
    }
  }

  if (payload.graduationYears) {
    const rawYears = Array.isArray(payload.graduationYears) ? payload.graduationYears : [payload.graduationYears];
    payload.graduationYears = rawYears.map(Number).filter(y => !isNaN(y) && y >= 2000 && y <= 2100);
  } else {
    payload.graduationYears = [];
  }

  const normalizedEligible = normalizeArrayInput(payload.eligibleSchools);
  payload.eligibleSchools = normalizedEligible;

  if (!payload.title || !payload.description || !payload.location || !payload.company) {
    throw new AppError('Title, company, location, and description are required', 400);
  }

  if (!['Full-time', 'Part-time', 'Internship', 'Contract'].includes(payload.jobType)) {
    throw new AppError('Invalid job type', 400);
  }

  if (!payload.deadline || Number.isNaN(payload.deadline.getTime())) {
    throw new AppError('Valid deadline date is required', 400);
  }

  if (!payload.skills.length) {
    throw new AppError('At least one skill is required', 400);
  }

  const rounds = parseRoundsInput(payload.rounds, {
    allowMissing: options.allowMissingRounds,
  });

  if (rounds !== undefined) {
    payload.rounds = rounds;
  } else {
    delete payload.rounds;
  }

  return payload;
};

const getAllJobs = async (req) => {
  const { search = '', companyId } = req.query;
  const { page, limit, skip } = hasPaginationRequest(req)
    ? parsePagination(req.query, DEFAULT_LIMITS.jobs)
    : { page: 1, limit: FALLBACK_LIMIT, skip: 0 };
  const searchRegex = createSearchRegex(search);

  const jobFilter = {
    isActive: true,
  };

  const andConditions = [];

  if (searchRegex) {
    andConditions.push({
      $or: [
        { title: searchRegex },
        { company: searchRegex },
      ]
    });
  }

  if (req.user?.role === 'student') {
    const studentSchool = req.user.school || 'B. Tech';
    const studentGradYear = req.user.graduationYear;

    const schoolCondition = {
      $or: [
        { eligibleSchools: { $exists: false } },
        { eligibleSchools: { $size: 0 } },
        { eligibleSchools: studentSchool }
      ]
    };

    const gradCondition = studentGradYear
      ? {
        $or: [
          { graduationYears: { $exists: false } },
          { graduationYears: { $size: 0 } },
          { graduationYears: studentGradYear }
        ]
      }
      : {
        $or: [
          { graduationYears: { $exists: false } },
          { graduationYears: { $size: 0 } }
        ]
      };

    andConditions.push(schoolCondition);
    andConditions.push(gradCondition);

    andConditions.push({ deadline: { $gte: new Date() } });
  }

  if (req.user?.role === 'hr') {
    const hrJobId = req.user.jobId?._id || req.user.jobId;

    if (!hrJobId) {
      throw new AppError('HR not assigned to a job', 403);
    }

    jobFilter._id = hrJobId;
  }

  if (req.user?.role === 'admin' || req.user?.role === 'staff') {
    const { school, graduationYear } = req.query;

    if (school) {
      const schoolsArray = school.split(',').map(s => s.trim()).filter(Boolean);
      if (schoolsArray.length > 0) {
        andConditions.push({
          $or: [
            { eligibleSchools: { $exists: false } },
            { eligibleSchools: { $size: 0 } },
            { eligibleSchools: { $in: schoolsArray } }
          ]
        });
      }
    }

    if (graduationYear) {
      const yearsArray = graduationYear.split(',').map(Number).filter(y => !isNaN(y));
      if (yearsArray.length > 0) {
        andConditions.push({
          $or: [
            { graduationYears: { $exists: false } },
            { graduationYears: { $size: 0 } },
            { graduationYears: { $in: yearsArray } }
          ]
        });
      }
    }
  }

  if (andConditions.length > 0) {
    jobFilter.$and = andConditions;
  }

  if (companyId) {
    jobFilter.companyId = companyId;
  }

  const [jobs, total] = await Promise.all([
    Job.find(jobFilter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Job.countDocuments(jobFilter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: {
      items: jobs.map(serializeJob),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
    message: 'Jobs fetched successfully',
  };
};

const getClosedJobs = async (req) => {
  const { search = '' } = req.query;
  const { page, limit, skip } = hasPaginationRequest(req)
    ? parsePagination(req.query, 12)
    : { page: 1, limit: 5000, skip: 0 };
  const searchRegex = createSearchRegex(search);

  const appliedJobs = await Application.find({ student: req.user._id, isDeleted: false }, 'jobId job').lean();
  const appliedJobIds = [...new Set(appliedJobs.map(app => (app.jobId || app.job)?.toString()).filter(Boolean))];

  const jobFilter = {
    isActive: true,
    deadline: { $lt: new Date() },
    _id: { $nin: appliedJobIds }
  };

  const andConditions = [];

  if (searchRegex) {
    andConditions.push({
      $or: [
        { title: searchRegex },
        { company: searchRegex },
      ]
    });
  }

  if (req.user?.role === 'student') {
    const studentSchool = req.user.school || 'B. Tech';
    const studentGradYear = req.user.graduationYear;

    const schoolCondition = {
      $or: [
        { eligibleSchools: { $exists: false } },
        { eligibleSchools: { $size: 0 } },
        { eligibleSchools: studentSchool }
      ]
    };

    const gradCondition = studentGradYear
      ? {
        $or: [
          { graduationYears: { $exists: false } },
          { graduationYears: { $size: 0 } },
          { graduationYears: studentGradYear }
        ]
      }
      : {
        $or: [
          { graduationYears: { $exists: false } },
          { graduationYears: { $size: 0 } }
        ]
      };

    andConditions.push(schoolCondition);
    andConditions.push(gradCondition);
  }

  if (andConditions.length > 0) {
    jobFilter.$and = andConditions;
  }

  const [jobs, total] = await Promise.all([
    Job.find(jobFilter)
      .sort({ deadline: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Job.countDocuments(jobFilter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: {
      items: jobs.map(serializeJob),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
    message: 'Closed jobs fetched successfully',
  };
};

const getRecommendedJobs = async (req) => {
  const profile = await User.findById(req.user._id)
    .setOptions({ withDeleted: true })
    .select('school skills isDeleted isActive')
    .lean();

  if (!profile || profile.isDeleted) {
    throw new AppError('User not found', 404);
  }

  if (profile.isActive === false) {
    throw new AppError('Account is blocked', 403);
  }

  const school =
    profile.school && String(profile.school).trim() !== ''
      ? profile.school
      : req.user.school || 'B. Tech';
  const user = {
    ...req.user,
    school,
    skills: profile.skills || [],
  };

  if (!user.skills || user.skills.length === 0) {
    const conditions = {
      isActive: true
    };

    const schoolCondition = {
      $or: [
        { eligibleSchools: { $exists: false } },
        { eligibleSchools: { $size: 0 } },
        { eligibleSchools: user.school }
      ]
    };

    const gradCondition = profile.graduationYear
      ? {
        $or: [
          { graduationYears: { $exists: false } },
          { graduationYears: { $size: 0 } },
          { graduationYears: profile.graduationYear }
        ]
      }
      : {
        $or: [
          { graduationYears: { $exists: false } },
          { graduationYears: { $size: 0 } }
        ]
      };

    conditions.$and = conditions.$and || [];
    conditions.$and.push(schoolCondition);
    conditions.$and.push(gradCondition);
    conditions.$and.push({ deadline: { $gte: new Date() } });

    const jobs = await Job.find(conditions)
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    const serializedJobs = jobs.map(serializeJob);
    return {
      data: {
        items: serializedJobs,
        pagination: {
          page: 1,
          limit: serializedJobs.length || 10,
          total: serializedJobs.length,
          totalPages: 1,
        },
      },
    };
  }

  const studentSchool = user.school || 'B. Tech';

  const conditions = {
    isActive: true,
    skills: { $in: user.skills }
  };

  const schoolCondition = {
    $or: [
      { eligibleSchools: { $exists: false } },
      { eligibleSchools: { $size: 0 } },
      { eligibleSchools: studentSchool }
    ]
  };

  const gradCondition = profile.graduationYear
    ? {
      $or: [
        { graduationYears: { $exists: false } },
        { graduationYears: { $size: 0 } },
        { graduationYears: profile.graduationYear }
      ]
    }
    : {
      $or: [
        { graduationYears: { $exists: false } },
        { graduationYears: { $size: 0 } }
      ]
    };

  conditions.$and = conditions.$and || [];
  conditions.$and.push(schoolCondition);
  conditions.$and.push(gradCondition);
  conditions.$and.push({ deadline: { $gte: new Date() } });

  const jobs = await Job.find(conditions)
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const scoredJobs = jobs
    .map((job) => {
      const matchScore = (job.skills || []).filter((skill) =>
        user.skills.some((userSkill) => userSkill.toLowerCase() === skill.toLowerCase())
      ).length;

      return serializeJob({
        ...job,
        matchScore,
      });
    })
    .sort((left, right) => right.matchScore - left.matchScore)
    .slice(0, 10);

  return {
    data: {
      items: scoredJobs,
      pagination: {
        page: 1,
        limit: scoredJobs.length || 10,
        total: scoredJobs.length,
        totalPages: 1,
      },
    },
  };
};

const getJobById = async (req) => {
  let job;

  if (req.user && req.user.role === 'student') {
    const studentSchool = req.user.school || 'B. Tech';
    const studentGradYear = req.user.graduationYear;

    const conditions = {
      _id: req.params.id,
      isActive: true,
      isDeleted: false,
      deadline: { $gte: new Date() }
    };

    const schoolCondition = {
      $or: [
        { eligibleSchools: { $exists: false } },
        { eligibleSchools: { $size: 0 } },
        { eligibleSchools: studentSchool }
      ]
    };

    const gradCondition = studentGradYear
      ? {
        $or: [
          { graduationYears: { $exists: false } },
          { graduationYears: { $size: 0 } },
          { graduationYears: studentGradYear }
        ]
      }
      : {
        $or: [
          { graduationYears: { $exists: false } },
          { graduationYears: { $size: 0 } }
        ]
      };

    conditions.$and = conditions.$and || [];
    conditions.$and.push(schoolCondition);
    conditions.$and.push(gradCondition);

    job = await Job.findOne(conditions).lean();
  } else {
    job = await Job.findById(req.params.id).lean();
  }

  if (!job) {
    throw new AppError('Job not found', 404);
  }

  try {
    enforceHrJobAccess(req.user, job._id);
  } catch (err) {
    throw new AppError('Unauthorized', 403);
  }

  return {
    data: serializeJob(job),
  };
};

const createJob = async (req) => {
  const payload = await parseJobPayload(req);
  const company = await resolveCompanyForJob({
    companyId: req.body.companyId,
    companyName: payload.company,
    createdBy: req.user._id,
  });

  const jobPayload = {
    ...payload,
    company: company.name,
    companyId: company._id,
    postedBy: req.user._id,
  };

  // Check for duplicate: same company + same title (case-insensitive)
  const normalizedTitle = payload.title.trim().toLowerCase();
  const existingJob = await Job.findOne({
    companyId: company._id,
    normalizedTitle,
    isDeleted: false,
  });

  if (existingJob) {
    throw new AppError('Job already exists for this company and role', 400);
  }

  if (req.file) {
    const logo = await uploadLogoToR2(req.file, String(Date.now()));
    jobPayload.logo = logo.secure_url;
    jobPayload.logoPublicId = logo.public_id;
  }

  const job = await Job.create(jobPayload);

  // Do NOT block main flow if audit log fails
  try {
    await createAuditLog({
      action: 'CREATE_JOB',
      req,
      performedBy: req.user._id,
      targetId: job._id,
      metadata: {
        companyId: company._id,
        companyName: company.name,
        title: job.title,
      },
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }

  // NON-BLOCKING NOTIFICATION TRIGGER
  try {
    notificationQueue.notifyJobCreated(job._id).catch(err => {
      logger.error('Notification queue push failed', err);
    });
  } catch (e) {
    logger.error('Notification module error', e);
  }

  return {
    statusCode: 201,
    message: 'Job created successfully',
    data: serializeJob(job),
  };
};

const updateJob = async (req) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new AppError('Invalid ID', 400);
  }

  const payload = await parseJobPayload(req, { allowMissingRounds: true });
  const job = await Job.findById(req.params.id).select('company companyId logoPublicId title').lean();

  if (!job) {
    throw new AppError('Job not found', 404);
  }

  const updateData = {
    ...payload,
    title: job.title,
    company: job.company,
    companyId: job.companyId,
  };

  let oldLogoToDelete = null;

  if (req.body.removeLogo === 'true') {
    if (job.logoPublicId) {
      oldLogoToDelete = job.logoPublicId;
    }

    updateData.logo = '';
    updateData.logoPublicId = '';
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError("No valid fields provided for update", 400);
  }

  if (req.file) {
    if (job.logoPublicId) {
      oldLogoToDelete = job.logoPublicId;
    }

    const logo = await uploadLogoToR2(req.file, String(Date.now()));
    updateData.logo = logo.secure_url;
    updateData.logoPublicId = logo.public_id;
  }

  const updatedJob = await Job.findByIdAndUpdate(
    req.params.id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!updatedJob) {
    throw new AppError('Resource not found or modified concurrently', 404);
  }

  if (oldLogoToDelete) {
    await r2Service.deleteLogoObject(oldLogoToDelete).catch(err => {
      logger.error(`job:logo-delete-failed error=${err.message}`);
    });
  }

  return {
    message: 'Job updated successfully',
    data: serializeJob(updatedJob),
  };
};

const deleteJob = async (req) => {
  const start = Date.now();
  const job = await Job.findById(req.params.id).select('companyId logoPublicId title').lean();

  if (!job) {
    throw new AppError('Job not found', 404);
  }

  const companyId = job.companyId;
  const deletedApplications = await Application.countDocuments({ jobId: req.params.id });

  if (deletedApplications > 2000) {
    throw new AppError('Too many applications to delete at once', 400);
  }

  // Batch fetch and release snapshots
  const batchSize = 100;
  let lastId = null;
  let applicationIds = [];
  const appsForSnapshotRelease = [];

  while (true) {
    const query = { jobId: req.params.id };
    if (lastId) {
      query._id = { $gt: lastId };
    }

    const batch = await Application.find(query)
      .limit(batchSize)
      .select('_id snapshotId resumeSnapshot')
      .sort({ _id: 1 })
      .lean();

    if (!batch.length) break;

    lastId = batch[batch.length - 1]._id;
    applicationIds.push(...batch.map(app => String(app._id)));

    appsForSnapshotRelease.push(...batch);
  }

  const attachments = await JobAttachment.find({ jobId: req.params.id }).select('r2Key').lean();

  const session = await mongoose.startSession();
  let jobWasDeleted = false;

  try {
    await session.withTransaction(async () => {
      jobWasDeleted = false;
      const deletedJob = await Job.findByIdAndDelete(req.params.id).session(session);

      if (!deletedJob) {
        return;
      }

      jobWasDeleted = true;

      await Application.deleteMany({ jobId: req.params.id }).session(session);
      await SavedJob.deleteMany({ job: req.params.id }).session(session);
      await JobAttachment.deleteMany({ jobId: req.params.id }).session(session);

      // Delete the HR account linked to this specific job
      await User.deleteMany({ role: 'hr', jobId: req.params.id }).session(session);

      const remainingJobs = await Job.countDocuments({ companyId }).session(session);

      if (remainingJobs === 0) {
        await Company.deleteOne({ _id: companyId }).session(session);
        // Also clean up any legacy HR accounts still linked by companyId only
        await User.deleteMany({ role: 'hr', companyId }).session(session);
      }
    });

    if (!jobWasDeleted) {
      return { message: 'Job already deleted' };
    }

    await releaseSnapshotsForApplications(appsForSnapshotRelease);

    // Delete logo from R2
    if (job.logoPublicId) {
      await r2Service.deleteLogoObject(job.logoPublicId).catch((err) => {
        logger.error(`job:logo-delete-failed error=${err.message}`);
      });
    }

    if (attachments.length > 0) {
      Promise.allSettled(
        attachments.map(attachment => jobAttachmentR2Service.deleteFile(attachment.r2Key))
      ).then(results => {
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            logger.error(
              'job:attachment-r2-delete-failed',
              {
                r2Key: attachments[index]?.r2Key,
                error: result.reason?.message
              }
            );
          }
        });
      }).catch(error => {
        logger.error(
          'job:attachment-r2-cleanup-handler-failed',
          {
            error: error.message
          }
        );
      });
    }

    try {
      await createAuditLog({
        action: 'DELETE_JOB',
        req,
        performedBy: req.user._id,
        targetId: req.params.id,
        targetType: 'Job',
        metadata: {
          jobTitle: job.title,
          companyId,
          deletedApplications,
        },
      });
    } catch (err) {
      console.error("Audit failed:", err);
    }

    logger.info('deleteJob completed', {
      jobId: req.params.id,
      duration: Date.now() - start
    });

    return {
      message: 'Job deleted successfully',
    };
  } finally {
    session.endSession();
  }
};

const bulkDeleteJobs = async (req) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || !ids.length) {
    throw new AppError('No valid IDs provided', 400);
  }

  const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));

  if (!validIds.length) {
    throw new AppError('No valid IDs provided', 400);
  }

  if (validIds.length > 20) {
    throw new AppError('A maximum of 20 jobs can be deleted in one bulk operation.', 400);
  }

  const jobsForAudit = await Job.find({ _id: { $in: validIds } })
    .select('_id title companyId logoPublicId')
    .lean();
  const deletedApplications = await Application.countDocuments({ jobId: { $in: validIds } });

  // Collect application IDs for folder-wipe cleanup and release snapshots
  const batchSize = 100;
  let skipCount = 0;
  let applicationIds = [];
  const appsForSnapshotRelease = [];

  while (true) {
    const batch = await Application.find({ jobId: { $in: validIds } })
      .skip(skipCount)
      .limit(batchSize)
      .select('_id snapshotId resumeSnapshot')
      .lean();

    if (!batch.length) break;

    applicationIds.push(...batch.map(app => String(app._id)));
    appsForSnapshotRelease.push(...batch);

    skipCount += batchSize;
  }
  const logoPaths = jobsForAudit
    .map((j) => j.logoPublicId)
    .filter(Boolean);

  const attachments = await JobAttachment.find({ jobId: { $in: validIds } }).select('r2Key').lean();

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const jobs = await Job.find({ _id: { $in: validIds } }).session(session);
      const companyIds = [...new Set(jobs.filter(j => j.companyId).map(j => j.companyId.toString()))];

      await Job.deleteMany({ _id: { $in: validIds } }).session(session);
      await Application.deleteMany({ jobId: { $in: validIds } }).session(session);
      await SavedJob.deleteMany({ job: { $in: validIds } }).session(session);
      await JobAttachment.deleteMany({ jobId: { $in: validIds } }).session(session);

      // Delete the HR accounts linked to these specific jobs
      await User.deleteMany({ role: 'hr', jobId: { $in: validIds } }).session(session);

      for (const companyId of companyIds) {
        const count = await Job.countDocuments({ companyId }).session(session);
        if (count === 0) {
          await Company.deleteOne({ _id: companyId }).session(session);
          await User.deleteMany({ role: 'hr', companyId }).session(session);
        }
      }
    });

    await releaseSnapshotsForApplications(appsForSnapshotRelease);

    // Delete logos from R2
    if (logoPaths.length) {
      await r2Service.deleteLogoObjects(logoPaths).catch((err) => {
        logger.error(`job:bulk-logo-delete-failed error=${err.message}`);
      });
    }

    if (attachments.length > 0) {
      Promise.allSettled(
        attachments.map(attachment => jobAttachmentR2Service.deleteFile(attachment.r2Key))
      ).then(results => {
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            logger.error(
              'job:attachment-r2-delete-failed',
              {
                r2Key: attachments[index]?.r2Key,
                error: result.reason?.message
              }
            );
          }
        });
      }).catch(error => {
        logger.error(
          'job:attachment-r2-cleanup-handler-failed',
          {
            error: error.message
          }
        );
      });
    }

    await createAuditLog({
      action: 'BULK_DELETE_JOBS',
      req,
      performedBy: req.user._id,
      targetType: 'Job',
      metadata: {
        jobIds: validIds,
        jobTitles: jobsForAudit.map((job) => job.title),
        deletedJobs: jobsForAudit.length,
        deletedApplications,
      },
    });

    return { message: 'Jobs deleted successfully' };
  } finally {
    session.endSession();
  }
};

const getJobDetailsContext = async (req) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new AppError('Invalid ID', 400);
  }

  let job;
  if (req.user && req.user.role === 'student') {
    const studentSchool = req.user.school || 'B. Tech';
    const studentGradYear = req.user.graduationYear;

    const conditions = {
      _id: req.params.id,
      isActive: true,
      isDeleted: false
    };

    const schoolCondition = {
      $or: [
        { eligibleSchools: { $exists: false } },
        { eligibleSchools: { $size: 0 } },
        { eligibleSchools: studentSchool }
      ]
    };

    const gradCondition = studentGradYear
      ? {
        $or: [
          { graduationYears: { $exists: false } },
          { graduationYears: { $size: 0 } },
          { graduationYears: studentGradYear }
        ]
      }
      : {
        $or: [
          { graduationYears: { $exists: false } },
          { graduationYears: { $size: 0 } }
        ]
      };

    conditions.$and = conditions.$and || [];
    conditions.$and.push(schoolCondition);
    conditions.$and.push(gradCondition);

    job = await Job.findOne(conditions).lean();
  } else {
    job = await Job.findById(req.params.id).lean();
  }

  if (!job) {
    throw new AppError('Job not found', 404);
  }

  const [application, savedJob] = await Promise.all([
    Application.findOne({
      $or: [
        { job: req.params.id, student: req.user._id },
        { jobId: req.params.id, userId: req.user._id }
      ]
    }).lean(),
    SavedJob.findOne({
      $or: [
        { job: req.params.id, student: req.user._id },
        { jobId: req.params.id, userId: req.user._id }
      ]
    }).lean()
  ]);

  const applied = Boolean(application);
  const saved = Boolean(savedJob);

  return {
    data: {
      job: serializeJob(job),
      application: {
        applied,
        application: applied ? await serializeApplication({ ...application, job }) : null,
      },
      saved,
      savedJob: saved,
    }
  };
};

const exportJobs = async (req) => {
  const jobFilter = { isActive: true };
  const andConditions = [];

  const schools = req.body.schools || [];
  const graduationYears = req.body.graduationYears || [];

  if (schools.length > 0) {
    andConditions.push({
      $or: [
        { eligibleSchools: { $exists: false } },
        { eligibleSchools: { $size: 0 } },
        { eligibleSchools: { $in: schools } }
      ]
    });
  }

  if (graduationYears.length > 0) {
    andConditions.push({
      $or: [
        { graduationYears: { $exists: false } },
        { graduationYears: { $size: 0 } },
        { graduationYears: { $in: graduationYears } }
      ]
    });
  }

  if (andConditions.length > 0) {
    jobFilter.$and = andConditions;
  }

  const jobs = await Job.find(jobFilter)
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  const jobIds = jobs.map((job) => job._id);

  const aggregationResult = await Application.aggregate([
    { $match: { jobId: { $in: jobIds }, isDeleted: false } },
    {
      $group: {
        _id: { jobId: "$jobId", status: "$status" },
        count: { $sum: 1 }
      }
    }
  ]);

  const countsMap = {};
  for (const item of aggregationResult) {
    const jId = item._id.jobId.toString();
    const st = item._id.status;
    if (!countsMap[jId]) {
      countsMap[jId] = { applied: 0, inProgress: 0, selected: 0, rejected: 0 };
    }
    
    countsMap[jId].applied += item.count;
    
    if (st === 'in_progress') {
      countsMap[jId].inProgress += item.count;
    } else if (st === 'selected') {
      countsMap[jId].selected += item.count;
    } else if (st === 'rejected') {
      countsMap[jId].rejected += item.count;
    }
  }

  const buffer = await generateJobExportWorkbook(jobs, countsMap, { schools, graduationYears });

  await createAuditLog({
    action: 'job:export',
    req,
    performedBy: req.user._id,
    metadata: {
      details: `Exported ${jobs.length} jobs to Excel.`,
    }
  });

  const date = new Date().toISOString().split('T')[0];
  const filename = `Jobs_Export_${date}.xlsx`;

  return { buffer, filename };
};

module.exports = {
  getAllJobs,
  getClosedJobs,
  getRecommendedJobs,
  getJobById,
  getJobDetailsContext,
  createJob,
  updateJob,
  deleteJob,
  bulkDeleteJobs,
  exportJobs,
};
