const AppError = require('./AppError');

const normalizeDomain = (value) =>
  String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/^@/, '');

const validateEmailWithConfig = (email, config) => {
  const yearEnabled = config?.yearRestrictionEnabled === true;
  const domainEnabled = config?.domainRestrictionEnabled === true;

  let cleanEmail = String(email ?? '').trim().toLowerCase();

  if (cleanEmail.startsWith('mailto:')) {
    cleanEmail = cleanEmail.slice(7).trim();
  }


  const atIndex = cleanEmail.indexOf('@');

  if (atIndex === -1 || cleanEmail.indexOf('@', atIndex + 1) !== -1) {
    throw new AppError('Invalid email format', 400);
  }

  const localPart = cleanEmail.slice(0, atIndex).trim();
  const domain = normalizeDomain(cleanEmail.slice(atIndex + 1));

  if (!localPart || !domain) {
    throw new AppError('Invalid email format', 400);
  }

  const normalized = `${localPart}@${domain}`;

  // DOMAIN VALIDATION
  if (domainEnabled) {
    const allowedDomains = (config.allowedDomains || [])
      .map(normalizeDomain)
      .filter(Boolean);

    if (!allowedDomains.includes(domain)) {
      throw new AppError('Please use an approved email domain.', 403);
    }
  }

  let year = null;

  if (yearEnabled) {
    const match = localPart.match(/_(\d{4})$/);

    if (!match) {
      throw new AppError(
        "Email must include your graduation year",
        400
      );
    }

    year = match[1];

    const allowedYearsRaw =
      config?.allowedGraduationYears ?? config?.allowedYears ?? [];

    const allowedYears = Array.isArray(allowedYearsRaw)
      ? allowedYearsRaw.map((y) => String(y).trim())
      : [];

    if (allowedYears.length && !allowedYears.includes(year)) {
      throw new AppError("Your graduation year is not eligible for registration.", 403);
    }
  }

  return { normalized, localPart, domain, year };
};

module.exports = { validateEmailWithConfig, normalizeDomain };