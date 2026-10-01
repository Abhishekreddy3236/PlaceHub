const mongoose = require('mongoose');

const blockedUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    isBlocked: {
      type: Boolean,
      default: true
    },
    reason: {
      type: String,
      enum: ['None', 'Placed', 'Unauthorised', 'Opted Out', 'Active Backlogs', 'Low CGPA', 'DC', 'Other'],
      default: 'None'
    },
    school: {
      type: String,
      default: null
    },
    admissionId: {
      type: String,
      default: null
    },
    graduationYear: {
      type: Number,
      default: null
    }
  },
  { timestamps: true }
);

blockedUserSchema.index({ school: 1, graduationYear: 1, email: 1 });

module.exports = mongoose.model('BlockedUser', blockedUserSchema);
