const WhitelistEmail = require('../models/WhitelistEmail');
const { canonicalizeEmail } = require('../utils/emailCanonicalization');

const bulkInsertEmails = async (emailsArray) => {
  if (!Array.isArray(emailsArray) || emailsArray.length === 0) {
    return { inserted: 0, duplicatesSkipped: 0 };
  }

  const docs = emailsArray.map(email => ({ email }));

  try {
    const result = await WhitelistEmail.insertMany(docs, { ordered: false });
    return {
      inserted: result.length,
      duplicatesSkipped: 0
    };
  } catch (err) {
    if (err.code !== 11000) {
      throw err;
    }
    
    // SAFE fallback — DO NOT trust Mongo internals
    return {
      inserted: undefined,
      duplicatesSkipped: undefined,
      note: "Duplicate key errors occurred, partial insert completed safely"
    };
  }
};

const insertOne = async (email) => {
  if (!email) return null;
  
  try {
    const doc = await WhitelistEmail.create({ email });
    return doc;
  } catch (err) {
    if (err.code !== 11000) {
      throw err;
    }
    return null; // Ignore duplicate
  }
};

const isWhitelistedDb = async (email) => {
  const normalized = canonicalizeEmail(email);
  if (!normalized) return false;

  const exists = await WhitelistEmail.exists({ email: normalized });
  return !!exists;
};

module.exports = {
  bulkInsertEmails,
  insertOne,
  isWhitelistedDb
};
