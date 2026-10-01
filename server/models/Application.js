const mongoose = require('mongoose');
const softDeletePlugin = require('./plugins/softDelete');

const profileSnapshotLinkSchema = new mongoose.Schema(
  {
    heading: { type: String, trim: true, maxlength: 80, immutable: true },
    url: { type: String, trim: true, maxlength: 2048, immutable: true },
  },
  { _id: false }
);

const profileSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, immutable: true },
    email: { type: String, trim: true, lowercase: true, immutable: true },
    age: { type: Number, required: true, immutable: true },
    branch: { type: String, trim: true, immutable: true },
    cgpa: { type: Number, required: true, immutable: true },
    tenthPercentage: { type: Number, required: true, immutable: true },
    twelfthPercentage: { type: Number, required: true, immutable: true },
    personalEmail: { type: String, required: true, trim: true, lowercase: true, immutable: true },
    mobileNumber: { type: String, required: true, trim: true, immutable: true },
    gender: { type: String, required: true, immutable: true },
    links: { type: [profileSnapshotLinkSchema], default: [], immutable: true },
    linkedin: { type: String, trim: true, immutable: true },
    github: { type: String, trim: true, immutable: true },
    portfolio: { type: String, trim: true, immutable: true },
    skills: { type: [String], default: [], immutable: true },
    school: { type: String, trim: true, immutable: true },
    rollNumber: { type: String, trim: true, immutable: true },
    admissionId: { type: String, trim: true, immutable: true },
    graduationYear: { type: Number, immutable: true },
  },
  { _id: false }
);

const resumeSnapshotSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, immutable: true },
    size: { type: Number, min: 0, immutable: true },
    createdAt: { type: Date, immutable: true },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
      immutable: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      immutable: true,
    },
    snapshotId: {
      type: String,
      default: null,
      immutable: true,
    },
    resumeSnapshot: {
      type: resumeSnapshotSchema,
      immutable: true,
    },

    profileSnapshot: {
      type: profileSnapshotSchema,
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    hasUnreadUpdate: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['in_progress', 'shortlisted', 'rejected', 'selected'],
      default: 'in_progress',
      index: true
    },
    currentRound: {
      type: Number,
      default: 1,
      min: 1
    },
    rejectedAtRound: {
      type: Number,
      default: null
    },
    rejectionInfo: {
      isAbsent: {
        type: Boolean,
        default: false
      }
    },
  },
  { timestamps: true }
);

applicationSchema.pre('validate', function setAliases(next) {
  if (!this.userId && this.student) {
    this.userId = this.student;
  }

  if (!this.student && this.userId) {
    this.student = this.userId;
  }

  next();
});

applicationSchema.index({ userId: 1, createdAt: -1 });
applicationSchema.index({ student: 1, createdAt: -1 });
applicationSchema.index({ jobId: 1, createdAt: -1 });
applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });
applicationSchema.index({ companyId: 1, status: 1, createdAt: -1 });
applicationSchema.index({ jobId: 1, status: 1 });
applicationSchema.index({ snapshotId: 1 });
applicationSchema.index({ userId: 1, hasUnreadUpdate: 1, updatedAt: -1 });
applicationSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Application', applicationSchema);
