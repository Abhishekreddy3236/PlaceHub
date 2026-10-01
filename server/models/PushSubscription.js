const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    provider: {
      type: String,
      enum: ['webpush', 'fcm', 'apns'],
      required: true,
    },
    deviceType: {
      type: String,
      enum: ['browser', 'android', 'ios'],
      required: true,
    },
    token: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      validate: {
        validator: function(v) {
          try {
            const serialized = typeof v === 'string' ? v : JSON.stringify(v);
            return serialized.length <= 5000;
          } catch (err) {
            return false;
          }
        },
        message: 'Token payload exceeds maximum allowed size of 5000 characters.'
      }
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    inactiveAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Performance Index: For bulk fetching target tokens securely and quickly (IXSCAN)
pushSubscriptionSchema.index({ userId: 1, isActive: 1 });

// Deduplication Index: Prevent duplicate device storage for Web Push
pushSubscriptionSchema.index(
  { provider: 1, 'token.endpoint': 1 },
  { unique: true, partialFilterExpression: { provider: 'webpush' } }
);

// Performance Index: For Admin Health Dashboard countDocuments({ isActive: true/false })
pushSubscriptionSchema.index({ isActive: 1 });

// TTL Cleanup Index: Automatically delete inactive subscriptions after 30 days
pushSubscriptionSchema.index(
  { inactiveAt: 1 },
  { expireAfterSeconds: 2592000, partialFilterExpression: { isActive: false } }
);

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
