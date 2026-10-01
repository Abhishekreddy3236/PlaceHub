const mongoose = require('mongoose');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { getApplicationProfileStatus } = require('../utils/profileCompleteness');
const { serializeProfileLink, serializeProfileUser } = require('../utils/serializers');
const {
  sanitizeEmail,
  sanitizeMobileNumber,
  sanitizeStringArray,
  sanitizeText,
  sanitizeUrl,
} = require('../utils/sanitize');
const Resume = require('../models/Resume');
const r2Service = require('./r2Service');


const MAX_PROFILE_LINKS = 10;

const getActiveResumeDocs = (userId) =>
  Resume.find({
    userId,
    status: 'active',
    size: { $gt: 0 },
  })
    .sort({ createdAt: -1 })
    .select('key size createdAt')
    .lean();

const sanitizeProfileUpdate = (field, value) => {
  switch (field) {
    case 'name':
      return sanitizeText(value, { maxLength: 100 });
    case 'branch':
      return sanitizeText(value, { maxLength: 120 });
    case 'skills':
      return sanitizeStringArray(value, { maxItems: 50, maxLength: 80 });
    case 'personalEmail':
      return sanitizeEmail(value);
    case 'mobileNumber':
      return sanitizeMobileNumber(value);
    case 'linkedin':
    case 'github':
    case 'portfolio':
      return value ? sanitizeUrl(value) : '';
    default:
      return value;
  }
};

const sanitizeProfileLinkPayload = (payload) => ({
  heading: sanitizeText(payload.heading, { maxLength: 80 }),
  url: sanitizeUrl(payload.url),
});

const getProfile = async (req) => {
  const user = await User.findById(req.user._id).populate('companyId', 'name normalizedName slug');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role === 'student' && (!user.school || user.school.trim() === '')) {
    user.school = 'B. Tech';
    await user.save();
  }

  const resumes = user.role === 'student' ? await getActiveResumeDocs(user._id) : [];

  return {
    data: await serializeProfileUser(user, {
      includeCompany: true,
      resumes,
    }),
  };
};

const updateProfile = async (req) => {
  const allowedFields = [
    'name',
    'age',
    'branch',
    'skills',
    'cgpa',
    'tenthPercentage',
    'twelfthPercentage',
    'personalEmail',
    'mobileNumber',
    'gender',
    'linkedin',
    'github',
    'portfolio',
  ];

  if (req.user.role === 'student' && req.body.graduationYear !== undefined) {
    throw new AppError('Graduation year cannot be updated', 403);
  }

  const updates = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = sanitizeProfileUpdate(field, req.body[field]);
    }
  });

  if (Object.keys(updates).length === 0) {
    throw new AppError("No valid fields provided for update", 400);
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  }).populate('companyId', 'name normalizedName slug');

  if (!user) {
    throw new AppError('User not found', 404);
  }



  const resumes = user.role === 'student' ? await getActiveResumeDocs(user._id) : [];

  return {
    message: 'Profile updated successfully',
    data: await serializeProfileUser(user, {
      includeCompany: true,
      resumes,
    }),
  };
};

const getApplicationReadiness = async (req) => {
  const user = await User.findOne({ _id: req.user._id, role: 'student' })
    .select('name age branch cgpa tenthPercentage twelfthPercentage personalEmail mobileNumber gender')
    .lean();

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return {
    message: 'Profile readiness checked successfully',
    data: getApplicationProfileStatus(user),
  };
};

const addProfileLink = async (req) => {
  const user = await User.findOne({ _id: req.user._id, role: 'student' });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if ((user.links || []).length >= MAX_PROFILE_LINKS) {
    throw new AppError('You can add a maximum of 10 profile links', 400);
  }

  const link = sanitizeProfileLinkPayload(req.body);
  user.links.push(link);
  await user.save();


  const createdLink = user.links[user.links.length - 1];

  return {
    statusCode: 201,
    message: 'Profile link added successfully',
    data: {
      link: serializeProfileLink(createdLink),
      links: user.links.map(serializeProfileLink),
    },
  };
};

const updateProfileLink = async (req) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new AppError('Invalid ID', 400);
  }

  const sanitizedLink = sanitizeProfileLinkPayload(req.body);
  const user = await User.findOneAndUpdate(
    { _id: req.user._id, role: 'student', 'links._id': req.params.id },
    {
      $set: {
        'links.$.heading': sanitizedLink.heading,
        'links.$.url': sanitizedLink.url,
      },
    },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new AppError('Resource not found or modified concurrently', 404);
  }

  const link = user.links.id(req.params.id);


  return {
    message: 'Profile link updated successfully',
    data: {
      link: serializeProfileLink(link),
      links: user.links.map(serializeProfileLink),
    },
  };
};

const deleteProfileLink = async (req) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new AppError('Invalid ID', 400);
  }

  const user = await User.findOneAndUpdate(
    { _id: req.user._id, role: 'student' },
    { $pull: { links: { _id: req.params.id } } },
    { new: true }
  );

  if (!user) {
    throw new AppError('Resource not found or modified concurrently', 404);
  }


  return {
    message: 'Profile link deleted successfully',
    data: {
      links: user.links.map(serializeProfileLink),
    },
  };
};

const deleteResume = async (req) => {
  const resume = await Resume.findOne({ userId: req.user._id, status: 'active' });

  if (resume) {
    try {
      await r2Service.deleteObject(resume.key);
    } catch (err) {
      console.error('R2 deletion failed:', err);
      throw new AppError('Storage deletion failed', 500);
    }
    await Resume.deleteOne({ _id: resume._id });
  }

  return { message: 'Resume deleted successfully' };
};

module.exports = {
  getProfile,
  updateProfile,
  getApplicationReadiness,
  addProfileLink,
  updateProfileLink,
  deleteProfileLink,
  deleteResume,
};
