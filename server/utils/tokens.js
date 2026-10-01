const crypto = require('crypto');
const jwt = require('jsonwebtoken');


const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || 'placehub_refresh_token';

const getAccessSecret = () => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured');
  return secret;
};

const getRefreshSecret = () => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not configured');
  return secret;
};

const hashToken = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex');

const generateTokenId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');

const signAccessToken = (user) => {
  const companyId = user.companyId?._id ?? user.companyId ?? null;
  const jobId = user.jobId?._id ?? user.jobId ?? null;

  const payload = {
    userId: user._id,
    role: user.role,
    companyId,
    type: 'access',
    tokenVersion: user.tokenVersion || 0,
    mustChangePassword: Boolean(user.mustChangePassword),
  };

  if (user.role === 'hr') {
    payload.jobId = jobId;
  }

  if (user.role === 'staff') {
    payload.permissions = {
      users: user.permissions?.users || 'read',
      jobs: user.permissions?.jobs || 'read',
      applications: user.permissions?.applications || 'read',
      accessControl: user.permissions?.accessControl || 'none',
      settings: user.permissions?.settings || 'none',
    };
  }

  if (user.role === 'student') {
    const school = user.school && String(user.school).trim() !== '' ? user.school : 'B. Tech';
    payload.school = school;
  }

  return jwt.sign(payload, getAccessSecret(), { expiresIn: ACCESS_TOKEN_TTL });
};

const signRefreshToken = (user, tokenId) =>
  jwt.sign(
    {
      userId: user._id,
      role: user.role,
      companyId: user.companyId?._id ?? user.companyId ?? null,
      type: 'refresh',
      tokenVersion: user.tokenVersion || 0,
      jti: tokenId,
    },
    getRefreshSecret(),
    { expiresIn: REFRESH_TOKEN_TTL }
  );

const verifyAccessToken = (token) => jwt.verify(token, getAccessSecret());

const verifyRefreshToken = (token) => jwt.verify(token, getRefreshSecret());

const decodeTokenWithoutVerification = (token) => jwt.decode(token);

const parseExpiryToMs = (expiryValue) => {
  if (typeof expiryValue === 'number') {
    return expiryValue * 1000;
  }

  const match = /^(\d+)([smhd])$/i.exec(String(expiryValue));
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const value = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const unitMap = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * unitMap[unit];
};

const getRefreshCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: parseExpiryToMs(REFRESH_TOKEN_TTL)
  };
};

const setRefreshTokenCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions());
};

const clearRefreshTokenCookie = (res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/'
  });
};

module.exports = {
  ACCESS_TOKEN_TTL,
  REFRESH_COOKIE_NAME,
  clearRefreshTokenCookie,
  decodeTokenWithoutVerification,
  generateTokenId,
  getRefreshCookieOptions,
  hashToken,
  parseExpiryToMs,
  setRefreshTokenCookie,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
