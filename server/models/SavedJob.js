const mongoose = require('mongoose');
const softDeletePlugin = require('./plugins/softDelete');

const savedJobSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

savedJobSchema.index({ job: 1, student: 1, isDeleted: 1 }, { unique: true });
savedJobSchema.index({ student: 1 });
savedJobSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('SavedJob', savedJobSchema);
