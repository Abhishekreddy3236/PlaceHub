const { z } = require('zod');
const { SCHOOLS, getAllowedYears } = require('../utils/constants');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const sixDigitOtpSchema = z
  .string()
  .trim()
  .length(6, 'OTP must be 6 digits')
  .refine(
    (value) => [...value].every((ch) => ch >= '0' && ch <= '9'),
    'OTP must be 6 digits'
  );

const registrationEmailSchema = z.string().trim().min(1, 'Email is required');

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{24}$/i, 'Invalid identifier');

const optionalNumber = (schema) =>
  z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? undefined : Number(value)),
    schema.optional()
  );

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const httpUrlSchema = z
  .string()
  .trim()
  .url('URL must be valid')
  .refine(isHttpUrl, 'URL must start with http:// or https://');

const identifierLookupSchema = z.object({
  identifier: z.string().trim().min(1).optional(),
  email: z.string().trim().min(1).optional(),
  username: z.string().trim().min(1).optional(),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Identifier is required'),
  password: z.string().trim().min(1, 'Password is required'),
});

const forgotPasswordSchema = identifierLookupSchema.refine(
  (value) => value.identifier || value.email || value.username,
  'Email or username is required'
);

const otpLookupSchema = identifierLookupSchema
  .extend({
    otp: sixDigitOtpSchema,
  })
  .refine(
    (value) => value.identifier || value.email || value.username,
    'Email or username is required'
  );

const resetPasswordSchema = identifierLookupSchema
  .extend({
    otp: sixDigitOtpSchema,
    password: passwordSchema,
  })
  .refine(
    (value) => value.identifier || value.email || value.username,
    'Email or username is required'
  );

const authSchemas = {
  changePassword: z.object({
    currentPassword: z.string().trim().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  }),
  forgotPassword: forgotPasswordSchema,
  login: loginSchema,
  registerStudent: z.object({
    name: z.string().trim().min(2, 'Name is required').max(100, 'Name is too long'),
    email: registrationEmailSchema,
    password: passwordSchema,
    school: z.string().trim().min(1, 'School is required'),
    rollNumber: z.string().trim().min(1, 'Roll number is required'),
    admissionId: z.string().trim().min(1, 'Admission ID is required'),
    graduationYear: z.union([
      z.string().regex(/^\d{4}$/, 'Graduation year must be 4 digits'),
      z.number()
    ]),
  }),
  resetPassword: resetPasswordSchema,
  verifyOtp: z.object({
    email: registrationEmailSchema,
    otp: sixDigitOtpSchema,
  }),
  verifyResetOtp: otpLookupSchema,
  requestRegistrationOtp: z.object({
    email: registrationEmailSchema,
  }),
};

const adminSchemas = {
  updateConfig: z.object({
    allowedDomains: z.union([z.array(z.string()), z.string()]).optional(),
    allowedYears: z.union([z.array(z.union([z.string(), z.number()])), z.string()]).optional(),
    whitelistEnabled: z.boolean().optional(),
    registrationEnabled: z.boolean().optional(),
    domainRestrictionEnabled: z.boolean().optional(),
    yearRestrictionEnabled: z.boolean().optional()
  }),
  createCompany: z.object({
    description: z.string().trim().max(500).optional(),
    name: z.string().trim().min(2, 'Company name is required').max(120),
    website: z.string().trim().url('Website must be a valid URL').optional().or(z.literal('')),
  }),
  createHr: z.object({
    jobId: objectIdSchema,
    email: z.string().trim().email('Valid email is required').optional().or(z.literal('')),
    name: z.string().trim().min(2, 'HR name is required').max(120),
    deliveryEmail: z.string().trim().email('Valid delivery email is required'),
  }),
  updateStudent: z
    .object({
      admissionId: z.string().trim().min(1, 'Admission ID is required').optional(),
      graduationYear: z.coerce.number().int().min(1900).max(3000).optional(),
      rollNumber: z.string().trim().min(1, 'Roll number is required').optional(),
      school: z.string().trim().min(1, 'School is required').optional(),
    })
    .refine(
      (value) =>
        value.school !== undefined ||
        value.graduationYear !== undefined ||
        value.rollNumber !== undefined ||
        value.admissionId !== undefined,
      'At least one field is required'
    ),
  updateAllowedYears: z.object({
    allowedYears: z.array(z.union([z.string(), z.number()])).default([]),
  }),
  exportStudents: z.object({
    schools: z.array(
      z.string().refine(val => SCHOOLS.includes(val), { message: 'Invalid school' })
    ).optional(),
    graduationYears: z.array(
      z.number().refine(val => getAllowedYears().includes(val), { message: 'Invalid graduation year' })
    ).optional(),
    selectedColumns: z.array(z.string()).optional(),
  }).strict(),
  exportJobs: z.object({
    schools: z.array(
      z.string().refine(val => SCHOOLS.includes(val), { message: 'Invalid school' })
    ).optional(),
    graduationYears: z.array(
      z.number().refine(val => getAllowedYears().includes(val), { message: 'Invalid graduation year' })
    ).optional(),
  }).strict(),
  exportApplications: z.object({
    schools: z.array(
      z.string().refine(val => SCHOOLS.includes(val), { message: 'Invalid school' })
    ).length(1, 'Please select exactly one school and graduation year before exporting.'),
    graduationYears: z.array(
      z.number().refine(val => getAllowedYears().includes(val), { message: 'Invalid graduation year' })
    ).length(1, 'Please select exactly one school and graduation year before exporting.'),
    status: z.enum(['in_progress', 'selected', 'rejected']).optional(),
    isAbsentOnly: z.boolean().optional(),
    includePersonalEmail: z.boolean().optional(),
    includeMobileNumber: z.boolean().optional(),
    includeSalary: z.boolean().optional(),
    includeLocation: z.boolean().optional(),
    includeAppliedDate: z.boolean().optional(),
  }).strict().refine(
    (data) => !(data.isAbsentOnly && data.status !== 'rejected'),
    { message: "Absent filter can only be applied when status is 'rejected'", path: ["isAbsentOnly"] }
  ),
};

const userSchemas = {
  updateProfile: z.object({
    age: optionalNumber(z.number().int().min(16).max(100)),
    branch: z.string().trim().max(120).optional(),
    cgpa: optionalNumber(z.number().min(0).max(10)),
    github: z.string().trim().url('GitHub must be a valid URL').optional().or(z.literal('')),
    gender: z.enum(['Male', 'Female', 'Other']).optional(),
    linkedin: z.string().trim().url('LinkedIn must be a valid URL').optional().or(z.literal('')),
    mobileNumber: z
      .string()
      .trim()
      .regex(/^[0-9]{10}$/, 'Mobile number must be 10 digits')
      .optional(),
    name: z.string().trim().min(2).max(100).optional(),
    personalEmail: z.string().trim().email('Personal email must be valid').optional(),
    portfolio: z.string().trim().url('Portfolio must be a valid URL').optional().or(z.literal('')),
    skills: z.array(z.string().trim().min(1)).max(50).optional(),
    tenthPercentage: optionalNumber(z.number().min(0).max(100)),
    twelfthPercentage: optionalNumber(z.number().min(0).max(100)),
  }),
  profileLink: z.object({
    heading: z.string().trim().min(1, 'Link heading is required').max(80, 'Link heading is too long'),
    url: httpUrlSchema,
  }),
  profileLinkParams: z.object({
    id: objectIdSchema,
  }),
};

const applicationSchemas = {
  apply: z.object({
    jobId: objectIdSchema,

  }),
  bulkUpdate: z.object({
    applicantIds: z
      .array(objectIdSchema)
      .min(1, 'At least one applicant ID is required')
      .max(30, 'Cannot update more than 30 applicants at once')
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Duplicate applicant IDs are not allowed',
      }),
    action: z.enum(['next_round', 'reject']),
    expectedRound: z.number().int().min(1).optional(),
    expectedStatus: z.enum(['in_progress', 'rejected', 'selected']).optional(),
    customMessage: z.string().max(2000).optional().default(''),
    useCustomMessage: z.boolean().optional().default(false),
    isAbsent: z.boolean().optional(),
  }),
  updateStatus: z.object({
    applicationId: objectIdSchema.optional(),
    action: z.enum(['promote', 'reject']).optional(),
    status: z.enum(['Pending', 'Shortlisted', 'Rejected', 'Selected', 'in_progress', 'rejected', 'selected']).optional(),
    expectedRound: z.number().int().min(1).optional(),
    expectedStatus: z.enum(['in_progress', 'rejected', 'selected']).optional(),
    customMessage: z.string().max(2000).optional(),
    isAbsent: z.boolean().optional(),
  }).refine(
    (data) => data.action || data.status,
    { message: 'Either action or status is required' }
  ),
  exportJobApplicants: z.object({
    status: z.array(z.enum(['in_progress', 'selected', 'rejected'])).max(10).optional(),
    schools: z.array(z.string()).max(50).optional().refine((arr) => {
      if (!arr) return true;
      return new Set(arr).size === arr.length;
    }, 'Duplicate schools are not allowed'),
    graduationYears: z.array(z.number()).max(20).optional().refine((arr) => {
      if (!arr) return true;
      return new Set(arr).size === arr.length;
    }, 'Duplicate graduation years are not allowed'),
    columns: z.array(z.string()).max(30).optional().refine((arr) => {
      if (!arr) return true;
      return new Set(arr).size === arr.length;
    }, 'Duplicate columns are not allowed'),
    includeResumeLinks: z.boolean().optional().default(false),
    linkExpiryDays: z
      .number()
      .int()
      .refine(
        (value) => [10, 20, 30, 60].includes(value),
        'Invalid link expiry duration'
      )
      .optional()
      .default(30),
    isAbsentOnly: z.boolean().optional().default(false)
  }),
};

module.exports = {
  adminSchemas,
  applicationSchemas,
  authSchemas,
  objectIdSchema,
  userSchemas,
};
