// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// *************** IMPORT MODULE ***************
const config = require('../core/config');

// *************** VARIABLES ***************
const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

const BUCKET = config.aws.s3Bucket;
const SHOULD_SKIP_S3_UPLOAD =
  !config.isProduction &&
  (
    !config.aws.accessKeyId ||
    !config.aws.secretAccessKey ||
    config.aws.accessKeyId === 'your_key' ||
    config.aws.secretAccessKey === 'your_secret'
  );

// *************** FUNCTIONS ***************
/**
 * Generates a presigned PUT URL for direct client-side uploads to S3.
 *
 * @param {string} key - S3 object key
 * @param {string} contentType - MIME type of the object being uploaded
 * @param {number} [expiresIn=3600] - URL expiry time in seconds
 * @returns {Promise<string>} Presigned PUT URL
 */
async function GeneratePresignedPutUrl(key, contentType, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generates a presigned GET URL for downloading an S3 object.
 *
 * @param {string} key - S3 object key
 * @param {number} [expiresIn=3600] - URL expiry time in seconds
 * @returns {Promise<string>} Presigned GET URL
 */
async function GeneratePresignedGetUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Uploads a raw Buffer to S3 synchronously (server-side).
 * Used for immutable changelog snapshot uploads.
 *
 * @param {string} key - S3 object key
 * @param {Buffer} buffer - File content as a Buffer
 * @param {string} contentType - MIME type of the buffer
 * @returns {Promise<import('@aws-sdk/client-s3').PutObjectCommandOutput>}
 */
async function UploadBuffer(key, buffer, contentType) {
  if (SHOULD_SKIP_S3_UPLOAD) {
    return {
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ETag: '"dev-s3-bypass"',
      Body: buffer,
    };
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  return s3Client.send(command);
}

// *************** EXPORT MODULE ***************
module.exports = { GeneratePresignedPutUrl, GeneratePresignedGetUrl, UploadBuffer };
