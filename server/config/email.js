const { Resend } = require('resend');
const logger = require('./logger');

const FROM_EMAIL = process.env.FROM_EMAIL;

let resendClient = null;

const getResendClient = () => {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is missing');
    }

    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
};

const validateEmailConfig = () => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is missing');
  }

  if (!FROM_EMAIL) {
    throw new Error(
      'FROM_EMAIL is missing. Use an email address from your verified Resend domain, for example: PlaceHub <noreply@updates.yourdomain.com>'
    );
  }
};

const validateRecipient = (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('A valid recipient email is required');
  }

  return normalizedEmail;
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeEmailPayload = ({ to, subject, html, text, type = 'notification' }) => {
  const normalizedEmail = validateRecipient(to);

  if (!subject || !html) {
    throw new Error('Email subject and html are required');
  }

  return {
    to: normalizedEmail,
    subject,
    html,
    text,
    type,
  };
};

const sendEmailDirect = async ({ to, subject, html, text, type = 'notification' }) => {
  validateEmailConfig();

  const normalizedEmail = validateRecipient(to);

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: normalizedEmail,
      subject,
      html,
      ...(text ? { text } : {}),
    });

    if (error) {
      throw new Error(error.message || 'Resend email send failed');
    }

    logger.info(`Email sent directly: type=${type} to=${normalizedEmail} id=${data?.id || 'unknown'}`);
    return { emailId: data?.id || null };
  } catch (err) {
    logger.error(`Email send failed: type=${type} to=${normalizedEmail} error=${err.message}`);
    throw err;
  }
};

const sendEmail = async (payload) => {
  const normalizedPayload = normalizeEmailPayload(payload);

  logger.info(`Sending email directly: type=${normalizedPayload.type} to=${normalizedPayload.to}`);
  return sendEmailDirect(normalizedPayload);
};

const buildOtpEmailHtml = (otp) => `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0f172a; margin-bottom: 8px;">Verify Your Email</h2>
        <p style="color: #64748b;">Use the OTP below to verify your PlaceHub account. This code expires in 5 minutes.</p>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">${otp}</span>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">If you did not request this, please ignore this email.</p>
      </div>
    `;

const buildPasswordResetEmailHtml = (otp) => `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0f172a; margin-bottom: 8px;">Reset Your Password</h2>
        <p style="color: #64748b;">Use the OTP below to reset your PlaceHub account password. This code expires in 5 minutes.</p>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">${otp}</span>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">If you did not request this, please ignore this email.</p>
      </div>
    `;


const buildStaffCredentialsEmail = ({
  email,
  temporaryPassword,
  isReset = false,
}) => {
  const subject = isReset
    ? 'PlaceHub - Staff Password Reset'
    : 'PlaceHub - Staff Account Credentials';
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(temporaryPassword);

  if (isReset) {
    return {
      to: email,
      subject,
      type: 'staff_reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">${escapeHtml(subject)}</h2>
          <p style="color: #0f172a;">Your PlaceHub staff account credentials are below.</p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0 0 8px; color: #334155;"><strong>Email: </strong> ${safeEmail}</p>
            <p style="margin: 0; color: #334155;"><strong>Temporary password: </strong> ${safePassword}</p>
          </div>
          <p style="color: #475569;">You must change this temporary password after signing in.</p>
          <p style="color: #475569; font-size: 13px;">If you were not expecting this email, contact your PlaceHub administrator.</p>
        </div>
      `,
    };
  }

  const loginUrl = process.env.PLACEHUB_LOGIN_URL || '';

  return {
    to: email,
    subject,
    type: 'staff_credentials',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0f172a; margin-bottom: 8px;">${escapeHtml(subject)}</h2>
        <p style="color: #0f172a;">Dear Staff Member,</p>
        <p style="color: #0f172a;">Your PlaceHub staff account credentials are below.</p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <p style="margin: 0 0 8px; color: #334155;"><strong>Email: </strong> ${safeEmail}</p>
          <p style="margin: 0; color: #334155;"><strong>Temporary password: </strong> ${safePassword}</p>
        </div>
        <div style="margin-bottom: 24px;">
          <p style="margin: 0 0 8px; color: #0f172a;"><strong>PlaceHub Login:</strong></p>
          <p style="margin: 0;"><a href="${loginUrl}" style="color: #2563eb; text-decoration: none;">${loginUrl}</a></p>
        </div>
        <p style="color: #475569;">You must change this temporary password after signing in.</p>
        <p style="color: #475569; font-size: 13px;">If you were not expecting this email, contact your PlaceHub administrator.</p>
      </div>
    `,
    text: `PlaceHub - Staff Account Credentials\n\nDear Staff Member,\n\nYour PlaceHub staff account credentials are below.\n\nEmail: ${email}\nTemporary password: ${temporaryPassword}\n\nPlaceHub Login:\n${loginUrl}\n\nYou must change this temporary password after signing in.\n\nIf you were not expecting this email, contact your PlaceHub administrator.`,
  };
};

const buildHrCredentialsEmail = ({
  deliveryEmail,
  username,
  temporaryPassword,
  companyName,
  jobTitle,
  isReset = false,
}) => {
  const subject = isReset
    ? 'PlaceHub - HR Password Reset'
    : 'PlaceHub - HR Account Credentials';
  const safeUsername = escapeHtml(username);
  const safePassword = escapeHtml(temporaryPassword);

  if (isReset) {
    return {
      to: deliveryEmail,
      subject,
      type: 'hr_reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">${escapeHtml(subject)}</h2>
          <p style="color: #475569;">The HR account credentials are below.</p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0 0 8px; color: #334155;"><strong>Username: </strong> ${safeUsername}</p>
            <p style="margin: 0; color: #334155;"><strong>Temporary password: </strong> ${safePassword}</p>
          </div>
          <p style="color: #ef4444; font-weight: bold;">Please login and change your password immediately.</p>
          <p style="color: #475569; font-size: 13px;">If you were not expecting this email, contact your PlaceHub administrator.</p>
        </div>
      `,
    };
  }

  const loginUrl = process.env.PLACEHUB_LOGIN_URL || '';
  const safeCompanyName = escapeHtml(companyName);
  const safeJobTitle = escapeHtml(jobTitle);

  return {
    to: deliveryEmail,
    subject,
    type: 'hr_credentials',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0f172a; margin-bottom: 8px;">${escapeHtml(subject)}</h2>
        <p style="color: #0f172a;">Dear HR Representative,</p>
        <p style="color: #0f172a;">An HR account has been created for you on PlaceHub, Woxsen University's placement management platform.</p>
        
        <h3 style="color: #0f172a; margin-top: 24px; margin-bottom: 12px;">Assigned Job</h3>
        <p style="margin: 0 0 4px; color: #334155;"><strong>Company:</strong> ${safeCompanyName}</p>
        <p style="margin: 0 0 16px; color: #334155;"><strong>Job Title:</strong> ${safeJobTitle}</p>

        <h3 style="color: #0f172a; margin-top: 24px; margin-bottom: 12px;">Account Details</h3>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 0 0 24px 0;">
          <p style="margin: 0 0 8px; color: #334155;"><strong>Username: </strong> ${safeUsername}</p>
          <p style="margin: 0; color: #334155;"><strong>Temporary password: </strong> ${safePassword}</p>
        </div>
        <div style="margin-bottom: 24px;">
          <p style="margin: 0 0 8px; color: #475569;"><strong>PlaceHub Login:</strong></p>
          <p style="margin: 0;"><a href="${loginUrl}" style="color: #2563eb; text-decoration: none;">${loginUrl}</a></p>
        </div>
        <p style="color: #ef4444; font-weight: bold;">Please login and change your password immediately.</p>
        <p style="color: #475569; font-size: 13px;">If you were not expecting this email, contact your PlaceHub administrator.</p>
      </div>
    `,
    text: `PlaceHub - HR Account Credentials\n\nDear HR Representative,\n\nAn HR account has been created for you on PlaceHub, Woxsen University's placement management platform.\n\nAssigned Job\n\nCompany: ${companyName}\nPosition: ${jobTitle}\n\nAccount Details\n\nUsername: ${username}\nTemporary password: ${temporaryPassword}\n\nPlaceHub Login:\n${loginUrl}\n\nPlease login and change your password immediately.\n\nIf you were not expecting this email, contact your PlaceHub administrator.`,
  };
};

const sendOTPEmail = async (email, otp) =>
  sendEmail({
    to: email,
    subject: 'PlaceHub - Email Verification OTP',
    type: 'otp',
    html: buildOtpEmailHtml(otp),
  });


const sendPasswordResetOTP = async (email, otp) =>
  sendEmail({
    to: email,
    subject: 'PlaceHub - Password Reset OTP',
    type: 'reset',
    html: buildPasswordResetEmailHtml(otp),
  });

const sendStaffCredentialsEmail = async (options) =>
  sendEmail(buildStaffCredentialsEmail(options));

const sendHrCredentialsEmail = async (options) =>
  sendEmail(buildHrCredentialsEmail(options));

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendPasswordResetOTP,
  sendHrCredentialsEmail,
  sendStaffCredentialsEmail,
};
