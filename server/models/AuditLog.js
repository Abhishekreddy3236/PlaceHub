const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    performedByEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    performedByRole: {
      type: String,
      default: '',
      trim: true,
    },
    target: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    targetId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    targetType: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
