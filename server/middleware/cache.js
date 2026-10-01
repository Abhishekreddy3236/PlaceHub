// SAFE NO-OP VERSION (Redis removed)

const blacklistToken = async () => {
  // no-op
};

const isTokenBlacklisted = async () => {
  return false;
};

module.exports = {
  blacklistToken,
  isTokenBlacklisted,
};
