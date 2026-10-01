const r2Service = require('../services/r2Service');
const Resume = require('../models/Resume');
const AppError = require('./AppError');

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const serializeResume = async (resume) => {
  if (!resume) {
    return null;
  }

  const value = resume.toObject ? resume.toObject() : resume;
  const size = Number(value.size || 0);

  if (!value.key || size <= 0) {
    return null;
  }

  return {
    _id: value._id,
    resumeId: value._id,
    status: value.status,
    size,
    createdAt: value.createdAt,
  };
};

const serializeProfileResumes = async (resumes = []) => {
  const serialized = await Promise.all(resumes.map(serializeResume));
  return serialized.filter(Boolean);
};

const serializeCompany = (company) => {
  if (!company) {
    return null;
  }

  const value = company.toObject ? company.toObject() : company;

  return {
    _id: value._id,
    name: value.name,
    normalizedName: value.normalizedName,
    slug: value.slug,
    website: value.website || '',
    description: value.description || '',
    isActive: value.isActive,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const serializeProfileLink = (link) => {
  if (!link) {
    return null;
  }

  const value = link.toObject ? link.toObject() : link;

  return {
    _id: value._id,
    heading: value.heading || '',
    url: value.url || '',
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const serializeUser = (user, options = {}) => {
  if (!user) {
    return null;
  }

  const value = user.toObject ? user.toObject() : user;
  const hasResumeOverride = hasOwn(options, 'resumeUrl') || hasOwn(options, 'resumeDownloadUrl');
  const resumeUrl = hasResumeOverride
    ? options.resumeUrl || options.resumeDownloadUrl || ''
    : '';
  const permissions = value.permissions || {};

  return {
    _id: value._id,
    name: value.name,
    email: value.email || '',
    username: value.username || '',
    role: value.role,
    companyId: value.companyId?._id || value.companyId || null,
    jobId: value.jobId?._id || value.jobId || null,
    company: options.includeCompany ? serializeCompany(value.companyId) : undefined,
    isVerified: value.isVerified,
    isActive: value.isActive,
    mustChangePassword: value.mustChangePassword,
    permissions:
      value.role === 'staff'
        ? {
          users: permissions.users || 'none',
          jobs: permissions.jobs || 'none',
          applications: permissions.applications || 'none',
          accessControl: permissions.accessControl || 'none',
          settings: permissions.settings || 'none',
        }
        : undefined,
    age: value.age,
    school: value.school || null,
    rollNumber: value.rollNumber || '',
    admissionId: value.admissionId || '',
    graduationYear: value.graduationYear || null,
    branch: value.branch,
    skills: value.skills || [],
    cgpa: value.cgpa,
    tenthPercentage: value.tenthPercentage,
    twelfthPercentage: value.twelfthPercentage,
    personalEmail: value.personalEmail || '',
    mobileNumber: value.mobileNumber || '',
    gender: value.gender || '',
    links: Array.isArray(value.links)
      ? value.links.map(serializeProfileLink).filter(Boolean)
      : [],
    linkedin: value.linkedin || '',
    github: value.github || '',
    portfolio: value.portfolio || '',
    resume: resumeUrl,
    resumeUrl: resumeUrl,
    resumes: Array.isArray(options.resumes) ? options.resumes : undefined,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const serializeProfileUser = async (user, options = {}) => {
  const resumes = await serializeProfileResumes(options.resumes || []);
  const currentResume =
    resumes.find((resume) => resume.status === 'active') || resumes[0] || null;
  const resumeUrl = currentResume?.resumeUrl || '';

  return serializeUser(user, {
    ...options,
    resumeUrl,
    resumeDownloadUrl: resumeUrl,
    resumes,
  });
};

const serializeJob = (job) => {
  if (!job) {
    return null;
  }

  const value = job.toObject ? job.toObject() : job;
  const rounds = Array.isArray(value.rounds) && value.rounds.length
    ? value.rounds
    : [{ name: 'Round 1', description: '', order: 1 }];

  return {
    _id: value._id,
    title: value.title,
    company: value.companyId?.name || value.company,
    companyId: value.companyId?._id || value.companyId || null,
    description: value.description,
    location: value.location,
    jobType: value.jobType,
    salary: value.salary || '',
    skills: value.skills || [],
    deadline: value.deadline,
    requirements: value.requirements || [],
    eligibleSchools: value.eligibleSchools || [],
    graduationYears: value.graduationYears || [],
    rounds,
    logo: value.logo || '',
    logoPublicId: value.logoPublicId || '',
    postedBy: value.postedBy,
    isActive: value.isActive,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    matchScore: value.matchScore,
    hasHR: Boolean(value.hrId),
  };
};

const serializeApplication = async (application, options = {}) => {
  if (!application) {
    return null;
  }

  const value = application.toObject ? application.toObject() : application;
  let resumeDownloadUrl = options.resumeDownloadUrl || '';
  const rawResumeSnapshot = value.resumeSnapshot || null;

  if (rawResumeSnapshot?.key) {
    resumeDownloadUrl = '';
  } else if (value.snapshotKey) {
    resumeDownloadUrl = '';
  } else if (!value.isSnapshotHidden) {
    resumeDownloadUrl = '';
  }

  const serializedResumeSnapshot = resumeDownloadUrl
    ? {
      size: Number(rawResumeSnapshot?.size || 0),
      createdAt: rawResumeSnapshot?.createdAt || value.appliedAt || value.createdAt || new Date(),
      resumeUrl: resumeDownloadUrl,
      publicUrl: resumeDownloadUrl,
    }
    : null;

  const profileSnapshot = value.profileSnapshot || {};
  const snapshotStudent = {
    _id: value.student?._id || value.student || value.userId || null,
    name: profileSnapshot.name || '',
    email: profileSnapshot.email || '',
    age: profileSnapshot.age,
    branch: profileSnapshot.branch || '',
    cgpa: profileSnapshot.cgpa,
    tenthPercentage: profileSnapshot.tenthPercentage,
    twelfthPercentage: profileSnapshot.twelfthPercentage,
    personalEmail: profileSnapshot.personalEmail || '',
    mobileNumber: profileSnapshot.mobileNumber || '',
    gender: profileSnapshot.gender || '',
    links: Array.isArray(profileSnapshot.links)
      ? profileSnapshot.links.map(serializeProfileLink).filter(Boolean)
      : [],
    linkedin: profileSnapshot.linkedin || '',
    github: profileSnapshot.github || '',
    portfolio: profileSnapshot.portfolio || '',
    skills: Array.isArray(profileSnapshot.skills) ? profileSnapshot.skills : [],
    school: profileSnapshot.school || '',
    rollNumber: profileSnapshot.rollNumber || '',
    admissionId: profileSnapshot.admissionId || '',
    graduationYear: profileSnapshot.graduationYear || null,
    resumeUrl: resumeDownloadUrl,
    resumeFileName: 'Resume at time of application.pdf',
  };

  const serializedJob = value.jobId && value.jobId.title
    ? serializeJob(value.jobId)
    : value.jobId
      ? {
        _id: value.jobId._id || value.jobId,
        title: value.jobTitle || undefined,
        company: value.companyName || undefined
      }
      : null;

  return {
    _id: value._id,
    job: serializedJob,
    student: value.profileSnapshot ? snapshotStudent : null,
    userId: value.userId || value.student?._id || value.student || null,
    profileSnapshot: value.profileSnapshot || null,
    companyId: value.companyId?._id || value.companyId || null,
    status: value.status,
    currentRound: value.currentRound || 1,
    rejectedAtRound: value.rejectedAtRound || null,
    rejectionInfo: value.rejectionInfo || null,
    resumeSnapshot: serializedResumeSnapshot,
    resumeUrl: resumeDownloadUrl,
    resumeFileName: 'Resume at time of application.pdf',
    appliedAt: value.appliedAt || value.createdAt,
    createdAt: value.createdAt || value.appliedAt,
    updatedAt: value.updatedAt,
    resumeDownloadUrl,
  };
};

module.exports = {
  serializeApplication,
  serializeCompany,
  serializeJob,
  serializeProfileUser,
  serializeProfileLink,
  serializeResume,
  serializeUser,
};
