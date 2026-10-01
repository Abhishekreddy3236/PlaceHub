const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const crypto = require('crypto');
const Application = require('../models/Application');
const Snapshot = require('../models/Snapshot');
const r2Service = require('./r2Service');

const SNAPSHOT_COPY_WAIT_ATTEMPTS = 8;
const SNAPSHOT_COPY_WAIT_MS = 150;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeSnapshotId = (snapshotId) => String(snapshotId || '').trim();

const isR2NotFoundError = (err) => {
  return err?.statusCode === 404 || err?.code === 'NoSuchKey';
};

const buildSharedSnapshotKey = (snapshotId) => `resumes/snapshots/${snapshotId}.pdf`;

const waitForSnapshotObject = async (key) => {
  for (let attempt = 0; attempt < SNAPSHOT_COPY_WAIT_ATTEMPTS; attempt += 1) {
    if (await r2Service.fileExists(key)) {
      return true;
    }

    await sleep(SNAPSHOT_COPY_WAIT_MS);
  }

  return false;
};



const releaseSnapshotReference = async (snapshotId, count = 1) => {
  const normalizedSnapshotId = normalizeSnapshotId(snapshotId);
  const releaseCount = Math.max(Number(count) || 1, 1);

  if (!normalizedSnapshotId) {
    return { deleted: false, skipped: true, reason: 'missing-snapshot-id' };
  }

  const updated = await Snapshot.findOneAndUpdate(
    {
      snapshotId: normalizedSnapshotId,
      refCount: { $gte: releaseCount }
    },
    {
      $inc: { refCount: -releaseCount }
    },
    { new: true }
  );

  if (!updated) {
    logger.warn(`snapshot:refcount-mismatch snapshotId=${normalizedSnapshotId} releaseCount=${releaseCount}`);
    return { deleted: false, skipped: true, reason: 'missing-snapshot-or-zero' };
  }

  const safeRefCount = Math.max(updated.refCount, 0);

  logger.info(`snapshot:snapshot_refcount_decremented snapshotId=${normalizedSnapshotId} decrement=${releaseCount} newRefCount=${safeRefCount}`);

  if (safeRefCount === 0 && updated.key) {
    try {
      await r2Service.deleteObject(updated.key);
    } catch (err) {
      if (!isR2NotFoundError(err)) {
        logger.error(`snapshot:delete-failed snapshotId=${normalizedSnapshotId} marked-for-retry error=${err.message}`);
        await Snapshot.updateOne(
          { snapshotId: normalizedSnapshotId },
          {
            $set: {
              pendingDelete: true
            }
          }
        );
        return { deleted: false, skipped: false, error: err.message };
      }
    }

    await Snapshot.deleteOne({ snapshotId: normalizedSnapshotId });
    logger.info(`snapshot:snapshot_deleted snapshotId=${normalizedSnapshotId} key=${updated.key}`);
    return { deleted: true, skipped: false };
  }

  return { deleted: false, skipped: false };
};

const releaseSnapshotsForApplications = async (applications = []) => {
  const snapshotCounts = new Map();
  const legacySnapshotKeys = new Set();

  for (const application of applications) {
    const snapshotId = normalizeSnapshotId(application?.snapshotId);

    if (snapshotId) {
      snapshotCounts.set(snapshotId, (snapshotCounts.get(snapshotId) || 0) + 1);
      continue;
    }

    const legacyKey = application?.resumeSnapshot?.key;
    if (legacyKey) {
      legacySnapshotKeys.add(legacyKey);
    }
  }

  const snapshotEntries = Array.from(snapshotCounts.entries());
  const snapshotBatchSize = 50;

  for (let i = 0; i < snapshotEntries.length; i += snapshotBatchSize) {
    const batch = snapshotEntries.slice(i, i + snapshotBatchSize);
    console.log(`Processing snapshot release batch: ${i / snapshotBatchSize}`);

    await Promise.all(
      batch.map(([snapshotId, count]) => releaseSnapshotReference(snapshotId, count))
    );
  }

  const legacyKeysArray = Array.from(legacySnapshotKeys);
  const legacyBatchSize = 50;

  for (let i = 0; i < legacyKeysArray.length; i += legacyBatchSize) {
    const batch = legacyKeysArray.slice(i, i + legacyBatchSize);
    console.log(`Processing legacy snapshot delete batch: ${i / legacyBatchSize}`);

    for (const key of batch) {
      try {
        await r2Service.deleteObject(key);
      } catch (error) {
        logger.warn(`snapshot:legacy-r2-delete-failed key=${key} error=${error.message}`);
      }
    }
  }
};

const acquireSnapshotForResume = async (resume, userId) => {
  if (!resume?.hash) {
    throw new AppError('Resume hash is required before snapshot acquisition', 400);
  }

  if (!resume?.key) {
    throw new AppError('Resume key is required before snapshot acquisition', 400);
  }

  const snapshotId = crypto.randomUUID();
  const snapshotKey = buildSharedSnapshotKey(snapshotId);
  const now = new Date();
  let upsertResult;
  let inserted = false;

  try {
    upsertResult = await Snapshot.updateOne(
      { hash: resume.hash },
      {
        $setOnInsert: {
          snapshotId,
          key: snapshotKey,
          userId,
          hash: resume.hash,
          size: Number(resume.size || 0),
          createdAt: now,
        },
        $inc: { refCount: 1 },
      },
      { upsert: true }
    );
    inserted = Boolean(upsertResult?.upsertedCount || upsertResult?.upsertedId);
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    await Snapshot.updateOne({ hash: resume.hash }, { $inc: { refCount: 1 } });
  }

  const snapshot = await Snapshot.findOne({ hash: resume.hash }).lean();
  if (!snapshot) {
    throw new Error('Resume snapshot could not be reserved');
  }

  if (inserted) {
    try {
      await r2Service.copyObject(resume.key, snapshot.key);
      logger.info(`snapshot:snapshot_created snapshotId=${snapshot.snapshotId} hash=${resume.hash}`);
    } catch (error) {
      await releaseSnapshotReference(snapshot.snapshotId).catch((releaseError) => {
        logger.warn(`snapshot:copy-rollback-failed snapshotId=${snapshot.snapshotId} error=${releaseError.message}`);
      });
      throw error;
    }

    return snapshot;
  }

  const ready = await waitForSnapshotObject(snapshot.key);
  if (!ready) {
    const lockExpiryMs = 30000;
    
    const attemptRepair = async () => {
      const lockExpiry = new Date(Date.now() + lockExpiryMs);
      const lockResult = await Snapshot.updateOne(
        { 
          snapshotId: snapshot.snapshotId, 
          $or: [
            { repairLockUntil: null },
            { repairLockUntil: { $lte: new Date() } }
          ]
        },
        { $set: { repairLockUntil: lockExpiry } }
      );

      const lockAcquired = lockResult && lockResult.modifiedCount > 0;

      if (lockAcquired) {
        try {
          await r2Service.copyObject(resume.key, snapshot.key);
          const visibilityConfirmed = await waitForSnapshotObject(snapshot.key);
          if (!visibilityConfirmed) {
            throw new Error('Repaired snapshot object failed visibility synchronization');
          }
          logger.info(`snapshot:snapshot_repaired snapshotId=${snapshot.snapshotId} hash=${resume.hash}`);
          await Snapshot.updateOne(
            { snapshotId: snapshot.snapshotId, repairLockUntil: lockExpiry }, 
            { $set: { repairLockUntil: null } }
          );
          return true;
        } catch (error) {
          await Snapshot.updateOne(
            { snapshotId: snapshot.snapshotId, repairLockUntil: lockExpiry }, 
            { $set: { repairLockUntil: null } }
          );
          throw error;
        }
      }
      return false;
    };

    try {
      if (await attemptRepair()) {
        return snapshot;
      }

      // We did not acquire the lock. Wait for the active repair to finish or expire.
      const currentSnap = await Snapshot.findOne({ snapshotId: snapshot.snapshotId }).lean();
      
      if (!currentSnap) {
        throw new Error('Snapshot document unexpectedly missing during repair wait');
      }
      
      const leaseEnd = currentSnap.repairLockUntil ? currentSnap.repairLockUntil.getTime() : Date.now();
      
      let repairReady = false;
      while (Date.now() < leaseEnd) {
        repairReady = await waitForSnapshotObject(snapshot.key);
        if (repairReady) {
          logger.info(`snapshot:snapshot_reused_after_repair snapshotId=${snapshot.snapshotId} hash=${resume.hash}`);
          return snapshot;
        }
      }

      // The lease expired and the object is still not visible. Try to acquire the lock ourselves once.
      if (await attemptRepair()) {
        return snapshot;
      }

      throw new Error('Resume snapshot object is not available after wait and retry');
    } catch (error) {
      await releaseSnapshotReference(snapshot.snapshotId).catch((releaseError) => {
        logger.warn(`snapshot:repair-rollback-failed snapshotId=${snapshot.snapshotId} error=${releaseError.message}`);
      });
      throw error;
    }
  }

  logger.info(`snapshot:snapshot_reused snapshotId=${snapshot.snapshotId} hash=${resume.hash}`);
  return snapshot;
};

const cleanupPendingSnapshots = async () => {
  const BATCH_SIZE = 100;

  while (true) {
    const snapshots = await Snapshot.find({ pendingDelete: true })
      .limit(BATCH_SIZE)
      .lean();

    if (!snapshots.length) break;

    let processedCount = 0;

    for (const snap of snapshots) {
      if (!snap.key) continue;

      try {
        await r2Service.deleteObject(snap.key);
        await Snapshot.deleteOne({ snapshotId: snap.snapshotId });

        logger.info(`snapshot:cleanup_deleted snapshotId=${snap.snapshotId}`);
        processedCount++;
      } catch (err) {
        if (!isR2NotFoundError(err)) {
          logger.error(
            `snapshot:cleanup_failed snapshotId=${snap.snapshotId} error=${err.message}`
          );
        } else {
          await Snapshot.deleteOne({ snapshotId: snap.snapshotId });

          logger.info(`snapshot:cleanup_deleted snapshotId=${snap.snapshotId}`);
          processedCount++;
        }
      }
    }

    if (processedCount === 0) {
      logger.warn('snapshot:cleanup_stuck_no_progress');
      break;
    }
  }
};

module.exports = {
  acquireSnapshotForResume,
  releaseSnapshotReference,
  releaseSnapshotsForApplications,
  cleanupPendingSnapshots,
};