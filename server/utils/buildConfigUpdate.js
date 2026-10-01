function parseCsvList(raw) {
  if (typeof raw !== 'string') return undefined;

  const parsed = raw
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);

  // allow clearing intentionally
  return [...new Set(parsed)];
}

function buildConfigUpdate(data) {
  const update = {};

  // Domains
  const domainsList = parseCsvList(data.allowedDomains);
  if (domainsList !== undefined) {
    update.allowedDomains = domainsList;
  }

  // Years
  const yearsList = parseCsvList(data.allowedYears);
  if (yearsList !== undefined) {
    update.allowedYears = yearsList;
  }

  // Booleans (STRICT)
  if (typeof data.whitelistEnabled === 'boolean') {
    update.whitelistEnabled = data.whitelistEnabled;
  }

  if (typeof data.registrationEnabled === 'boolean') {
    update.registrationEnabled = data.registrationEnabled;
  }

  if (typeof data.domainRestrictionEnabled === 'boolean') {
    update.domainRestrictionEnabled = data.domainRestrictionEnabled;
  }

  if (typeof data.yearRestrictionEnabled === 'boolean') {
    update.yearRestrictionEnabled = data.yearRestrictionEnabled;
  }

  return update;
}

module.exports = buildConfigUpdate;
