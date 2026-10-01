const bcrypt = require('bcrypt');
const User = require('../models/User');
const logger = require('./logger');

const seedAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Admin';

    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
    }

    //Find admin including soft-deleted ones
    const existingAdmin = await User.findOne({ email: adminEmail })
      .setOptions({ withDeleted: true });

    if (!existingAdmin) {
      //CREATE NEW ADMIN
      const hashedPassword = await bcrypt.hash(adminPassword, 12);

      await User.create({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        isVerified: true,
        isActive: true,
        isDeleted: false,
        mustChangePassword: true,
      });

      logger.info('Admin created successfully');
      return;
    }

    //If admin exists but is soft-deleted → restore it
    if (existingAdmin.isDeleted) {
      await User.updateOne(
        { _id: existingAdmin._id },
        {
          $set: {
            isDeleted: false,
            isActive: true,
            isVerified: true,
          },
        }
      );

      logger.info('Admin restored from soft delete');
      return;
    }

    //Admin exists and active → do nothing
    logger.info('Admin already exists, skipping creation');

  } catch (error) {
    logger.error(`Error in seedAdmin: ${error.message}`);
    throw error; // important: don't silently fail
  }
};

module.exports = seedAdmin;
