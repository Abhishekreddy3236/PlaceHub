const { protect } = require('../middleware/auth');
const express = require('express');
const router = express.Router();
const {
  registerStudent,
  verifyOTP,
  login,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  changePassword,
  requestRegistrationOtp,
  getRegistrationStatus,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authSchemas } = require('../validators/schemas');
const {
  globalIpLimiter,
  registrationRequestOtpLimiter,
  registrationSubmitLimiter,
} = require('../middleware/registrationRateLimits');
const {
  loginLimiter,
  otpLimiter,
  verifyOtpLimiter,
  resetPasswordLimiter,
} = require('../middleware/rateLimiter');

router.post(
  '/register-student',
  globalIpLimiter,
  registrationSubmitLimiter,
  validate(authSchemas.registerStudent),
  registerStudent
);
router.post(
  '/request-otp',
  globalIpLimiter,
  ...registrationRequestOtpLimiter,
  validate(authSchemas.requestRegistrationOtp),
  requestRegistrationOtp
);
router.get('/registration-status', globalIpLimiter, getRegistrationStatus);
router.post('/verify-otp', globalIpLimiter, verifyOtpLimiter, validate(authSchemas.verifyOtp), verifyOTP);
router.post('/login', globalIpLimiter, ...loginLimiter, validate(authSchemas.login), login);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, validate(authSchemas.changePassword), changePassword);
router.post('/forgot-password', globalIpLimiter, ...otpLimiter, validate(authSchemas.forgotPassword), forgotPassword);
router.post('/verify-reset-otp', globalIpLimiter, ...otpLimiter, validate(authSchemas.verifyResetOtp), verifyResetOTP);
router.post('/reset-password', globalIpLimiter, ...resetPasswordLimiter, validate(authSchemas.resetPassword), resetPassword);

module.exports = router;
