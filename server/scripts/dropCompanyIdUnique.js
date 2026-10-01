require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../config/logger');

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    logger.error('MONGO_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  logger.info('Connected to MongoDB');

  const collection = mongoose.connection.collection('users');
  const indexes = await collection.indexes();

  const target = indexes.find(
    (idx) => idx.key && idx.key.companyId && idx.unique
  );

  if (target) {
    logger.info(`Dropping unique index: ${target.name}`);
    await collection.dropIndex(target.name);
    logger.info('Done - unique constraint on companyId removed.');
  } else {
    logger.info('No unique index on companyId found. Nothing to do.');
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  logger.error(err.stack || err.message || 'Migration failed');
  process.exit(1);
});
