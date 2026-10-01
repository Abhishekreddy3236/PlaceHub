require('dotenv').config({ path: __dirname + '/../.env' });

const connectDB = require('../config/db');
const bootstrapData = require('../config/bootstrapData');
const seedAdmin = require('../config/seedAdmin');
const logger = require('../config/logger');

const run = async () => {
  try {
    await connectDB();

    //Controlled bootstrap (migrations only)
    if (process.env.RUN_BOOTSTRAP === 'true') {
      await bootstrapData();
      logger.info('Bootstrap completed');
    }

    //Controlled admin creation
    if (process.env.RUN_SEED_ADMIN === 'true') {
      await seedAdmin();
      logger.info('Admin seed completed');
    }

    process.exit(0);
  } catch (error) {
    logger.error(`Failed: ${error.message}`);
    process.exit(1);
  }
};

run();