const path = require('path');
const fs = require('fs');
const { createLogger, format, transports } = require('winston');

const enableFileLogs = process.env.ENABLE_FILE_LOGS === 'true';
const fileTransports = [];

if (enableFileLogs) {
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  fileTransports.push(
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    })
  );
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.printf(({ level, message, timestamp, stack }) =>
      `${timestamp} [${level}] ${stack || message}`
    )
  ),
  transports: [new transports.Console(), ...fileTransports],
});

module.exports = logger;
