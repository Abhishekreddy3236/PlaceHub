const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^[0-9]{10}$/;
const GENDERS = ['Male', 'Female', 'Other'];

const REQUIRED_APPLICATION_PROFILE_FIELDS = [
  'name',
  'age',
  'branch',
  'cgpa',
  'tenthPercentage',
  'twelfthPercentage',
  'personalEmail',
  'mobileNumber',
  'gender',
];

const PROFILE_FIELD_LABELS = {
  name: 'Full Name',
  age: 'Age',
  branch: 'Branch',
  cgpa: 'CGPA',
  tenthPercentage: '10th Percentage',
  twelfthPercentage: '12th Percentage',
  personalEmail: 'Personal Email',
  mobileNumber: 'Mobile Number',
  gender: 'Gender',
};

const isBlank = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '');

const isValidNumberInRange = (value, min, max) => {
  if (isBlank(value)) {
    return false;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max;
};

const fieldValidators = {
  name: (value) => !isBlank(value),
  age: (value) => Number.isInteger(Number(value)) && Number(value) >= 16 && Number(value) <= 100,
  branch: (value) => !isBlank(value),
  cgpa: (value) => isValidNumberInRange(value, 0, 10),
  tenthPercentage: (value) => isValidNumberInRange(value, 0, 100),
  twelfthPercentage: (value) => isValidNumberInRange(value, 0, 100),
  personalEmail: (value) => !isBlank(value) && EMAIL_REGEX.test(String(value).trim()),
  mobileNumber: (value) => !isBlank(value) && MOBILE_REGEX.test(String(value).trim()),
  gender: (value) => GENDERS.includes(value),
};

const getMissingApplicationProfileFields = (student) =>
  REQUIRED_APPLICATION_PROFILE_FIELDS.filter((field) => {
    const validator = fieldValidators[field];
    return !validator || !validator(student?.[field]);
  });

const getApplicationProfileStatus = (student) => {
  const missingFields = getMissingApplicationProfileFields(student);

  return {
    complete: missingFields.length === 0,
    missingFields,
    missingFieldLabels: missingFields.map((field) => PROFILE_FIELD_LABELS[field] || field),
  };
};

module.exports = {
  EMAIL_REGEX,
  GENDERS,
  MOBILE_REGEX,
  PROFILE_FIELD_LABELS,
  REQUIRED_APPLICATION_PROFILE_FIELDS,
  getApplicationProfileStatus,
  getMissingApplicationProfileFields,
};
