const multer = require('multer');
const AppError = require('../utils/AppError');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const isCsvExt = file.originalname.toLowerCase().endsWith('.csv');
  const isValidMime = !file.mimetype || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel';

  if (isCsvExt && isValidMime) {
    cb(null, true);
  } else {
    cb(new AppError('Only CSV files are allowed', 400), false);
  }
};

const csvUploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
  },
  fileFilter,
});

module.exports = csvUploadMiddleware;
