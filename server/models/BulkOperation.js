const mongoose = require('mongoose');

const failedItemSchema = new mongoose.Schema({
  id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  type: {
    type: String,
    enum: ['DB', 'STORAGE', 'VALIDATION'],
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  retryCount: {
    type: Number,
    default: 0,
  },
}, { _id: false });

const bulkOperationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['BULK_ACTION', 'DELETE'],
    required: true,
  },
  action: {
    type: String,
    enum: ['SHORTLIST', 'SELECT', 'REJECT'],
    required: function () {
      return this.type === 'BULK_ACTION';
    },
  },
  status: {
    type: String,
    enum: ['IN_PROGRESS', 'COMPLETED', 'FAILED'],
    default: 'IN_PROGRESS',
    required: true,
  },
  total: {
    type: Number,
    default: 0,
  },
  processed: {
    type: Number,
    default: 0,
  },
  success: {
    type: Number,
    default: 0,
  },
  failed: {
    type: Number,
    default: 0,
  },
  failedItems: [failedItemSchema],
  datasetHash: {
    type: String,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

bulkOperationSchema.index(
  { datasetHash: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "IN_PROGRESS" } }
);

bulkOperationSchema.on('index', function (err) {
  if (err) {
    console.error('Index error:', err);
  }
});

module.exports = mongoose.model('BulkOperation', bulkOperationSchema);
