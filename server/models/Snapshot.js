const mongoose = require('mongoose');

const snapshotSchema = new mongoose.Schema(
  {
    snapshotId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    hash: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    refCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    repairLockUntil: {
      type: Date,
      default: null,
    },
    pendingDelete: {
      type: Boolean,
      default: false,
    },
  },
  { versionKey: false }
);

snapshotSchema.index({ hash: 1 }, { unique: true });
snapshotSchema.index({ refCount: 1 });

module.exports = mongoose.model('Snapshot', snapshotSchema);
