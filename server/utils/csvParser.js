const { canonicalizeEmail } = require('./emailCanonicalization');

const parseCsvEmails = (input) => {
  if (!input) return [];
  
  const content = Buffer.isBuffer(input) ? input.toString('utf8') : String(input);
  const lines = content.split(/\r?\n/);
  
  const emails = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  for (const line of lines) {
    const clean = canonicalizeEmail(line);
    
    if (clean && emailRegex.test(clean)) {
      emails.push(clean);
    }
  }
  
  return emails;
};

module.exports = {
  parseCsvEmails
};
