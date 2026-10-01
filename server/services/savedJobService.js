const SavedJob = require('../models/SavedJob');
const AppError = require('../utils/AppError');
const { invalidateDashboardCache } = require('./dashboardService');
const { parsePagination, hasPaginationRequest } = require('../utils/query');

const resolvePagination = (req, fallbackLimit = 12) => {
  if (!hasPaginationRequest(req)) {
    return {
      page: 1,
      limit: 5000,
      skip: 0,
    };
  }
  return parsePagination(req.query, fallbackLimit);
};

const saveJob = async (req) => {
  const { jobId } = req.params;

  let savedJob = await SavedJob.findOne({ job: jobId, student: req.user._id }).setOptions({
    withDeleted: true,
  });

  if (savedJob && !savedJob.isDeleted) {
    throw new AppError('Job already saved', 400);
  }

  if (savedJob && savedJob.isDeleted) {
    savedJob.isDeleted = false;
    await savedJob.save({ validateBeforeSave: false });
  } else {
    savedJob = await SavedJob.create({
      job: jobId,
      student: req.user._id,
    });
  }

  await invalidateDashboardCache(req.user._id);

  return {
    statusCode: 201,
    message: 'Job saved successfully',
    data: savedJob,
  };
};

const unsaveJob = async (req) => {
  const savedJob = await SavedJob.findOne({ job: req.params.jobId, student: req.user._id });

  if (!savedJob) {
    throw new AppError('Saved job not found', 404);
  }

  savedJob.isDeleted = true;
  await savedJob.save({ validateBeforeSave: false });

  await invalidateDashboardCache(req.user._id);

  return {
    message: 'Job removed from saved successfully',
  };
};

const getSavedJobs = async (req) => {
  const studentSchool = req.user.school || 'B. Tech';
  const studentGradYear = req.user.graduationYear;

  const jobMatch = {
    'job.deadline': { $gte: new Date() },
    $or: [
      { 'job.eligibleSchools': { $exists: false } },
      { 'job.eligibleSchools': { $size: 0 } },
      { 'job.eligibleSchools': studentSchool }
    ]
  };

  if (studentGradYear) {
    jobMatch.$and = [
      {
        $or: [
          { 'job.graduationYears': { $exists: false } },
          { 'job.graduationYears': { $size: 0 } },
          { 'job.graduationYears': studentGradYear }
        ]
      }
    ];
  }

  const { page, limit, skip } = resolvePagination(req, 10);

  const [savedJobs, totalResult] = await Promise.all([
    SavedJob.aggregate([
      { $match: { student: req.user._id } },
      {
        $lookup: {
          from: 'jobs',
          localField: 'job',
          foreignField: '_id',
          as: 'job'
        }
      },
      { $unwind: '$job' },
      { $match: jobMatch },
      { $sort: { createdAt: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]),
    SavedJob.aggregate([
      { $match: { student: req.user._id } },
      {
        $lookup: {
          from: 'jobs',
          localField: 'job',
          foreignField: '_id',
          as: 'job'
        }
      },
      { $unwind: '$job' },
      { $match: jobMatch },
      { $count: 'total' }
    ])
  ]);

  const total = totalResult.length > 0 ? totalResult[0].total : 0;

  return {
    data: {
      items: savedJobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    },
    message: 'Saved jobs fetched successfully'
  };
};

const checkSaved = async (req) => {
  const savedJob = await SavedJob.findOne({ job: req.params.jobId, student: req.user._id }).lean();

  return {
    data: {
      saved: Boolean(savedJob),
    },
  };
};

module.exports = {
  saveJob,
  unsaveJob,
  getSavedJobs,
  checkSaved,
};
