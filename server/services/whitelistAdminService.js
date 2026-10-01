const WhitelistEmail = require('../models/WhitelistEmail');
const whitelistDbService = require('./whitelistDbService');
const Config = require('../models/Config');
const { parseCsvEmails } = require('../utils/csvParser');
const configService = require('./configService');
const AppError = require('../utils/AppError');
const { canonicalizeEmail } = require('../utils/emailCanonicalization');

const uploadSource = async (fileBuffer, name) => {
  const parsedDbEmails = parseCsvEmails(fileBuffer);

  if (parsedDbEmails.length === 0) {
    throw new AppError('CSV contains no valid emails', 400);
  }

  await whitelistDbService.bulkInsertEmails(parsedDbEmails);

  return { success: true, count: parsedDbEmails.length };
};



const addManual = async (email) => {
  const cleanEmail = canonicalizeEmail(email);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Invalid email');
  }

  try {
    await WhitelistEmail.create({ email: cleanEmail });
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError('Email already exists', 400);
    }
    throw err;
  }
};

const removeManual = async (email) => {
  const cleanEmail = canonicalizeEmail(email);
  await WhitelistEmail.deleteOne({ email: cleanEmail });
};

const getStatus = async () => {
  const config = await Config.getGlobalConfig();
  
  return {
    enabled: config?.whitelistEnabled === true,
  };
};

module.exports = {
  uploadSource,
  addManual,
  removeManual,
  getStatus,
};
