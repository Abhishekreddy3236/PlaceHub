require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Snapshot = require('../models/Snapshot');
const Application = require('../models/Application');
const r2Service = require('../services/r2Service');
const logger = require('../config/logger');
const fs = require('fs');

const LOCK_FILE = 'gc.lock';

if (fs.existsSync(LOCK_FILE)) {
  console.log('GC already running. Exiting...');
  process.exit(0);
}

fs.writeFileSync(LOCK_FILE, 'running');

const LIMIT = 50; // safe batch size
const DRY_RUN = true;

const cleanupSnapshots = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
      logger.error('MONGO_URI is not set in .env');
      return 1;
    }
    
    await mongoose.connect(mongoUri);
    console.log('=== SNAPSHOT GC START ===');
    console.log('DRY_RUN:', DRY_RUN);
    console.log('LIMIT:', LIMIT);
    logger.info('Connected to DB. Starting Snapshot GC...');

    const safetyWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const snapshots = await Snapshot.find({
      refCount: 0,
      updatedAt: { $lt: safetyWindow }
    }).limit(LIMIT);

    logger.info(`Found ${snapshots.length} candidate snapshots for cleanup.`);

    let deletedCount = 0;
    let skippedCount = 0;
    let missingR2Count = 0;

    for (const snapshot of snapshots) {
      const isUsed = await Application.exists({
        snapshotId: snapshot.snapshotId
      });

      if (isUsed) {
        console.log('SKIP (still referenced):', snapshot.snapshotId);
        skippedCount++;
        continue;
      }

      if (DRY_RUN) {
        console.log('[DRY RUN] Would delete:', snapshot.snapshotId);
        continue;
      }

      const exists = await r2Service.fileExists(snapshot.key);

      if (!exists) {
        console.warn('File missing, cleaning DB only:', snapshot.snapshotId);
        await Snapshot.deleteOne({ snapshotId: snapshot.snapshotId });
        missingR2Count++;
        continue;
      }

      try {
        await r2Service.deleteObject(snapshot.key);
        await Snapshot.deleteOne({ snapshotId: snapshot.snapshotId });

        console.log('Deleted snapshot:', snapshot.snapshotId);
        deletedCount++;
      } catch (err) {
        console.error('Failed deleting snapshot:', snapshot.snapshotId, err);
      }
    }

    logger.info(`Snapshot GC Complete.`);
    logger.info(`Deleted: ${deletedCount}`);
    logger.info(`Skipped (still referenced): ${skippedCount}`);
    logger.info(`Missing in R2 (DB cleaned): ${missingR2Count}`);

    console.log('=== SNAPSHOT GC END ===');
    return 0;
  } catch (error) {
    console.error('GC Error:', error);
    return 1;
  } finally {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  }
};

cleanupSnapshots().then(code => process.exit(code));
