const { validateEmailWithConfig, normalizeDomain } = require('./emailValidation');

module.exports = {
  validateEmailWithConfig,
  normalizeDomainForComparison: normalizeDomain,
  normalizeDomainList: (domains) =>
    (Array.isArray(domains) ? domains : []).map(normalizeDomain).filter(Boolean),
};
