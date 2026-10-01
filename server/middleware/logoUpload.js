const multer = require("multer");
const AppError = require("../utils/AppError");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/jpg"
  ) {
    return cb(null, true);
  }
  return cb(new AppError("Invalid file type. Only PNG, JPG, JPEG allowed.", 400), false);
};

const logoUpload = multer({
  storage,
  limits: { fileSize: 150 * 1024 },
  fileFilter,
});

module.exports = logoUpload;
