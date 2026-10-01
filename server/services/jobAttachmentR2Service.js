const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const AppError = require('../utils/AppError');

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
const R2_BUCKET = process.env.R2_BUCKET;

const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
});

const ALLOWED_MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint'
};

const MAGIC_BYTES = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2D], // %PDF-
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B], // PK
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [0x50, 0x4B],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [0x50, 0x4B],
  'application/vnd.ms-powerpoint': [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1],
};

const validateR2Key = (key) => {
  if (!key || typeof key !== 'string') {
    throw new AppError('Invalid attachment key', 400);
  }
  if (!key.startsWith('job-attachments/')) {
    throw new AppError('Key must start with job-attachments/', 400);
  }
  if (key.includes('../') || key.includes('\\') || key.includes('//')) {
    throw new AppError('Invalid characters in attachment key', 400);
  }
};

exports.generateUploadUrl = async (jobId, extension) => {
  if (typeof extension !== 'string') {
    throw new AppError('Invalid extension', 400);
  }
  let ext = extension.trim().toLowerCase();
  if (!ext.startsWith('.')) {
    ext = '.' + ext;
  }
  
  if (!ALLOWED_MIME_TYPES[ext]) {
    throw new AppError('Unsupported file extension', 400);
  }
  
  const uuid = crypto.randomUUID();
  const r2Key = `job-attachments/${jobId}/${uuid}${ext}`;
  
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    ContentType: ALLOWED_MIME_TYPES[ext],
  });
  
  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 180 });
  
  return {
    uploadUrl,
    r2Key
  };
};

exports.generateDownloadUrl = async (r2Key, originalName) => {
  validateR2Key(r2Key);

  const safeFilename = String(originalName || '').replace(/["'\r\n]/g, '').trim() || 'attachment';
  const encodedFilename = encodeURIComponent(safeFilename);
  
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    ResponseContentDisposition: `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`
  });
  
  return await getSignedUrl(r2Client, command, { expiresIn: 180 });
};

exports.validateUploadedFile = async (r2Key, expectedMimeType) => {
  validateR2Key(r2Key);

  // 1. Check Metadata
  let metadata;
  try {
    metadata = await r2Client.send(new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
    }));
  } catch (error) {
    if (error.name === 'NotFound') {
      throw new AppError('File not found in storage', 404);
    }
    throw error;
  }

  if (metadata.ContentLength > 2097152) {
    throw new AppError('File size exceeds 2MB limit', 400);
  }

  if (metadata.ContentType !== expectedMimeType) {
    throw new AppError('MIME type mismatch', 400);
  }

  // 2. Magic Byte Validation
  const expectedBytes = MAGIC_BYTES[expectedMimeType];
  if (!expectedBytes) {
    throw new AppError('Unsupported MIME type for validation', 400);
  }

  // Only request the specific bytes needed for the magic signature
  const response = await r2Client.send(new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    Range: `bytes=0-${expectedBytes.length - 1}`
  }));

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  for (let i = 0; i < expectedBytes.length; i++) {
    if (buffer[i] !== expectedBytes[i]) {
      throw new AppError('Invalid file signature (magic bytes mismatch)', 400);
    }
  }

  return true;
};

exports.deleteFile = async (r2Key) => {
  validateR2Key(r2Key);
  
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
    });
    await r2Client.send(command);
  } catch (error) {
    console.error(`Failed to delete R2 object: ${r2Key}`, error);
    throw new AppError('Failed to delete file from storage', 500);
  }
};
