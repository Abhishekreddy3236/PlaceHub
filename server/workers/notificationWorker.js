const NotificationJob = require('../models/NotificationJob');
const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');
const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const providerFactory = require('../services/notification/providers/providerFactory');
const crypto = require('crypto');

const instanceId = process.env.pm_id || crypto.randomUUID();
const LOCK_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const BATCH_SIZE = 500;

class NotificationWorker {
  constructor() {
    this.isRunning = false;
    this.isProcessingJob = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Initial poll
    this.timer = setInterval(() => this.processNextJob(), 15000);
    console.log(`Notification Worker started [Instance: ${instanceId}]`);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async processNextJob() {
    if (this.isProcessingJob) return;
    this.isProcessingJob = true;
    let jobProcessed = false;
    try {
      const now = new Date();
      const lockThreshold = new Date(now.getTime() - LOCK_TIMEOUT_MS);

      // Acquire lock atomically
      const job = await NotificationJob.findOneAndUpdate(
        {
          status: { $in: ['pending', 'failed', 'processing'] },
          nextRetryAt: { $lte: now },
          $or: [
            { lockedAt: null },
            { lockedAt: { $lte: lockThreshold } }
          ],
          attempts: { $lt: 5 } // Max 5 attempts
        },
        {
          $set: {
            status: 'processing',
            lockedAt: now,
            lockedBy: instanceId
          },
          $inc: { attempts: 1 }
        },
        { sort: { nextRetryAt: 1 }, new: true }
      );

      if (!job) return; // No jobs pending

      await this.executeJob(job);
      jobProcessed = true;

    } catch (error) {
      console.error('Worker polling error:', error);
    } finally {
      this.isProcessingJob = false;
      if (jobProcessed) {
        // Immediately process next job to drain queue efficiently
        setImmediate(() => this.processNextJob());
      }
    }
  }

  async executeJob(job) {
    try {
      if (job.type === 'FANOUT_JOB') {
        await this.handleFanoutJob(job.payload);
      } else if (job.type === 'NOTIFY_USER') {
        await this.handleUserJob(job.payload, job.idempotencyKey);
      } else if (job.type === 'NOTIFY_BULK') {
        await this.handleBulkJob(job, job.idempotencyKey);
      }

      // Mark completed
      await NotificationJob.updateOne(
        { _id: job._id, lockedBy: instanceId },
        { $set: { status: 'completed', lockedAt: null } }
      );
    } catch (error) {
      console.error(`Job ${job._id} failed:`, error);

      // Calculate backoff
      const backoffMinutes = [0, 5, 15, 30, 60][job.attempts] || 60;
      const nextRetryAt = new Date(Date.now() + backoffMinutes * 60000);

      await NotificationJob.updateOne(
        { _id: job._id, lockedBy: instanceId },
        {
          $set: {
            status: job.attempts >= 5 ? 'failed' : 'failed', // stays failed until next poll if < 5
            lastError: error.message,
            lockedAt: null,
            nextRetryAt: nextRetryAt
          }
        }
      );
    }
  }

  async handleFanoutJob(payload) {
    const { jobId } = payload;
    const jobDoc = await Job.findById(jobId).lean();
    if (!jobDoc) return;

    // FIND ELIGIBLE STUDENTS
    const query = {
      role: 'student',
      isActive: true,
      isDeleted: false
    };

    if (jobDoc.eligibleSchools?.length > 0) {
      query.school = {
        $in: jobDoc.eligibleSchools
      };
    }

    if (jobDoc.graduationYears?.length > 0) {
      query.graduationYear = {
        $in: jobDoc.graduationYears
      };
    }

    const eligibleStudents = await User.find(query).select('_id').lean();

    if (eligibleStudents.length === 0) return;

    const studentIds = eligibleStudents.map(s => s._id);

    // Process in batches
    for (let i = 0; i < studentIds.length; i += BATCH_SIZE) {
      const batchIds = studentIds.slice(i, i + BATCH_SIZE);

      const notifications = batchIds.map(id => ({
        recipientId: id,
        type: 'JOB_CREATED',
        title: `🔔 New Job: ${jobDoc.title} at ${jobDoc.company}`,
        body: 'Check out this new opportunity that matches your profile!',
        actionUrl: `/jobs/${jobId}`,
        metadata: {
          jobId: jobDoc._id,
          idempotencyKey: `JOB_CREATED_${jobDoc._id}_${id}`
        }
      }));

      try {
        await Notification.insertMany(notifications, { ordered: false });
      } catch (err) {
        const isDuplicateError = err.name === 'MongoBulkWriteError' || err.name === 'BulkWriteError' || err.code === 11000;
        if (!isDuplicateError) {
          throw err;
        }
        if (err.writeErrors) {
          const hasNonDuplicateErrors = err.writeErrors.some(e => e.code !== 11000);
          if (hasNonDuplicateErrors) {
            throw err;
          }
        }
      }

      const batchIdempotencyKeys = notifications.map(n => n.metadata.idempotencyKey);

      const pendingNotifications = await Notification.find({
        recipientId: { $in: batchIds },
        type: 'JOB_CREATED',
        'metadata.idempotencyKey': { $in: batchIdempotencyKeys },
        pushStatus: 'PENDING'
      }).select('_id recipientId title body actionUrl metadata').lean();

      if (pendingNotifications.length > 0) {
        const result = await this.deliverPushToUsers(pendingNotifications);

        if (result.successfulIds.length > 0) {
          await Notification.updateMany(
            { _id: { $in: result.successfulIds }, pushStatus: 'PENDING' },
            { $set: { pushStatus: 'SENT' } }
          );
        }

        if (result.error) {
          throw result.error;
        }
      }
    }
  }

  async handleUserJob(payload, queueIdempotencyKey) {
    const { applicationId } = payload;
    const appDoc = await Application.findById(applicationId).populate('jobId', 'title company').lean();
    if (!appDoc || !appDoc.userId) return;

    const studentDoc = await User.findById(appDoc.userId).select('role isActive isDeleted').lean();
    if (!studentDoc || studentDoc.role !== 'student' || studentDoc.isActive !== true || studentDoc.isDeleted !== false) {
      return; // Strict isolation and block enforcement
    }

    let title = '';

    if (appDoc.status === 'selected') {
      title = '🏆 Congratulations! You have been selected';
    } else if (appDoc.status === 'rejected') {
      title = `ℹ️ Not selected in Round ${appDoc.rejectedAtRound || appDoc.currentRound || 1}`;
    } else {
      title = `🎓 Shortlisted for Round ${appDoc.currentRound || 1}`;
    }

    const body = `${appDoc.jobId?.title} at ${appDoc.jobId?.company}`;

    const stateIdempotencyKey = `APP_STATUS_CHANGED_${appDoc._id}_${appDoc.status}_${appDoc.currentRound || 1}`;

    try {
      await Notification.create({
        recipientId: appDoc.userId,
        type: 'APP_STATUS_CHANGED',
        title,
        body,
        actionUrl: `/my-applications`,
        metadata: {
          applicationId: appDoc._id,
          status: appDoc.status,
          idempotencyKey: stateIdempotencyKey
        }
      });
    } catch (err) {
      if (err.code !== 11000) {
        throw err;
      }
    }

    const pendingNotification = await Notification.findOne({
      recipientId: appDoc.userId,
      type: 'APP_STATUS_CHANGED',
      'metadata.idempotencyKey': stateIdempotencyKey,
      pushStatus: 'PENDING'
    }).select('_id recipientId title body actionUrl metadata').lean();

    if (pendingNotification) {
      const result = await this.deliverPushToUsers([pendingNotification]);

      if (result.successfulIds.some(id => id.toString() === pendingNotification._id.toString())) {
        await Notification.updateOne(
          { _id: pendingNotification._id, pushStatus: 'PENDING' },
          { $set: { pushStatus: 'SENT' } }
        );
      }

      if (result.error) {
        throw result.error;
      }
    }
  }

  async handleBulkJob(job, bulkIdempotencyKey) {
    const { applicationIds } = job.payload;

    // Process one by one for simplicity and safety, relying on the batching above
    let processedCount = 0;
    for (const appId of applicationIds) {
      await this.handleUserJob({ applicationId: appId }, `${bulkIdempotencyKey}_${appId}`);
      processedCount++;

      // Touch the lock every 100 items to prevent lock expiration during massive scale
      if (processedCount % 100 === 0) {
        await NotificationJob.updateOne(
          { _id: job._id, lockedBy: instanceId },
          { $set: { lockedAt: new Date() } }
        );
      }
    }
  }

  async deliverPushToUsers(notifications) {
    const result = {
      successfulIds: [],
      error: null
    };

    if (!notifications || notifications.length === 0) {
      return result;
    }

    const recipientIds = notifications.map(n => n.recipientId);

    const activeUsers = await User.find({
      _id: { $in: recipientIds },
      isActive: true,
      isDeleted: false
    })
      .select('_id')
      .lean();

    const activeUserIdsStr = activeUsers.map(user => user._id.toString());

    const subscriptions = await PushSubscription.find({
      userId: { $in: activeUserIdsStr },
      isActive: true
    }).lean();

    const userSubsMap = {};
    for (const sub of subscriptions) {
      const uid = sub.userId.toString();
      if (!userSubsMap[uid]) userSubsMap[uid] = [];
      userSubsMap[uid].push(sub);
    }

    const temporaryErrors = [];

    const processingPromises = notifications.map(async (notif) => {
      const uid = notif.recipientId.toString();

      if (!activeUserIdsStr.includes(uid) || !userSubsMap[uid] || userSubsMap[uid].length === 0) {
        result.successfulIds.push(notif._id);
        return;
      }

      const payload = {
        title: notif.title,
        body: notif.body,
        actionUrl: notif.actionUrl,
        tag: notif.metadata?.idempotencyKey
      };

      const subs = userSubsMap[uid];
      let successfulDeviceCount = 0;
      let userTemporaryErrors = [];

      const devicePromises = subs.map(async (sub) => {
        try {
          const adapter = providerFactory.getProvider(sub.provider);
          await adapter.send(sub.token, payload);
          successfulDeviceCount++;
        } catch (error) {
          if (error.isExpired || error.statusCode === 410 || error.statusCode === 404) {
            await PushSubscription.updateOne({ _id: sub._id }, { $set: { isActive: false, inactiveAt: new Date() } });
          } else {
            userTemporaryErrors.push(error);
            temporaryErrors.push(error);
          }
        }
      });

      await Promise.allSettled(devicePromises);

      const shouldMarkSent = successfulDeviceCount > 0 || userTemporaryErrors.length === 0;

      if (shouldMarkSent) {
        result.successfulIds.push(notif._id);
      }
    });

    await Promise.all(processingPromises);

    if (temporaryErrors.length > 0) {
      result.error = new Error(`Push delivery failed for ${temporaryErrors.length} temporary failures`);
      result.error.details = temporaryErrors;
    }

    return result;
  }
}

// Export a singleton instance
module.exports = new NotificationWorker();
