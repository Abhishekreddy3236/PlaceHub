const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
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

const encodeCopySource = (bucket, key) =>
  `${bucket}/${String(key).split('/').map(encodeURIComponent).join('/')}`;

exports.generateUploadUrl = async (key) => {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: 'application/pdf',
  });
  return await getSignedUrl(r2Client, command, { expiresIn: 180 });
};

exports.generateDownloadUrl = async (key, filename, mode = 'inline') => {
  if (!key) {
    throw new AppError('Resume not found', 404);
  }

  const params = {
    Bucket: R2_BUCKET,
    Key: key,
  };

  if (filename) {
    let safeFilename = String(filename).replace(/["']/g, '').trim();
    if (!safeFilename) safeFilename = 'resume.pdf';

    const encodedFilename = encodeURIComponent(safeFilename);
    params.ResponseContentDisposition = `${mode}; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`;
  }

  const command = new GetObjectCommand(params);
  return await getSignedUrl(r2Client, command, { expiresIn: 180 });
};

exports.deleteObject = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });
  await r2Client.send(command);
};

exports.copyObject = async (sourceKey, destinationKey) => {
  const command = new CopyObjectCommand({
    Bucket: R2_BUCKET,
    Key: destinationKey,
    CopySource: encodeCopySource(R2_BUCKET, sourceKey),
  });

  await r2Client.send(command);
};

exports.fileExists = async (key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    });
    await r2Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
};

exports.getFileMetadata = async (key) => {
  const command = new HeadObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });
  return await r2Client.send(command);
};

exports.getObjectStream = async (key, options = {}) => {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ...options
  });
  const response = await r2Client.send(command);
  return response.Body;
};

const R2_LOGOS_BUCKET = process.env.R2_LOGOS_BUCKET;
const R2_LOGOS_PUBLIC_URL = process.env.R2_LOGOS_PUBLIC_URL;

exports.uploadLogoBuffer = async (key, buffer, contentType) => {
  const command = new PutObjectCommand({
    Bucket: R2_LOGOS_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await r2Client.send(command);
  return `${R2_LOGOS_PUBLIC_URL}/${key}`;
};

exports.deleteLogoObject = async (key) => {
  if (!key) return;
  const command = new DeleteObjectCommand({
    Bucket: R2_LOGOS_BUCKET,
    Key: key,
  });
  await r2Client.send(command);
};

exports.deleteLogoObjects = async (keys) => {
  if (!keys || !keys.length) return;
  const { DeleteObjectsCommand } = require('@aws-sdk/client-s3');
  const command = new DeleteObjectsCommand({
    Bucket: R2_LOGOS_BUCKET,
    Delete: {
      Objects: keys.map(k => ({ Key: k })),
      Quiet: true,
    },
  });
  await r2Client.send(command);
};
