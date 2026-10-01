const mongoose = require('mongoose');
const softDeletePlugin = require('./plugins/softDelete');
const { SCHOOLS } = require('../utils/constants');

const roundSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    normalizedTitle: { type: String, trim: true, lowercase: true },
    company: { type: String, required: true, trim: true },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    description: { type: String, required: true },
    location: { type: String, required: true, trim: true },
    jobType: {
      type: String,
      enum: ['Full-time', 'Part-time', 'Internship', 'Contract'],
      required: true,
    },
    salary: { type: String },
    skills: [{ type: String, trim: true }],
    deadline: { type: Date, required: true },
    requirements: [{ type: String }],
    rounds: { type: [roundSchema], default: [] },
    eligibleSchools: [{ type: String, enum: SCHOOLS }],

    graduationYears: { type: [Number], default: [] },
    logo: { type: String, default: '' },
    logoPublicId: { type: String, default: '' },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hrId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

jobSchema.index({ title: 'text', company: 'text', description: 'text', location: 'text' });
jobSchema.index({ isActive: 1, createdAt: -1 });
jobSchema.index({ companyId: 1, deadline: 1, isDeleted: 1 });
jobSchema.index(
  { companyId: 1, normalizedTitle: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

// Auto-compute normalizedTitle before validation
jobSchema.pre('validate', function (next) {
  if (this.title) {
    this.normalizedTitle = this.title.trim().toLowerCase();
  }
  next();
});

jobSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Job', jobSchema);
