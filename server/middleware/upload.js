const multer = require("multer");
const AppError = require("../utils/AppError");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // CASE 1: WHITELIST CSV UPLOAD
  if (file.fieldname === 'file') {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/csv'
    ];

    const isCsvMime = allowedTypes.includes(file.mimetype);
    const isCsvExt = file.originalname.toLowerCase().endsWith('.csv');

    if (isCsvMime || isCsvExt) {
      return cb(null, true);
    }

    return cb(new AppError('Invalid CSV file', 400), false);
  }

  // CASE 2: IMAGE UPLOAD (existing logic)
  if (file.mimetype.startsWith('image/')) {
    return cb(null, true);
  }

  // REJECT EVERYTHING ELSE
  return cb(new AppError('Invalid file type', 400), false);
};

const createUpload = (fileSize) => multer({
  storage,
  limits: { fileSize },
  fileFilter
});

const upload = createUpload(5 * 1024 * 1024);

module.exports = upload;
