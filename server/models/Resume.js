const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  key: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    default: 0,
  },
  hash: {
    type: String,
    trim: true,
    lowercase: true,
    default: null,
    validate: {
      validator(value) {
        return value == null || /^[a-f0-9]{64}$/.test(value);
      },
      message: 'Resume hash must be a SHA256 hex digest',
    },
  },
  status: {
    type: String,
    enum: ['pending', 'active'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

resumeSchema.index({ userId: 1, status: 1 });
resumeSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' }
  }
);

module.exports = mongoose.model('Resume', resumeSchema);
