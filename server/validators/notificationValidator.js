const { body, param } = require('express-validator');
const mongoose = require('mongoose');

const validateSubscribe = [
  body('provider')
    .isString()
    .isIn(['webpush', 'fcm', 'apns'])
    .withMessage('Provider must be webpush, fcm, or apns'),
  body('deviceType')
    .isString()
    .isIn(['browser', 'android', 'ios'])
    .withMessage('DeviceType must be browser, android, or ios'),
  body('token')
    .custom((value, { req }) => {
      const provider = req.body.provider;

      if (provider === 'webpush') {
        if (typeof value !== 'object' || value === null) {
          throw new Error('Token must be an object for webpush');
        }
        if (typeof value.endpoint !== 'string' || !value.endpoint.trim()) {
          throw new Error('Endpoint must be a valid URL string');
        }
        if (typeof value.keys !== 'object' || value.keys === null) {
          throw new Error('Keys object is required for webpush');
        }
        if (typeof value.keys.p256dh !== 'string' || !value.keys.p256dh.trim()) {
          throw new Error('p256dh key is required');
        }
        if (typeof value.keys.auth !== 'string' || !value.keys.auth.trim()) {
          throw new Error('auth key is required');
        }
      } else if (provider === 'fcm' || provider === 'apns') {
        if (typeof value !== 'string') {
          throw new Error(`Token must be a string for ${provider}`);
        }
        if (value.length < 10 || value.length > 500) {
          throw new Error('Token length must be between 10 and 500 characters');
        }
      }

      return true;
    }),
  body('deviceMetadata')
    .optional()
    .isObject()
];

const validateObjectIdParam = (paramName) => [
  param(paramName)
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error(`Invalid ${paramName}`);
      }
      return true;
    })
];

module.exports = {
  validateSubscribe,
  validateObjectIdParam
};
