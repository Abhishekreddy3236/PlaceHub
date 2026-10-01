const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['JOB_CREATED', 'APP_STATUS_CHANGED'],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    actionUrl: { type: String },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    metadata: {
      jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
      applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
      status: { type: String },
      idempotencyKey: { type: String, required: true },
    },
    pushStatus: {
      type: String,
      enum: ['PENDING', 'SENT'],
      default: 'PENDING'
    },
  },
  { timestamps: true }
);

// Performance Index: For fetching user history (IXSCAN)
notificationSchema.index({ recipientId: 1, createdAt: -1 });

// Idempotency: Enforce duplicate prevention using the unique event identity
notificationSchema.index(
  { recipientId: 1, type: 1, 'metadata.idempotencyKey': 1 },
  { unique: true }
);

// Performance Index: For Admin Health Dashboard countDocuments({ isRead: false })
notificationSchema.index({ isRead: 1 });

// Automatic TTL Cleanup: Expire notifications after 15 days (1296000 seconds)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1296000 });

module.exports = mongoose.model('Notification', notificationSchema);
