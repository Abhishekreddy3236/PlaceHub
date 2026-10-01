const mongoose = require('mongoose');
const { normalizeDomain } = require('../utils/emailValidation');

const GLOBAL_CONFIG_ID = 'global_config';

const hostnameHasNoSpacesOrStars = (hostname) =>
  hostname.length >= 2 && !hostname.includes(' ') && !hostname.includes('*');


const normalizeAllowedDomains = (domains = []) => {
  if (!Array.isArray(domains)) {
    throw new Error('Allowed domains must be an array');
  }

  const normalized = [];
  const seen = new Set();

  domains.forEach((domain) => {
    const normalizedDomain = normalizeDomain(domain);

    if (!normalizedDomain) {
      return;
    }

    if (!hostnameHasNoSpacesOrStars(normalizedDomain)) {
      throw new Error(
        'Domains must be hostnames only (e.g. gmail.com), lowercase, and contain no spaces or wildcards'
      );
    }

    if (!seen.has(normalizedDomain)) {
      seen.add(normalizedDomain);
      normalized.push(normalizedDomain);
    }
  });

  if (normalized.length > 20) {
    throw new Error('Max 20 domains');
  }

  return normalized;
};

const sanitizeAllowedDomainsForRead = (domains) => {
  if (!Array.isArray(domains)) {
    return [];
  }

  const out = [];
  const seen = new Set();

  domains.forEach((domain) => {
    const s = normalizeDomain(domain);
    if (!s || !hostnameHasNoSpacesOrStars(s) || seen.has(s)) {
      return;
    }
    seen.add(s);
    out.push(s);
  });

  return out;
};

const normalizeAllowedYears = (years = []) => {
  if (!Array.isArray(years)) {
    throw new Error('Allowed years must be an array');
  }

  if (years.length > 10) {
    throw new Error('Max 10 years');
  }

  const normalized = [];
  const seen = new Set();

  years.forEach((year) => {
    const normalizedYear = String(year ?? '').trim();

    if (!normalizedYear) {
      return;
    }

    if (seen.has(normalizedYear)) {
      return;
    }

    seen.add(normalizedYear);
    normalized.push(normalizedYear);
  });

  return normalized;
};

const toPlainConfig = (config) => ({
  _id: config._id,
  whitelistEnabled: config.whitelistEnabled === true,
  registrationEnabled: config.registrationEnabled !== false,
  domainRestrictionEnabled: config.domainRestrictionEnabled === true,
  yearRestrictionEnabled: config.yearRestrictionEnabled === true,
  allowedDomains: sanitizeAllowedDomainsForRead(
    Array.isArray(config.allowedDomains) ? config.allowedDomains : []
  ),
  allowedYears: Array.isArray(config.allowedYears)
    ? config.allowedYears.map((y) => String(y).trim()).filter(Boolean)
    : [],
  updatedAt: config.updatedAt,
});

const configSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: GLOBAL_CONFIG_ID,
    },
    whitelistEnabled: {
      type: Boolean,
      default: false,
    },
    registrationEnabled: {
      type: Boolean,
      default: true,
    },
    domainRestrictionEnabled: {
      type: Boolean,
      default: false,
    },
    allowedDomains: {
      type: [String],
      default: [],
      validate: [(arr) => arr.length <= 20, 'Max 20 domains'],
    },
    yearRestrictionEnabled: {
      type: Boolean,
      default: false,
    },
    allowedYears: {
      type: [String],
      default: [],
      validate: [(arr) => arr.length <= 10, 'Max 10 years'],
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'configs' }
);

configSchema.pre('validate', function normalizeConfig(next) {
  try {
    if (Array.isArray(this.allowedDomains)) {
      this.allowedDomains = normalizeAllowedDomains(this.allowedDomains);
    }
    if (Array.isArray(this.allowedYears)) {
      this.allowedYears = normalizeAllowedYears(this.allowedYears);
    }

    if (this.domainRestrictionEnabled === true && this.allowedDomains.length === 0) {
      throw new Error('At least one allowed domain is required when domain restriction is enabled');
    }

    this.updatedAt = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

configSchema.statics.normalizeAllowedDomains = normalizeAllowedDomains;
configSchema.statics.normalizeAllowedYears = normalizeAllowedYears;

configSchema.statics.setGlobalConfigCache = function setGlobalConfigCache(config) {
  return toPlainConfig(config);
};

configSchema.statics.clearGlobalConfigCache = function clearGlobalConfigCache() {
  return;
};

configSchema.statics.migrateAllowedDomainsIfNeeded = async function migrateAllowedDomainsIfNeeded() {
  const doc = await this.findById(GLOBAL_CONFIG_ID).lean();
  if (!doc?.allowedDomains?.length) {
    return;
  }

  let migrated;
  try {
    migrated = normalizeAllowedDomains(doc.allowedDomains);
  } catch {
    migrated = sanitizeAllowedDomainsForRead(doc.allowedDomains);
  }

  if (JSON.stringify(doc.allowedDomains) !== JSON.stringify(migrated)) {
    await this.updateOne(
      { _id: GLOBAL_CONFIG_ID },
      { $set: { allowedDomains: migrated, updatedAt: new Date() } }
    );
    this.clearGlobalConfigCache();
  }
};

configSchema.statics.migrateRegistrationBooleansIfNeeded = async function migrateRegistrationBooleansIfNeeded() {
  const doc = await this.findById(GLOBAL_CONFIG_ID).lean();
  if (!doc) {
    return;
  }

  const coerce = (value) => {
    if (value === true) return true;
    if (value === false) return false;
    if (value === 'true' || value === 1) return true;
    if (value === 'false' || value === 0 || value === '' || value == null) return false;
    return false;
  };

  const nextDomain = coerce(doc.domainRestrictionEnabled);
  const nextYear = coerce(doc.yearRestrictionEnabled);

  const domainDirty =
    typeof doc.domainRestrictionEnabled !== 'boolean' || doc.domainRestrictionEnabled !== nextDomain;
  const yearDirty =
    typeof doc.yearRestrictionEnabled !== 'boolean' || doc.yearRestrictionEnabled !== nextYear;

  if (!domainDirty && !yearDirty) {
    return;
  }

  await this.updateOne(
    { _id: GLOBAL_CONFIG_ID },
    {
      $set: {
        domainRestrictionEnabled: nextDomain,
        yearRestrictionEnabled: nextYear,
        updatedAt: new Date(),
      },
    }
  );
  this.clearGlobalConfigCache();
};

configSchema.statics.getGlobalConfig = async function getGlobalConfig() {
  let config = await this.findById(GLOBAL_CONFIG_ID).lean();

  if (!config) {
    config = await this.findOneAndUpdate(
      { _id: GLOBAL_CONFIG_ID },
      {
        $setOnInsert: {
          whitelistEnabled: false,
          registrationEnabled: true,
          domainRestrictionEnabled: false,
          yearRestrictionEnabled: false,
          allowedDomains: [],
          allowedYears: [],
        },
        $set: { updatedAt: new Date() },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).lean();
  }

  return this.setGlobalConfigCache(config);
};

/**
 * Full document upsert for admin. Persists strict booleans and normalized arrays.
 */
configSchema.statics.upsertGlobalConfig = async function upsertGlobalConfig() {
  throw new Error('Deprecated: Use configService.updateConfig');
};

configSchema.statics.updateGlobalConfig = async function updateGlobalConfig() {
  throw new Error('Deprecated: Use configService.updateConfig');
};

module.exports = mongoose.model('Config', configSchema);
