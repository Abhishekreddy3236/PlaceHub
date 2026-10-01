const mongoose = require('mongoose');

const jobAttachmentSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    r2Key: {
      type: String,
      required: true,
      unique: true,
    },
    size: {
      type: Number,
      required: true,
      min: 1,
      max: 2097152, // 2MB
    },
    mimeType: {
      type: String,
      required: true,
      enum: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/png'
      ],
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

jobAttachmentSchema.index({ jobId: 1, createdAt: -1 });

module.exports = mongoose.model('JobAttachment', jobAttachmentSchema);
