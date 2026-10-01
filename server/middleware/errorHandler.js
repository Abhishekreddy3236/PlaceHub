const multer = require('multer');
const AppError = require('../utils/AppError');
const { errorResponse } = require('../utils/response');

const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let error = err.name || 'Error';

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    error = 'MulterError';
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File size exceeds the allowed limit' : err.message;
  } else if (err.name === 'ZodError') {
    statusCode = 400;
    message = err.issues?.[0]?.message || 'Validation failed';
    error = 'ZodError';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Invalid or expired token';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid resource identifier';
  } else if (err.code === 11000) {
    statusCode = 400;
    const errorMessage = err.message || "";

    if (errorMessage.includes("companyId_1_normalizedTitle_1")) {
      message = "Job already exists for this company and role";
    } else if (errorMessage.includes("email")) {
      message = "Email already in use";
    } else if (errorMessage.includes("normalizedName")) {
      message = "Company already exists";
    } else {
      message = "Duplicate field value entered";
    }
    error = 'DuplicateKeyError';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors || {})[0]?.message || 'Validation failed';
  }

  const safeMessage = err.isOperational || statusCode !== 500 ? message : 'Internal server error';

  return errorResponse(res, {
    message: safeMessage,
    error,
    statusCode
  });
};

module.exports = {
  errorHandler,
  notFound,
};
