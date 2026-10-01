const mongoose = require('mongoose');

const registrationChallengeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    otpHash: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    verifyAttempts: { type: Number, default: 0 },
    attemptCount: { type: Number, default: 0 },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

registrationChallengeSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('RegistrationChallenge', registrationChallengeSchema);
