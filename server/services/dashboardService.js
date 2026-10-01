const Application = require('../models/Application');
const Job = require('../models/Job');
const SavedJob = require('../models/SavedJob');
const User = require('../models/User');
const { serializeJob, serializeUser } = require('../utils/serializers');
const { getApplicationProfileStatus } = require('../utils/profileCompleteness');

const fetchUpcomingSavedJobs = async (req) => {
  const userId = req.user._id;
  const savedJobDocs = await SavedJob.find({ student: userId }, 'job').lean();
  if (!savedJobDocs || savedJobDocs.length === 0) return [];

  const jobIds = savedJobDocs.map((doc) => doc.job);
  
  const appliedJobs = await Application.find(
    { userId, jobId: { $in: jobIds } },
    'jobId'
  ).lean();

  const appliedJobIds = new Set(appliedJobs.map((app) => app.jobId.toString()));
  const unappliedJobIds = jobIds.filter((id) => !appliedJobIds.has(id.toString()));

  if (unappliedJobIds.length === 0) return [];

  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const filter = {
    ...buildRecentJobsFilter(req),
    _id: { $in: unappliedJobIds },
    isDeleted: false,
    deadline: { $gte: now, $lte: next24h },
  };

  return Job.find(filter)
    .select('_id title company companyId deadline')
    .sort({ deadline: 1 })
    .limit(3)
    .lean();
};

const invalidateDashboardCache = async () => {
  // intentionally empty after Redis removal
};

const buildRecentJobsFilter = (req) => {
  const filter = {
    isActive: true,
  };

  if (req.user?.role === 'student') {
    const studentSchool = req.user.school || 'B. Tech';
    const studentGradYear = req.user.graduationYear;
    
    // Convert existing $or for schools into $and so we can append safely
    filter.$and = [
      {
        $or: [
          { eligibleSchools: { $exists: false } },
          { eligibleSchools: { $size: 0 } },
          { eligibleSchools: studentSchool },
        ]
      }
    ];

    if (studentGradYear) {
      filter.$and.push({
        $or: [
          { graduationYears: { $exists: false } },
          { graduationYears: { $size: 0 } },
          { graduationYears: studentGradYear }
        ]
      });
    } else {
      filter.$and.push({
        $or: [
          { graduationYears: { $exists: false } },
          { graduationYears: { $size: 0 } }
        ]
      });
    }
  }

  return filter;
};

const getDashboardData = async (req) => {
  const [
    applicationCount,
    savedJobsCount,
    recentJobs,
    fullUser,
    upcomingSavedJobs,
    unreadUpdatesCount,
    recentStatusUpdates,
  ] = await Promise.all([
    Application.countDocuments({
      $or: [{ student: req.user._id }, { userId: req.user._id }],
    }),
    SavedJob.countDocuments({ student: req.user._id }),
    Job.find(buildRecentJobsFilter(req))
      .select(
        '_id title company companyId description location jobType salary skills deadline requirements rounds eligibleSchools graduationYears logo logoPublicId isActive createdAt updatedAt'
      )
      .sort({ createdAt: -1, _id: -1 })
      .limit(6)
      .lean(),
    User.findById(req.user._id).lean(),
    fetchUpcomingSavedJobs(req),
    req.user?.role === 'student'
      ? Application.countDocuments({ userId: req.user._id, hasUnreadUpdate: true })
      : Promise.resolve(0),
    req.user?.role === 'student'
      ? Application.find({ userId: req.user._id, hasUnreadUpdate: true })
          .populate({
            path: 'jobId',
            select: 'title companyId',
            populate: { path: 'companyId', select: 'name' },
          })
          .select('_id status updatedAt currentRound')
          .sort({ updatedAt: -1 })
          .limit(10)
          .lean()
      : Promise.resolve([]),
  ]);

  const profileStatus = req.user?.role === 'student' ? getApplicationProfileStatus(fullUser || req.user) : null;
  const unreadCount = unreadUpdatesCount || 0;

  const payload = {
    user: serializeUser(fullUser || req.user),
    stats: {
      applications: applicationCount,
      saved: savedJobsCount,
    },
    recentJobs: recentJobs.map(serializeJob),
    profileStatus,
    reminders: upcomingSavedJobs || [],
    unreadCount,
    recentStatusUpdates,
  };

  return {
    data: payload,
  };
};

module.exports = {
  getDashboardData,
  invalidateDashboardCache,
};
