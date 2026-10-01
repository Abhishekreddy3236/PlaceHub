const mongoose = require('mongoose');
const BulkOperation = require('../models/BulkOperation');
const { processBulkActionLogic } = require('./applicationController');

const AppError = require('../utils/AppError');
const { successResponse } = require('../utils/response');

exports.getBulkOperationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid operation ID format", 400);
    }

    const operation = await BulkOperation.findById(id).select('-__v');

    if (!operation) {
      throw new AppError("Operation not found", 404);
    }

    const TEN_MINUTES = 10 * 60 * 1000;
    const timeSinceUpdate = operation.updatedAt
      ? Date.now() - new Date(operation.updatedAt).getTime()
      : Infinity;
    if (
      (operation.status || "").toUpperCase() === "IN_PROGRESS" &&
      Number(operation.processed || 0) < Number(operation.total || 0) &&
      timeSinceUpdate > TEN_MINUTES
    ) {
      operation.status = "FAILED";
      await operation.save();
    }

    successResponse(res, { data: operation });
  } catch (error) {
    next(error);
  }
};

exports.retryBulkOperation = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid operation ID format", 400);
    }

    const operation = await BulkOperation.findById(id);

    if (!operation) {
      throw new AppError("Operation not found", 404);
    }

    const timeSinceUpdate = operation.updatedAt
      ? Date.now() - new Date(operation.updatedAt).getTime()
      : Infinity;

    if (
      (operation.status || "").toUpperCase() === "COMPLETED" &&
      operation.updatedAt &&
      timeSinceUpdate < 5000
    ) {
      throw new AppError("Retry too fast, please wait", 429);
    }

    if (operation.status !== 'COMPLETED') {
      throw new AppError("Can only retry COMPLETED operations", 400);
    }

    if (!operation.failedItems || operation.failedItems.length === 0) {
      throw new AppError("No failed items to retry", 400);
    }

    const retryIds = operation.failedItems.map(item => item.id);

    const { validIds, failedItems: newFailedItems, updatedCount } = await processBulkActionLogic(retryIds, operation.action, req);

    const existingFailuresMap = new Map();
    operation.failedItems.forEach(item => {
      if (item.id) {
        existingFailuresMap.set(item.id.toString(), item);
      }
    });

    const currentFailedIds = new Set(newFailedItems.map(f => f.id.toString()));

    const updatedFailedItems = [];

    for (const [idStr, oldItem] of existingFailuresMap.entries()) {
      if (currentFailedIds.has(idStr)) {
        const newReason = newFailedItems.find(f => f.id.toString() === idStr)?.reason;
        updatedFailedItems.push({
          id: oldItem.id,
          reason: newReason || oldItem.reason,
          retryCount: (oldItem.retryCount || 0) + 1
        });
      }
    }

    operation.failedItems = updatedFailedItems;
    operation.failed = updatedFailedItems.length;
    operation.success = operation.total - operation.failed;

    await operation.save();

    successResponse(res, {
      data: {
        retriedCount: updatedCount,
        remainingFailed: operation.failed
      }
    });
  } catch (error) {
    next(error);
  }
};
