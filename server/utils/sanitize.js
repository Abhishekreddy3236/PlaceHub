const sanitizeHtml = require('sanitize-html');
const { decodeHTML } = require('entities');

const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;

const sanitizeMarkdown = (value) => {
  if (value === undefined || value === null) {
    return '';
  }

  let sanitized = sanitizeHtml(String(value).trim(), {
    allowedTags: [],
    allowedAttributes: {},
  });

  sanitized = decodeHTML(sanitized);

  sanitized = sanitized.replace(/\[([^\]]+)\]\(([\s\S]*?)\)(?=[^)]*(?:\[|$|\s))/g, (match, text, url) => {
    let cleanUrl = url.trim();
    try {
      cleanUrl = decodeURIComponent(cleanUrl);
    } catch (e) {}
    cleanUrl = cleanUrl.toLowerCase().trim();
    
    if (cleanUrl.startsWith('https://')) {
      return match;
    }
    if (cleanUrl.startsWith('www.')) {
      return match;
    }
    
    return `[${text}](#)`;
  });

  return sanitized;
};

const sanitizeText = (value, { maxLength = null } = {}) => {
  if (value === undefined || value === null) {
    return '';
  }

  let sanitized = sanitizeHtml(String(value), {
    allowedTags: [],
    allowedAttributes: {},
  });

  sanitized = decodeHTML(sanitized)
    .replace(CONTROL_CHARS_REGEX, '')
    .trim();

  if (maxLength !== null) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized;
};

const sanitizeEmail = (value) => sanitizeText(value, { maxLength: 254 }).toLowerCase();

const sanitizeMobileNumber = (value) => sanitizeText(value, { maxLength: 10 });

const sanitizeUrl = (value) => {
  const sanitized = sanitizeText(value, { maxLength: 2048 });
  if (!sanitized) {
    return '';
  }

  try {
    const parsed = new URL(sanitized);
    return parsed.href;
  } catch {
    return '';
  }
};

const sanitizeStringArray = (values = [], { maxItems = 50, maxLength = 80 } = {}) => {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set();
  const sanitizedValues = [];

  for (const value of values) {
    const sanitized = sanitizeText(value, { maxLength });
    const key = sanitized.toLowerCase();

    if (!sanitized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    sanitizedValues.push(sanitized);

    if (sanitizedValues.length >= maxItems) {
      break;
    }
  }

  return sanitizedValues;
};

module.exports = {
  sanitizeEmail,
  sanitizeMarkdown,
  sanitizeMobileNumber,
  sanitizeStringArray,
  sanitizeText,
  sanitizeUrl,
};
