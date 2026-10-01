const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const BlockedUser = require('../models/BlockedUser');
const Config = require('../models/Config');
const RegistrationChallenge = require('../models/RegistrationChallenge');
const PushSubscription = require('../models/PushSubscription');
const { sendOTPEmail, sendPasswordResetOTP } = require('../config/email');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { createAuditLog } = require('../utils/audit');
const { successResponse } = require('../utils/response');
const { serializeUser } = require('../utils/serializers');
const {
  REFRESH_COOKIE_NAME,
  clearRefreshTokenCookie,
  generateTokenId,
  setRefreshTokenCookie,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require('../utils/tokens');
const {
  blacklistToken,
  isTokenBlacklisted,
} = require('../middleware/cache');
const { validateEmailWithConfig } = require('../utils/emailValidation');
const { getAllowedYears } = require('../utils/constants');
const { isWhitelistedDb } = require('../services/whitelistDbService');

const ADMIN_RESET_EMAIL = process.env.ADMIN_RESET_EMAIL;

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const REGISTRATION_VERIFIED_TTL_MS = 30 * 60 * 1000;

const generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
const getOtpExpiry = () => new Date(Date.now() + OTP_TTL_MS);

const hashOtp = (otp) => bcrypt.hash(otp, 12);

const otpMatches = async ({ otp, otpHash }) => {
  if (otpHash) {
    return bcrypt.compare(otp, otpHash);
  }

  return false;
};

const validateResetOTP = async (user, otp) => {
  const expiresAt = user.resetOTPExpiresAt;

  if (!expiresAt || expiresAt < new Date() || !user.resetOTPHash) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      $or: [
        { resetOtpAttempts: { $lt: 5 } },
        { resetOtpAttempts: { $exists: false } }
      ]
    },
    {
      $inc: { resetOtpAttempts: 1 }
    },
    {
      new: true
    }
  );

  if (!updated) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  const isMatch = await otpMatches({
    otp,
    otpHash: updated.resetOTPHash,
  });

  if (!isMatch) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  return true;
};

const getIdentifierFromBody = (body = {}) =>
  String(body.identifier || body.email || body.username || '')
    .trim()
    .toLowerCase();

const normalizeEmail = (email) => {
  return String(email || '').trim().toLowerCase();
};

const { canonicalizeEmail } = require('../utils/emailCanonicalization');

const normalizeEmailStrict = (email) => {
  return canonicalizeEmail(email);
};

async function validatePreOtpBasic(email, config) {
  return validateEmailWithConfig(email, config);
}

const findUserForLogin = async (identifier) => {
  const emailLookup = await User.findOne({ email: identifier })
    .setOptions({ withDeleted: true })
    .populate('companyId', 'name normalizedName slug');

  if (emailLookup) {
    return emailLookup;
  }

  return User.findOne({ username: identifier })
    .setOptions({ withDeleted: true })
    .populate('companyId', 'name normalizedName slug');
};

const extractUserIdFromToken = (token, secret) => {
  try {
    // Try full verification first
    const verified = jwt.verify(token, secret);
    return verified?.userId || null;
  } catch (err) {
    // If expired → fallback to decode
    if (err.name === 'TokenExpiredError') {
      const decoded = jwt.decode(token);
      return decoded?.userId || null;
    }
    // Invalid signature → reject completely
    return null;
  }
};

const getRefreshTokenFromRequest = (req) => req.cookies?.[REFRESH_COOKIE_NAME];

const blacklistRefreshTokenId = async (payload) => {
  if (!payload?.jti || !payload?.exp) {
    return;
  }

  const ttlSeconds = Math.max(payload.exp - Math.floor(Date.now() / 1000), 1);

  try {
    await blacklistToken(payload.jti, ttlSeconds);
  } catch (error) {
    logger.warn(`refresh-token:blacklist-skipped error=${error.message}`);
  }
};

const issueAuthSession = async (user, res) => {
  const accessToken = signAccessToken(user);
  const refreshTokenId = generateTokenId();
  const refreshToken = signRefreshToken(user, refreshTokenId);

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  setRefreshTokenCookie(res, refreshToken);

  return accessToken;
};

const revokeRefreshToken = async (req, res) => {
  const refreshToken = getRefreshTokenFromRequest(req);

  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);

      await blacklistRefreshTokenId(payload);
    } catch (error) {
      // Ignore token parsing failures during logout.
    }
  }

  clearRefreshTokenCookie(res);
  const isProd = process.env.NODE_ENV === 'production';

  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/'
  });
};

exports.requestRegistrationOtp = asyncHandler(async (req, res) => {
  const rawEmail = normalizeEmail(req.body?.email);
  const config = await Config.getGlobalConfig();

  if (config.registrationEnabled === false) {
    throw new AppError('Registrations are currently disabled', 403);
  }

  let { normalized: normalizedEmail } = await validatePreOtpBasic(rawEmail, config);
  normalizedEmail = normalizeEmailStrict(normalizedEmail);

  if (config?.whitelistEnabled) {
    const dbAllowed = await isWhitelistedDb(normalizedEmail);

    if (!dbAllowed) {
      throw new AppError('Email is not authorized for registration', 403);
    }
  }

  const isBlocked = await BlockedUser.findOne({ email: normalizedEmail, isBlocked: true });
  if (isBlocked) {
    throw new AppError('This email is blocked from registration', 403);
  }

  const existingVerified = await User.findOne({ email: normalizedEmail, isVerified: true }).setOptions({
    withDeleted: true,
  });
  if (existingVerified) {
    throw new AppError('Email already registered', 400);
  }

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const otpExpiresAt = getOtpExpiry();

  const existingChallenge = await RegistrationChallenge.findOne({ email: normalizedEmail }).lean();
  const verifiedAt = existingChallenge?.verifiedAt
    ? new Date(existingChallenge.verifiedAt)
    : null;
  const shouldResetVerification =
    !verifiedAt || Date.now() - verifiedAt.getTime() > REGISTRATION_VERIFIED_TTL_MS;

  const update = {
    $set: {
      email: normalizedEmail,
      otpHash,
      otpExpiresAt,
      verifyAttempts: 0,
      attemptCount: 0,
    },
  };

  if (shouldResetVerification) {
    update.$set.verifiedAt = null;
  }

  await RegistrationChallenge.findOneAndUpdate(
    { email: normalizedEmail },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  try {
    await sendOTPEmail(normalizedEmail, otp);
  } catch (err) {
    logger.error(`registration-otp:send-failed error=${err.message}`);
    throw new AppError('Failed to send OTP email', 500);
  }

  successResponse(res, {
    message: 'OTP sent to your email',
  });
});

exports.register = asyncHandler(async (req, res) => {
  const { name, password, school, rollNumber, admissionId } = req.body;
  const rawEmail = normalizeEmail(req.body?.email);
  const config = await Config.getGlobalConfig();

  if (config.registrationEnabled === false) {
    throw new AppError('Registrations are currently disabled', 403);
  }

  let { normalized: normalizedEmail, year: extractedYear } = await validatePreOtpBasic(rawEmail, config);
  normalizedEmail = normalizeEmailStrict(normalizedEmail);

  if (config?.whitelistEnabled) {
    const dbAllowed = await isWhitelistedDb(normalizedEmail);

    if (!dbAllowed) {
      throw new AppError('Email is not authorized for registration', 403);
    }
  }

  const challenge = await RegistrationChallenge.findOne({ email: normalizedEmail });
  if (!challenge?.verifiedAt) {
    throw new AppError('Verify your email OTP before registering', 403);
  }

  if (Date.now() - challenge.verifiedAt.getTime() > REGISTRATION_VERIFIED_TTL_MS) {
    throw new AppError('Email verification expired. Request a new OTP.', 403);
  }

  const normalizedSchool = String(school || '').trim();
  const normalizedRollNumber = String(rollNumber || '').trim();
  const normalizedAdmissionId = String(admissionId || '').trim();

  if (!normalizedSchool) {
    throw new AppError('School is required', 400);
  }

  if (!normalizedRollNumber) {
    throw new AppError('Roll number is required', 400);
  }

  if (!normalizedAdmissionId) {
    throw new AppError('Admission ID is required', 400);
  }

  const year = Number(String(req.body.graduationYear).trim());

  if (isNaN(year)) {
    throw new AppError("Invalid graduation year", 400);
  }

  const allowedYears = getAllowedYears();

  if (!allowedYears.includes(year)) {
    throw new AppError("Invalid graduation year", 400);
  }

  if (config.yearRestrictionEnabled) {
    if (!extractedYear || Number(extractedYear) !== year) {
      throw new AppError(
        "Graduation year does not match the year in your email",
        400
      );
    }
  }

  // assign AFTER validation
  req.body.graduationYear = year;
  const normalizedGraduationYear = year;

  const isBlocked = await BlockedUser.findOne({ email: normalizedEmail, isBlocked: true });
  if (isBlocked) {
    throw new AppError('This email is blocked from registration', 403);
  }

  let user = await User.findOne({ email: normalizedEmail }).setOptions({ withDeleted: true });

  const admissionOwner = await User.findOne({ admissionId: normalizedAdmissionId }).setOptions({
    withDeleted: true,
  });

  if (admissionOwner && admissionOwner._id.toString() !== user?._id?.toString()) {
    throw new AppError('Admission ID already registered', 400);
  }

  if (user && user.isVerified) {
    throw new AppError('Email already registered', 400);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  if (user && !user.isVerified) {
    user.name = name.trim();
    user.email = normalizedEmail;
    user.password = hashedPassword;
    user.role = 'student';
    user.school = normalizedSchool;
    user.rollNumber = normalizedRollNumber;
    user.admissionId = normalizedAdmissionId;
    user.graduationYear = normalizedGraduationYear;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    user.isVerified = true;
    user.isActive = true;
    user.isDeleted = false;
    await user.save();
  } else {
    user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'student',
      school: normalizedSchool,
      rollNumber: normalizedRollNumber,
      admissionId: normalizedAdmissionId,
      graduationYear: normalizedGraduationYear,
      isVerified: true,
    });
  }

  await RegistrationChallenge.deleteOne({ email: normalizedEmail });

  successResponse(res, {
    statusCode: 201,
    message: 'Registration successful. You can now login.',
  });
});

exports.registerStudent = exports.register;

exports.getRegistrationStatus = asyncHandler(async (req, res) => {
  const config = await Config.getGlobalConfig();

  successResponse(res, {
    data: {
      registrationEnabled: config.registrationEnabled === true,
    }
  });
});

exports.verifyOTP = asyncHandler(async (req, res) => {
  if (!req.body.email) {
    throw new AppError("Email is required for verification", 400);
  }

  const { otp } = req.body;
  const rawEmail = String(req.body?.email || '').trim();
  const config = await Config.getGlobalConfig();

  const { normalized: normalizedEmail } = validateEmailWithConfig(rawEmail, config);

  const challenge = await RegistrationChallenge.findOne({ email: normalizedEmail });

  if (!challenge) {
    throw new AppError('No pending verification for this email', 404);
  }



  const expiresAt = challenge.otpExpiresAt;

  if (!expiresAt || expiresAt < new Date()) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  const updated = await RegistrationChallenge.findOneAndUpdate(
    {
      _id: challenge._id,
      attemptCount: { $lt: 5 },
      verifyAttempts: { $lt: OTP_MAX_VERIFY_ATTEMPTS }
    },
    {
      $inc: { attemptCount: 1, verifyAttempts: 1 }
    },
    {
      new: true
    }
  );

  if (!updated) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  const isMatch = await otpMatches({
    otp,
    otpHash: updated.otpHash,
    legacyOtp: null,
  });

  if (!isMatch) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  updated.attemptCount = 0;
  updated.verifiedAt = new Date();
  updated.verifyAttempts = 0;
  updated.otpHash = null;
  updated.otpExpiresAt = null;
  await updated.save();

  successResponse(res, {
    message: 'Email OTP verified. You can complete registration.',
  });
});

exports.login = asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier || '').trim().toLowerCase();
  const { password, role: expectedRole } = req.body;

  if (!identifier || !password) {
    throw new AppError("Email/Username and password required", 400);
  }

  const user = await User.findOne({
    $or: [
      { email: identifier },
      { username: identifier }
    ]
  })
    .select('+password')
    .setOptions({ withDeleted: true })
    .populate('companyId', 'name normalizedName slug');

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  // Optional role validation
  if (expectedRole && user.role !== expectedRole) {
    throw new AppError("Invalid credentials", 401);
  }

  if (user.isDeleted) {
    throw new AppError('Invalid credentials', 401);
  }

  if (user.isActive === false) {
    throw new AppError('Account is blocked. Please contact the administrator.', 403);
  }

  if ((user.role === 'student' || user.role === 'admin') && !user.isVerified) {
    throw new AppError('Invalid credentials', 401);
  }

  if (!user.password) {
    throw new AppError("Invalid credentials", 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  if (user.role === 'student' && (!user.school || user.school.trim() === '')) {
    user.school = 'B. Tech';
    await user.save({ validateBeforeSave: false });
  }

  const accessToken = await issueAuthSession(user, res);

  await createAuditLog({
    action: 'LOGIN',
    req,
    performedBy: user._id,
    targetId: user._id,
    metadata: {
      role: user.role,
      companyId: user.companyId?._id || user.companyId || null,
    },
  });

  successResponse(res, {
    message: 'Login successful',
    data: {
      accessToken,
      user: serializeUser(user, { includeCompany: true }),
      mustChangePassword: user.mustChangePassword,
    },
  });
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const refreshToken = getRefreshTokenFromRequest(req);

  if (!refreshToken) {
    throw new AppError('Invalid refresh token', 401);
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new AppError('Invalid refresh token', 401);
  }

  if (!payload || payload.type !== 'refresh') {
    throw new AppError('Invalid refresh token', 401);
  }

  let blacklisted = false;
  try {
    blacklisted = await isTokenBlacklisted(payload.jti);
  } catch (error) {
    logger.warn(`refresh-token:blacklist-check-skipped error=${error.message}`);
  }

  if (blacklisted) {
    throw new AppError('Invalid refresh token', 401);
  }

  const user = await User.findById(payload.userId)
    .setOptions({ withDeleted: true })
    .populate('companyId', 'name normalizedName slug');

  if (!user || user.isDeleted || user.isActive === false) {
    throw new AppError('Invalid refresh token', 401);
  }

  const decodedTokenVersion = Number(payload.tokenVersion || 0);
  const currentTokenVersion = Number(user.tokenVersion || 0);

  if (decodedTokenVersion !== currentTokenVersion) {
    throw new AppError('Session expired. Please login again.', 401);
  }

  await blacklistRefreshTokenId(payload);

  const accessToken = await issueAuthSession(user, res);

  return successResponse(res, {
    data: {
      accessToken,
      user: serializeUser(user, { includeCompany: true })
    }
  });
});

exports.logout = asyncHandler(async (req, res) => {
  let userId = null;

  // Refresh token
  const refreshToken = getRefreshTokenFromRequest(req);
  if (refreshToken) {
    userId = extractUserIdFromToken(refreshToken, process.env.JWT_REFRESH_SECRET);
  }

  // Access token fallback
  if (!userId) {
    const authHeader = req.headers?.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      userId = extractUserIdFromToken(
        authHeader.split(' ')[1],
        process.env.JWT_ACCESS_SECRET
      );
    }
  }

  // req.user fallback
  if (!userId && req.user?._id) {
    userId = req.user._id;
  }

  // 4. ALWAYS increment tokenVersion if we identified the user
  if (userId) {
    try {
      await User.findByIdAndUpdate(userId, {
        $inc: { tokenVersion: 1 },
      });
      
      await PushSubscription.updateMany(
        { userId },
        { 
          $set: { 
            isActive: false, 
            inactiveAt: new Date() 
          } 
        }
      );
    } catch (_) {
      // DB error must not prevent cookie cleanup
    }
  }

  // 5. Always revoke refresh token and clear cookies
  try {
    await revokeRefreshToken(req, res);
  } catch (_) {
    // Ensure cookie is cleared even if revoke fails
    clearRefreshTokenCookie(res);
  }

  successResponse(res, {
    message: 'Logged out successfully',
  });
});

exports.getMe = asyncHandler(async (req, res) => {
  let user = await User.findById(req.user._id)
    .setOptions({ withDeleted: true })
    .populate('companyId', 'name normalizedName slug')
    .populate('jobId', 'title companyId')
    .lean();

  if (!user || user.isDeleted) {
    throw new AppError('User not found', 404);
  }

  if (user.isActive === false) {
    throw new AppError('Account is blocked', 403);
  }

  if (user.role === 'student' && (!user.school || user.school.trim() === '')) {
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: { school: 'B. Tech' } },
      { new: true, runValidators: true }
    )
      .populate('companyId', 'name normalizedName slug')
      .populate('jobId', 'title companyId')
      .lean();

    user = updatedUser || { ...user, school: 'B. Tech' };
  }

  successResponse(res, {
    data: {
      user: serializeUser(user, { includeCompany: true })
    }
  });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const identifier = getIdentifierFromBody(req.body);
  const user = await findUserForLogin(identifier);

  if (!user || user.isDeleted) {
    throw new AppError('Invalid credentials', 401);
  }

  if (user.isActive === false) {
    throw new AppError('Account is blocked. Please contact the administrator.', 403);
  }

  if ((user.role === 'student' || user.role === 'admin') && !user.isVerified) {
    throw new AppError('Please verify your email first', 400);
  }

  if (!user.email && user.role === 'hr') {
    throw new AppError('HR account does not have a recovery email configured', 400);
  }

  const otp = generateOtp();
  user.resetOTPHash = await hashOtp(otp);
  user.resetOTPExpiresAt = getOtpExpiry();
  user.resetOtpAttempts = 0;
  user.markModified('resetOtpAttempts');
  await user.save({ validateBeforeSave: false });

  const targetEmail = user.role === 'admin' ? ADMIN_RESET_EMAIL : user.email;

  try {
    await sendPasswordResetOTP(targetEmail, otp);
  } catch (err) {
    logger.error(`password-reset-otp:send-failed error=${err.message}`);
    throw new AppError('Failed to send password reset OTP email', 500);
  }

  let maskedEmail = '';
  if (user.role === 'admin') {
    const [local, domain] = ADMIN_RESET_EMAIL.split('@');
    maskedEmail = `${local.slice(0, 3)}${'*'.repeat(Math.max(local.length - 3, 1))}@${domain}`;
  }

  successResponse(res, {
    message: 'Password reset OTP email scheduled successfully',
    data: maskedEmail ? { maskedEmail } : {},
  });
});

exports.verifyResetOTP = asyncHandler(async (req, res) => {
  if (!req.body.email) {
    throw new AppError("Email is required for verification", 400);
  }

  const identifier = getIdentifierFromBody(req.body);
  const { otp } = req.body;
  const user = await findUserForLogin(identifier);

  if (!user || user.isDeleted) {
    throw new AppError('User not found', 404);
  }

  await validateResetOTP(user, otp);

  user.resetOtpAttempts = 0;
  user.markModified('resetOtpAttempts');
  await user.save({ validateBeforeSave: false });

  successResponse(res, {
    message: 'OTP verified successfully',
  });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  if (!req.body.email) {
    throw new AppError("Email required for password reset", 400);
  }

  const identifier = getIdentifierFromBody(req.body);
  const { otp, password } = req.body;
  const user = await findUserForLogin(identifier);

  if (!user || user.isDeleted) {
    throw new AppError('User not found', 404);
  }

  if (!otp) {
    throw new AppError("OTP is required for password reset", 400);
  }

  await validateResetOTP(user, otp);

  user.password = await bcrypt.hash(password, 12);
  user.resetOTPHash = undefined;
  user.resetOTPExpiresAt = undefined;
  user.resetOtpAttempts = 0;
  user.markModified('resetOtpAttempts');
  user.mustChangePassword = false;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  try {
    await PushSubscription.updateMany(
      { userId: user._id },
      { $set: { isActive: false, inactiveAt: new Date() } }
    );
  } catch (error) {
    logger.error(`push-subscription:deactivate-failed error=${error.message}`);
  }

  return successResponse(res, {
    message: "Password changed successfully. Please login again."
  });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id)
    .select('+password')
    .populate('companyId', 'name normalizedName slug');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400);
  }

  user.password = await bcrypt.hash(newPassword, 12);
  user.mustChangePassword = false;
  user.resetOTPHash = undefined;
  user.resetOTPExpiresAt = undefined;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  try {
    await PushSubscription.updateMany(
      { userId: user._id },
      { $set: { isActive: false, inactiveAt: new Date() } }
    );
  } catch (error) {
    logger.error(`push-subscription:deactivate-failed error=${error.message}`);
  }

  return successResponse(res, {
    message: "Password changed successfully. Please login again."
  });
});
