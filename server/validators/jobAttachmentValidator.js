const { body, param } = require('express-validator');
const mongoose = require('mongoose');

const validateObjectIdParam = (paramName) => [
  param(paramName)
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error(`Invalid ${paramName}`);
      }
      return true;
    })
];

const validateCompleteUpload = [
  body('r2Key')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('r2Key is required and must be a string')
    .custom((value) => {
      if (!value.startsWith('job-attachments/')) {
        throw new Error('r2Key must be within the job-attachments/ prefix');
      }
      
      const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'];
      const hasAllowedExtension = allowedExtensions.some(ext => value.toLowerCase().endsWith(ext));
      
      if (!hasAllowedExtension) {
        throw new Error('r2Key must end with an approved extension');
      }
      
      if (value.includes('..') || value.includes('//')) {
        throw new Error('Invalid r2Key format');
      }
      return true;
    }),
  body('fileName')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('fileName is required and must be a string')
    .custom((value) => {
      if (value.includes('/') || value.includes('\\')) {
        throw new Error('fileName cannot contain path separators');
      }
      return true;
    }),
  body('size')
    .isNumeric()
    .withMessage('size must be a number')
    .custom((value) => {
      if (value <= 0) {
        throw new Error('Size must be greater than 0');
      }
      if (value > 2097152) { // 2MB
        throw new Error('Size must not exceed 2MB');
      }
      return true;
    }),
  body('mimeType')
    .isString()
    .trim()
    .isIn([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png'
    ])
    .withMessage('mimeType is invalid or unsupported')
];

module.exports = {
  validateJobIdParam: validateObjectIdParam('jobId'),
  validateAttachmentIdParam: validateObjectIdParam('attachmentId'),
  validateCompleteUpload
};
