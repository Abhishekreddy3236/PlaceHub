const mongoose = require('mongoose');

const notificationJobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['FANOUT_JOB', 'NOTIFY_USER', 'NOTIFY_BULK'],
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    nextRetryAt: {
      type: Date,
      default: Date.now,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    lockedBy: {
      type: String,
      default: null,
    },
    lastError: {
      type: String,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true
    }
  },
  { timestamps: true }
);


notificationJobSchema.index({ status: 1, nextRetryAt: 1, lockedAt: 1 });

notificationJobSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 604800, partialFilterExpression: { status: { $in: ['completed', 'failed'] } } }
);

module.exports = mongoose.model('NotificationJob', notificationJobSchema);
