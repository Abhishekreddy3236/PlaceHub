const mongoose = require('mongoose');
const { canonicalizeEmail } = require('../utils/emailCanonicalization');

const whitelistEmailSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      set: (v) => canonicalizeEmail(v)
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: false }
);

module.exports = mongoose.model('WhitelistEmail', whitelistEmailSchema);
