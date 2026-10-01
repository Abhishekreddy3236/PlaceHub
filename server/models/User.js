const mongoose = require('mongoose');
const softDeletePlugin = require('./plugins/softDelete');
const { SCHOOLS } = require('../utils/constants');
const { EMAIL_REGEX, GENDERS, MOBILE_REGEX } = require('../utils/profileCompleteness');

const studentRequiredField = function () {
  const hasIdentityFields = Boolean(this.rollNumber || this.admissionId || this.graduationYear);
  return this.role === 'student' && (this.isNew || hasIdentityFields);
};

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const profileLinkSchema = new mongoose.Schema(
  {
    heading: { type: String, required: true, trim: true, maxlength: 80 },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
      validate: {
        validator: isHttpUrl,
        message: 'Link URL must be a valid http or https URL',
      },
    },
  },
  { timestamps: true }
);


const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['student', 'admin', 'hr', 'staff'], default: 'student' },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      sparse: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      sparse: true,
    },
    isVerified: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deliveryEmail: { type: String, trim: true, lowercase: true },
    tokenVersion: { type: Number, default: 0 },
    permissions: {
      users: { type: String, enum: ['none', 'read', 'write'], default: 'none' },
      jobs: { type: String, enum: ['none', 'read', 'write'], default: 'none' },
      applications: { type: String, enum: ['none', 'read', 'write'], default: 'none' },
      accessControl: { type: String, enum: ['none', 'read', 'write'], default: 'none' },
      settings: { type: String, enum: ['none'], default: 'none' },
    },
    lastLoginAt: { type: Date, default: null },
    otp: { type: String },
    otpExpiry: { type: Date },
    otpHash: { type: String },
    otpExpiresAt: { type: Date },
    resetOTPHash: { type: String },
    resetOTPExpiresAt: { type: Date },
    resetOtpAttempts: { type: Number, default: 0 },
    age: { type: Number },
    school: { type: String, enum: SCHOOLS },
    rollNumber: { type: String, required: studentRequiredField, trim: true },
    admissionId: {
      type: String,
      required: studentRequiredField,
      unique: true,
      sparse: true,
      trim: true,
    },
    graduationYear: {
      type: Number,
      required: studentRequiredField,
      validate: {
        validator: function (value) {
          if (value == null) return true;
          
          const baseStart = 2026;
          const currentYear = new Date().getFullYear();
          const start = Math.max(baseStart, currentYear);
          const end = start + 10;

          const allowed = Array.from(
            { length: end - start + 1 },
            (_, i) => start + i
          );

          return allowed.includes(value);
        },
        message: 'Invalid graduation year',
      },
    },
    branch: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    cgpa: { type: Number },
    tenthPercentage: { type: Number, min: 0, max: 100 },
    twelfthPercentage: { type: Number, min: 0, max: 100 },
    personalEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, 'Personal email must be valid'],
    },
    mobileNumber: {
      type: String,
      trim: true,
      match: [MOBILE_REGEX, 'Mobile number must be 10 digits'],
    },
    gender: { type: String, enum: GENDERS },
    links: {
      type: [profileLinkSchema],
      default: [],
      validate: {
        validator: (links) => !Array.isArray(links) || links.length <= 10,
        message: 'You can add a maximum of 10 profile links',
      },
    },
    linkedin: { type: String, trim: true },
    github: { type: String, trim: true },
    portfolio: { type: String, trim: true },
  },
  { timestamps: true }
);

// Username is immutable after creation — silently revert any modification attempt
userSchema.pre('save', function (next) {
  if (!this.isNew && this.isModified('username')) {
    this.unmarkModified('username');
  }
  next();
});

userSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 1200,
    partialFilterExpression: { isVerified: false, role: 'student' },
  }
);

userSchema.index({ email: 1, isDeleted: 1 });
userSchema.index({ username: 1, isDeleted: 1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ role: 1, companyId: 1, isDeleted: 1 });
userSchema.index({ role: 1, jobId: 1, isDeleted: 1 });
userSchema.index(
  { role: 1, jobId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: 'hr',
      isDeleted: false,
    },
  }
);


userSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('User', userSchema);
