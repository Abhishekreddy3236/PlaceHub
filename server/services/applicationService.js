const mongoose = require('mongoose');
const User = require('../models/User');
const crypto = require('crypto');

const logger = require('../config/logger');
const Application = require('../models/Application');
const Job = require('../models/Job');
const AppError = require('../utils/AppError');
const { generateExportWorkbook } = require('../utils/excelExporter');
const { createAuditLog } = require('../utils/audit');
const { acquireSnapshotForResume, releaseSnapshotReference } = require('./resumeFileService');
const r2Service = require('./r2Service');
const Resume = require('../models/Resume');
const shareTokenService = require('./shareTokenService');
const notificationQueue = require('./notification/queueService');
const {
  createSearchRegex,
  hasPaginationRequest,
  parsePagination,
  DEFAULT_LIMITS,
  FALLBACK_LIMIT,
} = require('../utils/query');
const { serializeApplication } = require('../utils/serializers');
const { getApplicationProfileStatus } = require('../utils/profileCompleteness');

const { invalidateDashboardCache } = require('./dashboardService');

const { Types } = mongoose;

const DEFAULT_ROUNDS = [{ name: 'Round 1', description: '', order: 1 }];

const resolveJobRounds = (job) => {
  const rounds = job?.rounds;
  return Array.isArray(rounds) && rounds.length ? rounds : DEFAULT_ROUNDS;
};

const resolveRoundName = (rounds, roundNumber) => {
  const round = rounds.find((item) => item.order === roundNumber) || rounds[roundNumber - 1];
  return round?.name || `Round ${roundNumber}`;
};

const buildSafeName = (value) =>
  String(value || 'student')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');


const resolvePagination = (req, fallbackLimit = 12) => {
  if (!hasPaginationRequest(req)) {
    return {
      page: 1,
      limit: 500,
      skip: 0,
    };
  }

  return parsePagination(req.query, fallbackLimit);
};

const getRequestJobId = (req) =>
  req.user?.jobId?._id?.toString?.() || req.user?.jobId?.toString?.() || null;

const getRequestCompanyId = (req) =>
  req.user?.companyId?._id?.toString?.() || req.user?.companyId?.toString?.() || null;

const enforceHrJobAccess = (user, jobId) => {
  if (user && user.role === "hr") {
    const hrJobId = String(user.jobId?._id || user.jobId);
    const targetJobId = String(jobId?._id || jobId);
    if (hrJobId !== targetJobId) {
      throw new AppError("Unauthorized", 403);
    }
  }
};

const toObjectId = (value, fieldName = 'identifier') => {
  if (!Types.ObjectId.isValid(String(value || ''))) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }

  return new Types.ObjectId(value);
};

const buildJobMatch = (jobId) => {
  const objectId = toObjectId(jobId, 'job identifier');
  return { jobId: objectId };
};

const normalizeSnapshotLinks = (student) => {
  const structuredLinks = Array.isArray(student.links) ? student.links : [];

  if (structuredLinks.length) {
    return structuredLinks
      .filter((link) => link?.url)
      .map((link) => ({
        heading: String(link.heading || '').trim(),
        url: String(link.url || '').trim(),
      }));
  }

  return [
    student.linkedin ? { heading: 'LinkedIn', url: student.linkedin } : null,
    student.github ? { heading: 'GitHub', url: student.github } : null,
    student.portfolio ? { heading: 'Portfolio', url: student.portfolio } : null,
  ].filter(Boolean);
};

const buildProfileSnapshot = (student) => ({
  name: student.name,
  email: student.email || '',
  age: student.age,
  branch: student.branch || '',
  cgpa: student.cgpa,
  tenthPercentage: student.tenthPercentage,
  twelfthPercentage: student.twelfthPercentage,
  personalEmail: student.personalEmail,
  mobileNumber: student.mobileNumber,
  gender: student.gender,
  links: normalizeSnapshotLinks(student),
  linkedin: student.linkedin || '',
  github: student.github || '',
  portfolio: student.portfolio || '',
  skills: Array.isArray(student.skills) ? [...student.skills] : [],
  school: student.school || '',
  rollNumber: student.rollNumber || '',
  admissionId: student.admissionId || '',
  graduationYear: student.graduationYear || null,
});



const normalizeStatus = (s) => {
  if (!s) return '';
  const lower = String(s).toLowerCase();
  if (['pending', 'shortlisted', 'in_progress', 'in-progress'].includes(lower)) return 'in_progress';
  if (lower === 'rejected') return 'rejected';
  if (lower === 'selected') return 'selected';
  return lower;
};

const formatStatusCounts = (statusCounts = []) => {
  const counts = { all: 0, in_progress: 0, selected: 0, rejected: 0 };
  statusCounts.forEach(({ _id, count }) => {
    const num = Number(count) || 0;
    counts.all += num;
    const ns = normalizeStatus(_id);
    if (ns === 'in_progress') counts.in_progress += num;
    else if (ns === 'selected') counts.selected += num;
    else if (ns === 'rejected') counts.rejected += num;
  });
  return counts;
};

const buildApplicantPipeline = ({
  companyId,
  jobId,
  status,
  schools,
  graduationYears,
  search,
  branch,
  minCgpa,
  maxCgpa,
  skip,
  limit,
  isAbsentOnly = false,
}) => {
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    for (const s of statuses) {
      if (!['in_progress', 'selected', 'rejected'].includes(s)) {
        throw new AppError('Invalid status value', 400);
      }
    }
  }

  const match = {
    isDeleted: false,
    ...(companyId ? { companyId: toObjectId(companyId, 'company identifier') } : {}),
  };

  if (jobId) {
    Object.assign(match, buildJobMatch(jobId));
  }

  if (schools && schools.length > 0) {
    match['profileSnapshot.school'] = { $in: schools };
  }

  if (graduationYears && graduationYears.length > 0) {
    match['profileSnapshot.graduationYear'] = { $in: graduationYears };
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'jobs',
        localField: 'jobId',
        foreignField: '_id',
        as: 'jobId',
      },
    },
    {
      $unwind: {
        path: '$jobId',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $lookup: {
        from: 'companies',
        localField: 'jobId.companyId',
        foreignField: '_id',
        as: 'companyDocs'
      }
    },
    {
      $addFields: {
        'jobId.companyId': { $arrayElemAt: ['$companyDocs', 0] }
      }
    },
    {
      $project: {
        companyDocs: 0,
        job: 0
      }
    },
  ];

  if (branch) {
    pipeline.push({
      $match: {
        'profileSnapshot.branch': createSearchRegex(branch),
      },
    });
  }

  if (minCgpa || maxCgpa) {
    const cgpaMatch = {};

    if (minCgpa) {
      cgpaMatch.$gte = Number(minCgpa);
    }

    if (maxCgpa) {
      cgpaMatch.$lte = Number(maxCgpa);
    }

    pipeline.push({
      $match: {
        'profileSnapshot.cgpa': cgpaMatch,
      },
    });
  }

  const uiMatch = {};
  if (isAbsentOnly) {
    uiMatch.status = 'rejected';
    uiMatch['rejectionInfo.isAbsent'] = true;
  } else {
    if (Array.isArray(status)) {
      if (status.length > 0) {
        uiMatch.status = { $in: status };
      }
    } else if (status) {
      uiMatch.status = status;
    }
  }

  const searchRegex = createSearchRegex(search);
  if (searchRegex) {
    uiMatch.$or = [
      { 'profileSnapshot.name': searchRegex },
      { 'profileSnapshot.email': searchRegex },
      { 'profileSnapshot.personalEmail': searchRegex },
      { 'profileSnapshot.mobileNumber': searchRegex },
      { 'profileSnapshot.rollNumber': searchRegex },
      { 'profileSnapshot.admissionId': searchRegex },
      { 'jobId.title': searchRegex },
      { 'jobId.companyId.name': searchRegex },
    ];
  }

  const facetItems = [];
  if (Object.keys(uiMatch).length > 0) facetItems.push({ $match: uiMatch });
  facetItems.push({ $sort: { createdAt: -1, _id: -1 } });
  if (skip !== undefined && skip !== null) facetItems.push({ $skip: skip });
  if (limit !== undefined && limit !== null) facetItems.push({ $limit: limit });

  const totalCountPipeline = [];
  if (Object.keys(uiMatch).length > 0) totalCountPipeline.push({ $match: uiMatch });
  totalCountPipeline.push({ $count: 'count' });

  pipeline.push({
    $facet: {
      items: facetItems,
      totalCount: totalCountPipeline,
      statusCounts: [
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ],
    },
  });

  return pipeline;
};

const mapApplicantResult = async (item) => {
  return await serializeApplication(item);
};



const applyToJob = async (req) => {
  if (!req.user || !req.user._id) {
    throw new AppError('Unauthorized', 401);
  }

  const jobId = req.params.jobId || req.body.jobId;

  if (!Types.ObjectId.isValid(String(jobId || ''))) {
    throw new AppError('Invalid job identifier', 400);
  }

  const job = await Job.findById(jobId).select('applicationDeadline deadline eligibleSchools graduationYears companyId').lean();

  if (!job) {
    throw new AppError('Job not found', 404);
  }

  const student = await User.findOne({
    _id: req.user._id,
    role: 'student',
    isDeleted: false
  }).lean();

  if (!student) {
    throw new AppError('Student not found', 404);
  }

  const deadlineDate = job.applicationDeadline
    ? new Date(job.applicationDeadline)
    : job.deadline
      ? new Date(job.deadline)
      : null;

  if (deadlineDate && new Date() > deadlineDate) {
    throw new AppError('Application deadline has passed', 400);
  }

  const profileStatus = getApplicationProfileStatus(student);
  if (!profileStatus.complete) {
    throw new AppError('Complete your profile before applying', 400, {
      missingFields: profileStatus.missingFields,
      missingFieldLabels: profileStatus.missingFieldLabels,
      errors: [],
    });
  }



  const allowedSchools = job.eligibleSchools || [];

  if (allowedSchools && allowedSchools.length > 0 && !allowedSchools.includes(student.school)) {
    throw new AppError('You are not eligible for this job', 403);
  }

  const allowedGradYears = job.graduationYears || [];
  if (allowedGradYears.length > 0 && !allowedGradYears.includes(student.graduationYear)) {
    throw new AppError('Not eligible based on graduation year', 403);
  }

  const existingApplication = await Application.findOne({
    jobId,
    $or: [{ student: req.user._id }, { userId: req.user._id }],
  })
    .setOptions({ withDeleted: true })
    .lean();

  if (existingApplication) {
    throw new AppError('You have already applied to this job', 400);
  }

  const activeResume = await Resume.findOne({ userId: req.user._id, status: 'active' }).lean();
  if (!activeResume) {
    throw new AppError('Upload a resume before applying', 400);
  }

  const snapshot = await acquireSnapshotForResume(activeResume, req.user._id);

  if (!snapshot || !snapshot.snapshotId) {
    throw new AppError('Snapshot creation failed', 500);
  }

  let application;
  try {
    application = await Application.create({
      userId: req.user._id,
      student: req.user._id,
      job: jobId,
      jobId,
      companyId: job.companyId,
      snapshotId: snapshot.snapshotId,
      resumeSnapshot: {
        key: snapshot.key,
        size: snapshot.size
      },
      profileSnapshot: buildProfileSnapshot(student),
      status: 'in_progress',
      currentRound: 1,
      appliedAt: new Date(),
    });
  } catch (error) {
    try {
      await releaseSnapshotReference(snapshot.snapshotId);
    } catch (rollbackError) {
      logger.error(`Snapshot rollback failed: ${rollbackError?.message || rollbackError}`);
    }

    if (error.code === 11000) {
      throw new AppError('You have already applied to this job', 400);
    }

    throw error;
  }

  try {
    await createAuditLog({
      action: 'APPLY_JOB',
      performedBy: req.user._id,
      targetId: application._id,
      targetType: 'Application',
      metadata: {
        jobId,
        companyId: job.companyId,
        resumePath: application.resumeSnapshot.key,
      },
    });
  } catch (err) {
    console.error("Audit failed:", err);
  }

  try {
    await invalidateDashboardCache(req.user._id);
  } catch (err) {
    console.error("Cache invalidation failed:", err);
  }

  return {
    statusCode: 201,
    message: 'Application submitted successfully',
    data: await serializeApplication(application),
  };
};

const getMyApplications = async (req) => {
  const { status, search = '' } = req.query;
  const { page, limit, skip } = hasPaginationRequest(req)
    ? parsePagination(req.query, DEFAULT_LIMITS.applications)
    : { page: 1, limit: FALLBACK_LIMIT, skip: 0 };

  const applicationFilter = {
    $or: [
      { student: req.user._id },
      { userId: req.user._id },
    ],
  };

  if (req?.user?.role === 'hr') {
    const hrJobId = req.user.jobId?._id || req.user.jobId;

    if (!hrJobId) {
      throw new AppError('HR not assigned to a job', 403);
    }

    applicationFilter.jobId = hrJobId;
  }

  if (status && !['in_progress', 'selected', 'rejected'].includes(status)) {
    throw new AppError('Invalid status value', 400);
  }

  if (status) {
    applicationFilter.status = status;
  }

  const searchRegex = createSearchRegex(search);
  if (searchRegex) {
    const matchingJobs = await Job.find({
      $or: [{ title: searchRegex }, { company: searchRegex }],
    })
      .select('_id')
      .lean();

    if (matchingJobs.length === 0) {
      return {
        data: {
          items: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        },
        message: 'Applications fetched successfully',
      };
    }

    applicationFilter.jobId = { $in: matchingJobs.map((j) => j._id) };
  }

  const [applications, total] = await Promise.all([
    Application.find(applicationFilter)
      .populate({
        path: 'jobId',
        select: '_id title company companyId location jobType deadline rounds logo isActive createdAt updatedAt',
        populate: {
          path: 'companyId',
          select: 'name'
        }
      })
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Application.countDocuments(applicationFilter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: {
      items: await Promise.all(applications.map((application) => serializeApplication(application))),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
    message: 'Applications fetched successfully',
  };
};

const checkApplication = async (req) => {
  const checkFilter = {
    jobId: req.params.jobId,
    $or: [{ student: req.user._id }, { userId: req.user._id }],
  };

  if (req?.user?.role === 'hr') {
    const hrJobId = req.user.jobId?._id || req.user.jobId;

    if (!hrJobId) {
      throw new AppError('HR not assigned to a job', 403);
    }

    checkFilter.jobId = hrJobId;
  }

  const application = await Application.findOne(checkFilter)
    .populate({
      path: 'jobId',
      select: '_id title company companyId location jobType deadline rounds logo isActive createdAt updatedAt',
      populate: {
        path: 'companyId',
        select: 'name'
      }
    })
    .lean();

  return {
    data: {
      applied: Boolean(application),
      application: application ? await serializeApplication(application) : null,
    },
  };
};

const getJobApplicants = async (req) => {
  const { page, limit, skip } = resolvePagination(req, 12);
  enforceHrJobAccess(req.user, req.params.jobId);

  const [result] = await Application.aggregate(
    buildApplicantPipeline({
      jobId: req.params.jobId,
      status: req.query.status,
      search: req.query.search,
      branch: req.query.branch,
      minCgpa: req.query.minCgpa,
      maxCgpa: req.query.maxCgpa,
      skip,
      limit,
      companyId: req?.user?.role === 'hr' ? req.user.companyId : undefined,
    })
  );

  const items = await Promise.all((result?.items || []).map(mapApplicantResult));
  const total = result?.totalCount?.[0]?.count || 0;

  await createAuditLog({
    action: 'VIEW_APPLICATION',
    req,
    performedBy: req.user._id,
    targetId: req.params.jobId,
    metadata: {
      scope: 'job',
      jobId: req.params.jobId,
    },
  });

  const totalPages = Math.ceil(total / limit);
  const counts = formatStatusCounts(result?.statusCounts);

  return {
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      counts,
    },
    message: 'Applicants fetched successfully',
  };
};

const mapExportResult = (app, jobContext) => {
  const profile = app.profileSnapshot || {};

  let currentRoundName = null;
  const currentRound = app.currentRound || 1;
  const roundIndex = currentRound - 1;

  if (jobContext && Array.isArray(jobContext.rounds) && jobContext.rounds[roundIndex]) {
    currentRoundName = jobContext.rounds[roundIndex].title || jobContext.rounds[roundIndex].name || `Round ${currentRound}`;
  }

  return {
    rollNumber: profile.rollNumber ?? null,
    admissionId: profile.admissionId ?? null,
    studentName: profile.name ?? null,
    school: profile.school ?? null,
    graduationYear: profile.graduationYear ?? null,
    branch: profile.branch ?? null,
    cgpa: profile.cgpa ?? null,
    tenthPercentage: profile.tenthPercentage ?? null,
    twelfthPercentage: profile.twelfthPercentage ?? null,
    collegeEmail: profile.email ?? null,
    personalEmail: profile.personalEmail ?? null,
    mobileNumber: profile.mobileNumber ?? null,
    gender: profile.gender ?? null,
    age: profile.age ?? null,
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    status: app.status ?? 'in_progress',
    currentRound,
    currentRoundName,
    appliedDate: app.appliedAt ?? app.createdAt ?? null,
    resumeExists: !!(app.resumeSnapshot && app.resumeSnapshot.key),
    isAbsent: Boolean(app.rejectionInfo?.isAbsent)
  };
};

const exportJobApplicants = async (req) => {
  const jobId = req.params.jobId;

  if (!Types.ObjectId.isValid(String(jobId || ''))) {
    throw new AppError('Invalid job identifier', 400);
  }

  const { status, schools, graduationYears, columns, includeResumeLinks, linkExpiryDays, isAbsentOnly } = req.body;

  enforceHrJobAccess(req.user, jobId);

  const job = await Job.findById(jobId).populate('companyId', 'name').select('title name company companyId eligibleSchools graduationYears rounds').lean();
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  if (schools && schools.length > 0) {
    const invalidSchools = schools.filter(s => !(job.eligibleSchools || []).includes(s));
    if (invalidSchools.length > 0) {
      throw new AppError(`Invalid schools for this job: ${invalidSchools.join(', ')}`, 400);
    }
  }

  if (graduationYears && graduationYears.length > 0) {
    const invalidYears = graduationYears.filter(y => !(job.graduationYears || []).includes(y));
    if (invalidYears.length > 0) {
      throw new AppError(`Invalid graduation years for this job: ${invalidYears.join(', ')}`, 400);
    }
  }

  const [result] = await Application.aggregate(
    buildApplicantPipeline({
      jobId,
      status,
      schools,
      graduationYears,
      skip: undefined,
      limit: undefined,
      companyId: req?.user?.role === 'hr' ? req.user.companyId : undefined,
      isAbsentOnly,
    })
  );

  const items = result?.items || [];

  let tokenMap = {};
  if (includeResumeLinks) {
    const validDays = [10, 20, 30, 60].includes(Number(linkExpiryDays)) ? Number(linkExpiryDays) : 30;
    tokenMap = await shareTokenService.generateTokensBulk(items, validDays, req.user._id);
  }

  const mappedItems = items.map(app => {
    const dto = mapExportResult(app, job);
    if (includeResumeLinks && tokenMap[app._id]) {
      const publicBaseUrl = process.env.PUBLIC_API_URL;
      if (!publicBaseUrl) {
        throw new AppError('PUBLIC_API_URL is not configured', 500);
      }
      dto.resumeLink = `${publicBaseUrl}/api/v1/public/application-share/${tokenMap[app._id]}`;
    }
    return dto;
  });

  const jobMetadata = {
    companyName: job.companyId?.name || job.company || 'N/A',
    jobTitle: job.title || job.name || 'Job'
  };

  const exportColumns = Array.isArray(columns) ? [...columns] : [];
  if (includeResumeLinks && !exportColumns.includes('resumeLink')) {
    exportColumns.push('resumeLink');
  }

  const workbookBuffer = await generateExportWorkbook(mappedItems, exportColumns, jobMetadata);

  await createAuditLog({
    action: 'EXPORT_APPLICATIONS',
    req,
    performedBy: req.user._id,
    targetId: jobId,
    metadata: {
      scope: 'job',
      jobId,
      filters: { status, schools, graduationYears, columns },
      count: mappedItems.length
    },
  });

  // Sanitize filename to prevent CRLF, Path Traversal, and Header Injection
  let jobTitle = String(job.title || job.name || 'Job')
    .replace(/[\r\n]/g, '')
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);

  const now = new Date();

  const dateStr =
    `${String(now.getDate()).padStart(2, '0')}-` +
    `${String(now.getMonth() + 1).padStart(2, '0')}-` +
    `${now.getFullYear()}`;

  const filename = `Applicants_${jobTitle}_${dateStr}.xlsx`;

  return {
    buffer: workbookBuffer,
    filename,
    exportedCount: mappedItems.length
  };
};

const getAllApplicants = async (req) => {
  const { page, limit, skip } = resolvePagination(req, 12);

  const hrJobId =
    req?.user?.role === 'hr'
      ? (req.user.jobId?._id || req.user.jobId)
      : undefined;

  if (req?.user?.role === 'hr' && !hrJobId) {
    throw new AppError('HR not assigned to a job', 403);
  }

  const [result] = await Application.aggregate(
    buildApplicantPipeline({
      jobId: hrJobId,
      status: req.query.status,
      search: req.query.search,
      branch: req.query.branch,
      minCgpa: req.query.minCgpa,
      maxCgpa: req.query.maxCgpa,
      skip,
      limit,
      companyId: req?.user?.role === 'hr' ? req.user.companyId : undefined,
    })
  ).allowDiskUse(true);

  const items = await Promise.all((result?.items || []).map(mapApplicantResult));
  const total = result?.totalCount?.[0]?.count || 0;

  await createAuditLog({
    action: 'VIEW_APPLICATION',
    req,
    performedBy: req.user._id,
    metadata: {
      scope: 'all',
    },
  });

  const totalPages = Math.ceil(total / limit);
  const counts = formatStatusCounts(result?.statusCounts);

  return {
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      counts,
    },
    message: 'Applicants fetched successfully',
  };
};

const getCompanyApplicants = async (req) => {
  const { page, limit, skip } = resolvePagination(req, 12);
  const hrJobId = getRequestJobId(req);

  if (!hrJobId) {
    throw new AppError('HR account is not assigned to a job', 403);
  }

  const [result] = await Application.aggregate(
    buildApplicantPipeline({
      jobId: hrJobId,
      status: req.query.status,
      search: req.query.search,
      branch: req.query.branch,
      minCgpa: req.query.minCgpa,
      maxCgpa: req.query.maxCgpa,
      skip,
      limit,
      companyId: req?.user?.role === 'hr' ? req.user.companyId : undefined,
    })
  );

  const items = await Promise.all((result?.items || []).map(mapApplicantResult));
  const total = result?.totalCount?.[0]?.count || 0;

  await createAuditLog({
    action: 'VIEW_APPLICATION',
    req,
    performedBy: req.user._id,
    metadata: {
      scope: 'job',
      jobId: hrJobId,
      companyId: getRequestCompanyId(req),
    },
  });

  const totalPages = Math.ceil(total / limit);
  const counts = formatStatusCounts(result?.statusCounts);

  return {
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      counts,
    },
    message: 'Company applicants fetched successfully',
  };
};

const updateApplicationStatus = async (req, expectedRound, expectedStatus) => {
  const applicationId = req.params.id || req.body.applicationId;
  const { status, action, isAbsent } = req.body;

  if (!Types.ObjectId.isValid(String(applicationId || ''))) {
    throw new AppError('Invalid application identifier', 400);
  }

  if (expectedRound === undefined || expectedStatus === undefined) {
    throw new AppError('expectedRound and expectedStatus are required', 400);
  }

  let application;
  if (req?.user?.role === 'hr') {
    const hrJobId = req.user.jobId?._id || req.user.jobId;
    application = await Application.findOne({
      _id: applicationId,
      jobId: hrJobId
    })
      .populate('student', 'name email')
      .populate({
        path: 'jobId',
        select: '_id title company companyId location jobType deadline rounds',
        populate: {
          path: 'companyId',
          select: 'name'
        }
      });
  } else {
    application = await Application.findById(applicationId)
      .populate('student', 'name email')
      .populate({
        path: 'jobId',
        select: '_id title company companyId location jobType deadline rounds',
        populate: {
          path: 'companyId',
          select: 'name'
        }
      });
  }

  if (!application || !application.jobId) {
    throw new AppError('Application or job not found', 404);
  }

  if (req.user.role === 'hr') {
    try {
      enforceHrJobAccess(req.user, application.jobId?._id || application.jobId);
    } catch (err) {
      throw new AppError('Unauthorized', 403);
    }
  } else if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    throw new AppError('You are not authorized to update this application', 403);
  }

  const previousStatus = expectedStatus;
  const previousRound = Number(expectedRound) || 1;
  const previousRejectedAtRound = application.rejectedAtRound || null;
  const rounds = resolveJobRounds(application.jobId);
  const currentRound = Math.max(Number(application.currentRound) || 1, 1);

  let statusLabel = '';
  let statusType = '';

  if (!action) {
    throw new AppError('Action is required', 400);
  }

  if (application.status !== 'in_progress') {
    throw new AppError('Application already finalized', 400);
  }

  const totalRounds = rounds.length || 1;

  if (isAbsent && action !== 'reject') {
    throw new AppError('Absent flag can only be used during rejection', 400);
  }

  switch (action) {
    case 'promote': {
      const nextRound = currentRound + 1;

      if (nextRound > totalRounds) {
        application.status = 'selected';
      } else {
        application.status = 'in_progress';
        application.currentRound = nextRound;
      }
      application.rejectedAtRound = null;

      const isSelected = application.status === 'selected';
      statusLabel = isSelected ? 'Selected' : `Shortlisted for Round ${application.currentRound}`;
      statusType = isSelected ? 'selected' : 'in_progress';
      break;
    }

    case 'reject': {
      application.status = 'rejected';
      application.rejectedAtRound = currentRound;

      statusLabel = `Rejected at Round ${currentRound}`;
      statusType = 'rejected';
      break;
    }

    case 'select': {
      if (currentRound !== totalRounds) {
        throw new AppError('Cannot select before final round', 400);
      }

      application.status = 'selected';
      application.rejectedAtRound = null;

      statusLabel = 'Selected';
      statusType = 'selected';
      break;
    }

    default:
      throw new AppError('Invalid action', 400);
  }

  if (
    application.status === previousStatus &&
    Number(application.currentRound) === previousRound &&
    (application.rejectedAtRound || null) === previousRejectedAtRound
  ) {
    throw new AppError('Status already set', 400);
  }

  const updatePayload = {
    $set: {
      status: application.status,
      currentRound: application.currentRound,
      hasUnreadUpdate: true,
    }
  };

  if (action === 'reject') {
    updatePayload.$set['rejectionInfo.isAbsent'] = isAbsent === true || isAbsent === 'true';
  }

  if (application.rejectedAtRound === null) {
    updatePayload.$unset = { rejectedAtRound: '' };
  } else {
    updatePayload.$set = { ...updatePayload.$set, rejectedAtRound: application.rejectedAtRound };
  }

  const updateFilter = {
    _id: application._id,
    status: previousStatus,
    currentRound: previousRound
  };

  if (req?.user?.role === 'hr') {
    const hrJobId = req.user.jobId?._id || req.user.jobId;
    if (hrJobId) {
      updateFilter.jobId = hrJobId;
    }
  }

  const updatedApp = await Application.findOneAndUpdate(
    updateFilter,
    updatePayload,
    { new: true }
  );

  if (!updatedApp) {
    throw new AppError('Applicant was updated by another user. Please refresh.', 409);
  }

  // NON-BLOCKING NOTIFICATION TRIGGER
  try {
    notificationQueue.notifyApplicationUpdate(updatedApp._id).catch(err => {
      logger.error('Notification queue push failed', err);
    });
  } catch (e) {
    logger.error('Notification module error', e);
  }

  return {
    message: 'Application status updated successfully',
    data: await mapApplicantResult(application),
  };
};

const bulkUpdateApplicationStatus = async (req, expectedRound, expectedStatus) => {
  const { applicantIds, action, isAbsent } = req.body;
  const safeExpectedRound = expectedRound !== undefined ? expectedRound : req.body.expectedRound;
  const safeExpectedStatus = expectedStatus !== undefined ? expectedStatus : req.body.expectedStatus;

  const operationId = crypto.randomUUID();

  const filter = {
    _id: { $in: applicantIds },
    isDeleted: false,
  };

  if (req?.user?.role === 'hr') {
    const hrJobId = req.user.jobId?._id || req.user.jobId;
    if (hrJobId) {
      filter.jobId = hrJobId;
    }
  }

  const applications = await Application.find(filter)
    .populate('student', 'name email')
    .populate({
      path: 'jobId',
      select: '_id title company companyId location jobType deadline rounds',
      populate: {
        path: 'companyId',
        select: 'name'
      }
    })
    .lean();

  if (!applications.length) {
    throw new AppError('No valid applications found', 404);
  }

  if (applications.length !== applicantIds.length) {
    throw new AppError(
      `Found ${applications.length} of ${applicantIds.length} applications. Some IDs are invalid or deleted.`,
      400
    );
  }

  const nonInProgress = applications.filter(
    (app) => app.status !== 'in_progress'
  );
  if (nonInProgress.length) {
    throw new AppError('Bulk actions are only allowed on applicants with "In Progress" status', 400);
  }

  const jobIds = new Set(applications.map((app) => app.jobId?._id?.toString()));
  if (jobIds.size !== 1) {
    throw new AppError('All selected applicants must belong to the same job', 400);
  }

  const roundNumbers = new Set(applications.map((app) => Number(app.currentRound) || 1));
  if (roundNumbers.size !== 1) {
    throw new AppError('All selected applicants must be in the same round', 400);
  }

  const job = applications[0].jobId;
  if (!job) {
    throw new AppError('Job not found for the selected applications', 404);
  }

  if (req.user.role === 'hr') {
    try {
      enforceHrJobAccess(req.user, job._id || job);
    } catch (err) {
      throw new AppError('Unauthorized', 403);
    }
  } else if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    throw new AppError('You are not authorized to perform this action', 403);
  }

  const rounds = resolveJobRounds(job);
  const bulkOps = [];
  let lastProcessedRound = null;

  for (const application of applications) {
    const currentRound = Number(application.currentRound) || 1;
    lastProcessedRound = currentRound;
    let newStatus;
    let newCurrentRound;
    let newRejectedAtRound;
    let statusLabel;
    let statusType;

    if (action === 'next_round') {
      const nextRound = currentRound + 1;
      const isSelected = nextRound > rounds.length;

      newStatus = isSelected ? 'selected' : 'in_progress';
      newCurrentRound = isSelected ? currentRound : nextRound;
      newRejectedAtRound = null;
      statusLabel = isSelected ? 'Selected' : `Shortlisted for Round ${nextRound}`;
      statusType = isSelected ? 'selected' : 'in_progress';
    } else {
      newStatus = 'rejected';
      newCurrentRound = currentRound;
      newRejectedAtRound = currentRound;
      statusLabel = `Rejected at Round ${currentRound}`;
      statusType = 'rejected';
    }

    const update = {
      $set: {
        status: newStatus,
        currentRound: newCurrentRound,
        hasUnreadUpdate: true,
      },
    };

    if (action === 'reject') {
      update.$set['rejectionInfo.isAbsent'] = isAbsent === true || isAbsent === 'true';
    }

    if (newRejectedAtRound == null) {
      update.$unset = { rejectedAtRound: '' };
    } else {
      update.$set.rejectedAtRound = newRejectedAtRound;
    }

    const updateOneFilter = {
      _id: application._id,
      status: safeExpectedStatus || application.status,
      currentRound: safeExpectedRound !== undefined ? safeExpectedRound : application.currentRound
    };

    if (req?.user?.role === 'hr') {
      const hrJobId = req.user.jobId?._id || req.user.jobId;

      if (!hrJobId) {
        throw new AppError('HR not assigned to a job', 403);
      }

      updateOneFilter.jobId = hrJobId;
    }

    bulkOps.push({
      updateOne: {
        filter: updateOneFilter,
        update,
      },
    });
  }

  const result = await Application.bulkWrite(bulkOps);

  const updatedCount = result.modifiedCount || 0;
  const skippedCount = bulkOps.length - updatedCount;

  await createAuditLog({
    action: 'BULK_UPDATE_APPLICATION_STATUS',
    req,
    performedBy: req.user._id,
    targetId: job._id,
    targetType: 'Job',
    metadata: {
      jobTitle: job.title,
      bulkAction: action,
      count: updatedCount,
      skipped: skippedCount,
      applicationIds: applicantIds,
      round: lastProcessedRound,
    },
  });

  // NON-BLOCKING NOTIFICATION TRIGGER
  try {
    let updatedAppIds = [];
    if (updatedCount === bulkOps.length) {
      updatedAppIds = bulkOps.map(op => op.updateOne.filter._id);
    } else if (updatedCount > 0) {
      const conditions = bulkOps.map(op => ({
        _id: op.updateOne.filter._id,
        status: op.updateOne.update.$set.status,
        currentRound: op.updateOne.update.$set.currentRound
      }));
      const verifiedApps = await Application.find({ $or: conditions }).select('_id').lean();
      updatedAppIds = verifiedApps.map(app => app._id);
    }
    
    if (updatedAppIds.length > 0) {
      notificationQueue.notifyBulkApplicationUpdate(updatedAppIds, operationId).catch(err => {
        logger.error('Bulk notification queue push failed', err);
      });
    }
  } catch (e) {
    logger.error('Notification module error', e);
  }

  return {
    message: `${updatedCount} application(s) updated successfully${skippedCount > 0 ? `, ${skippedCount} skipped due to conflict` : ''}`,
    data: {
      action,
      count: updatedCount,
      skipped: skippedCount,
      round: lastProcessedRound,
    },
  };
};

const getAdminStats = async () => {
  const [totalUsers, totalJobs, totalApplications] = await Promise.all([
    User.countDocuments({ isDeleted: false }),
    Job.countDocuments({ isDeleted: false }),
    Application.countDocuments({ isDeleted: false })
  ]);

  return {
    totalUsers,
    totalJobs,
    totalApplications
  };
};

const downloadApplicationResume = async (req) => {
  let application;

  if (req?.user?.role === 'hr') {
    const hrJobId = req.user.jobId?._id || req.user.jobId;
    application = await Application.findOne({
      _id: req.params.id,
      jobId: hrJobId
    }).lean();
  } else {
    application = await Application.findById(req.params.id).lean();
  }

  if (!application) {
    throw new AppError('Application not found or unauthorized', 404);
  }

  const key = application.resumeSnapshot?.key;

  if (!key) {
    throw new AppError('Resume not found', 404);
  }

  try {
    enforceHrJobAccess(req.user, application.jobId?._id || application.jobId);
  } catch (err) {
    throw new AppError('Unauthorized', 403);
  }

  const isAdmin = req.user.role === 'admin';
  const isOwner =
    req.user.role === 'student' &&
    String(application.userId || application.student) === req.user._id.toString();
  const hasStaffRead =
    req.user.role === 'staff' &&
    ['read', 'write'].includes(req.user.permissions?.applications);
  const isAuthorizedHr =
    req.user.role === 'hr' &&
    req.user.companyId &&
    String(application.companyId) === String(req.user.companyId);

  if (!isAdmin && !isOwner && !isAuthorizedHr && !hasStaffRead) {
    throw new AppError('Application not found or unauthorized', 404);
  }

  const rawName = String(application.profileSnapshot?.name || 'student');
  let safeName = rawName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');

  if (!safeName) safeName = 'student';

  const rollNum = application.profileSnapshot?.rollNumber 
    ? String(application.profileSnapshot.rollNumber).trim().toUpperCase() 
    : '';
  const prefix = rollNum ? `${rollNum}_` : '';

  const filename = `${prefix}${safeName}_resume.pdf`;
  const resumeUrl = await r2Service.generateDownloadUrl(key, filename, 'inline');

  return {
    resumeUrl,
    filename,
  };
};



const bulkAction = async (req) => {
  return {
    success: true,
    message: "Bulk action endpoint connected"
  };
};

const markApplicationsAsRead = async (userId) => {
  return Application.updateMany(
    { userId, hasUnreadUpdate: true },
    { $set: { hasUnreadUpdate: false } }
  );
};

module.exports = {
  applyToJob,
  getMyApplications,
  checkApplication,
  getJobApplicants,
  getAllApplicants,
  getCompanyApplicants,
  updateApplicationStatus,
  bulkUpdateApplicationStatus,
  getAdminStats,
  downloadApplicationResume,
  markApplicationsAsRead,
  exportJobApplicants,
  bulkAction,
};
