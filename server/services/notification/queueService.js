const NotificationJob = require('../../models/NotificationJob');
const User = require('../../models/User');
const Application = require('../../models/Application');
const crypto = require('crypto');

class QueueService {
  /**
   * Triggers a fanout job for a newly created job.
   * This is called by JobService after successful creation.
   * Does NOT block the main thread.
   */
  async notifyJobCreated(jobId) {
    if (!jobId) return;

    try {
      // Create a background job to fan out
      await NotificationJob.create({
        type: 'FANOUT_JOB',
        payload: {
          jobId: jobId.toString(),
        },
        status: 'pending',
        idempotencyKey: `JOB_CREATED_${jobId.toString()}`
      });
    } catch (error) {
      if (error.code === 11000) {
        console.log(`Duplicate FANOUT_JOB prevented for job ${jobId}`);
        return;
      }
      // We only log this, we never want to break the main request
      console.error('Failed to queue FANOUT_JOB for job', jobId, error);
    }
  }

  /**
   * Triggers a notification for an individual application update.
   */
  async notifyApplicationUpdate(applicationId) {
    if (!applicationId) return;

    try {
      const app = await Application.findById(applicationId).select('status currentRound').lean();
      if (!app) return;

      const round = app.currentRound || 1;

      await NotificationJob.create({
        type: 'NOTIFY_USER',
        payload: {
          applicationId: applicationId.toString(),
        },
        status: 'pending',
        idempotencyKey: `APP_STATUS_CHANGED_${applicationId.toString()}_${app.status}_${round}`
      });
    } catch (error) {
      if (error.code === 11000) {
        console.log(`Duplicate NOTIFY_USER prevented for application ${applicationId}`);
        return;
      }
      console.error('Failed to queue NOTIFY_USER for application', applicationId, error);
    }
  }

  /**
   * Triggers notifications for bulk application updates (CSV upload).
   */
  async notifyBulkApplicationUpdate(applicationIds, operationId) {
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) return;

    try {
      const uniqueOperationId = operationId || crypto.createHash('sha256').update(applicationIds.join(',')).digest('hex');

      await NotificationJob.create({
        type: 'NOTIFY_BULK',
        payload: {
          applicationIds: applicationIds.map(id => id.toString()),
        },
        status: 'pending',
        idempotencyKey: `NOTIFY_BULK_${uniqueOperationId}`
      });
    } catch (error) {
      if (error.code === 11000) {
        console.log('Duplicate NOTIFY_BULK prevented');
        return;
      }
      console.error('Failed to queue NOTIFY_BULK', error);
    }
  }
}

module.exports = new QueueService();
