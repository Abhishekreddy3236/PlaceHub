require('dotenv').config();
const mongoose = require('mongoose');

// Models
const User = require('../models/User');
const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');
const NotificationJob = require('../models/NotificationJob');

const run = async () => {
  try {
    const MONGO_URI = process.env.MONGODB_URI;
    if (!MONGO_URI) {
      throw new Error('MONGODB_URI is not defined in .env');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    console.log('Creating User index for targeting (role, isActive, isDeleted, school, graduationYear)...');
    await User.collection.createIndex({ role: 1, isActive: 1, isDeleted: 1, school: 1, graduationYear: 1 });

    console.log('Creating PushSubscription index (userId, isActive)...');
    await PushSubscription.collection.createIndex({ userId: 1, isActive: 1 });

    console.log('Creating Notification history index (recipientId, createdAt)...');
    await Notification.collection.createIndex({ recipientId: 1, createdAt: -1 });

    console.log('Creating Notification idempotency index (JOB_CREATED)...');
    await Notification.collection.createIndex(
      { recipientId: 1, type: 1, 'metadata.jobId': 1 },
      { unique: true, partialFilterExpression: { type: 'JOB_CREATED' } }
    );

    console.log('Creating Notification idempotency index (APP_STATUS_CHANGED)...');
    await Notification.collection.createIndex(
      { recipientId: 1, type: 1, 'metadata.applicationId': 1, 'metadata.status': 1 },
      { unique: true, partialFilterExpression: { type: 'APP_STATUS_CHANGED' } }
    );

    console.log('Creating NotificationJob index (status, nextRetryAt, lockedAt)...');
    await NotificationJob.collection.createIndex({ status: 1, nextRetryAt: 1, lockedAt: 1 });

    console.log('All indexes created successfully.');
  } catch (error) {
    console.error('Failed to create indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

run();
