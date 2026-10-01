const canonicalizeEmail = (email) => {
  return String(email || '')
    .replace(/[\uFEFF\u200B-\u200D\u2060]/g, '') // remove invisible chars
    .trim()
    .toLowerCase();
};

module.exports = { canonicalizeEmail };
