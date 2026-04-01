// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// *************** IMPORT MODULE ***************
const { ValidateUploadAuthorization, ValidateCompleteUpload } = require('./upload.validator');
const { ThrowFormattedError } = require('../../../core/error');
const { GeneratePresignedPutUrl, GeneratePresignedGetUrl } = require('../../../shared/s3.service');

// *************** VARIABLES ***************
const UPLOAD_EXPIRY_SECONDS = {
  public: 900,
  admin: 1800,
};
const PURPOSE_CONTENT_TYPES = {
  EvolutionRequestAttachment: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'],
  ChangelogAttachment: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'],
  DocumentationArtifact: ['text/markdown', 'application/pdf'],
  ApplicationAsset: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
};
const PUBLIC_UPLOAD_PURPOSES = new Set(['EvolutionRequestAttachment']);

/**
 * Returns true when the current caller is an authenticated admin session.
 *
 * @param {{ user?: { role?: string }|null }} context
 * @returns {boolean}
 */
function IsAdminCaller(context) {
  return context?.user?.role === 'admin';
}

/**
 * Validates that the caller can operate on the requested upload purpose.
 *
 * @param {Object} input
 * @param {{ user?: Object|null, apiKey?: Object|null }} context
 * @returns {void}
 */
function AssertUploadAccess(input, context) {
  const isAdmin = IsAdminCaller(context);
  const apiKey = context?.apiKey || null;

  if (isAdmin) {
    return;
  }

  if (!apiKey) {
    ThrowFormattedError('UNAUTHENTICATED', 'Admin session or valid API key required.');
  }

  if (!PUBLIC_UPLOAD_PURPOSES.has(input.purpose)) {
    ThrowFormattedError('FORBIDDEN_ACTION', 'This upload purpose requires admin access.');
  }

  if (apiKey.application_reference !== input.application_reference) {
    ThrowFormattedError('FORBIDDEN_ACTION', 'API key does not have access to this application.');
  }
}

/**
 * Returns the permitted expiry window for the current caller.
 *
 * @param {{ user?: Object|null }} context
 * @returns {number}
 */
function GetUploadExpirySeconds(context) {
  return IsAdminCaller(context) ? UPLOAD_EXPIRY_SECONDS.admin : UPLOAD_EXPIRY_SECONDS.public;
}

/**
 * Validates that the content type is allowed for the requested purpose.
 *
 * @param {string} purpose
 * @param {string} contentType
 * @returns {void}
 */
function AssertAllowedContentType(purpose, contentType) {
  const allowedContentTypes = PURPOSE_CONTENT_TYPES[purpose] || [];

  if (!allowedContentTypes.includes(contentType)) {
    ThrowFormattedError('VALIDATION_ERROR', `Content type '${contentType}' is not allowed for '${purpose}'.`);
  }
}

/**
 * Builds the canonical S3 key prefix for an application and upload purpose.
 *
 * @param {string} applicationReference
 * @param {string} purpose
 * @returns {string}
 */
function BuildUploadPrefix(applicationReference, purpose) {
  return `uploads/${applicationReference}/${purpose}/`;
}

// *************** FUNCTIONS ***************
/**
 * Generates a presigned S3 PUT URL for the given file.
 * The S3 key is scoped by application and upload purpose.
 *
 * @param {Object} input
 * @param {string} input.application_reference
 * @param {string} input.purpose
 * @param {string} input.filename
 * @param {string} input.content_type
 * @param {{ user?: Object|null, apiKey?: Object|null }} [context={}]
 * @returns {Promise<{ upload_url: string, s3_key: string, expires_in: number }>}
 */
async function CreateUploadAuthorization(input, context = {}) {
  const { error, value } = ValidateUploadAuthorization(input);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });

  AssertUploadAccess(value, context);
  AssertAllowedContentType(value.purpose, value.content_type);

  const ext = path.extname(value.filename) || '';
  const prefix = BuildUploadPrefix(value.application_reference, value.purpose);
  const s3Key = `${prefix}${uuidv4()}${ext}`;
  const expirySeconds = GetUploadExpirySeconds(context);

  const uploadUrl = await GeneratePresignedPutUrl(s3Key, value.content_type, expirySeconds);

  return {
    upload_url: uploadUrl,
    s3_key: s3Key,
    expires_in: expirySeconds,
  };
}

/**
 * Generates a presigned GET URL for a previously uploaded file.
 * This signals that the upload is complete and the file is accessible.
 *
 * @param {Object} input
 * @param {string} input.application_reference
 * @param {string} input.purpose
 * @param {string} input.s3_key
 * @param {{ user?: Object|null, apiKey?: Object|null }} [context={}]
 * @returns {Promise<{ s3_key: string, download_url: string }>}
 */
async function CompleteUpload(input, context = {}) {
  const { error, value } = ValidateCompleteUpload(input);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });

  AssertUploadAccess(value, context);

  const prefix = BuildUploadPrefix(value.application_reference, value.purpose);
  if (!value.s3_key.startsWith(prefix)) {
    ThrowFormattedError('FORBIDDEN_ACTION', 'Upload key is outside the allowed application/purpose scope.');
  }

  const downloadUrl = await GeneratePresignedGetUrl(value.s3_key, GetUploadExpirySeconds(context));

  return {
    s3_key: value.s3_key,
    download_url: downloadUrl,
  };
}

// *************** EXPORT MODULE ***************
module.exports = {
  CreateUploadAuthorization,
  CompleteUpload,
  BuildUploadPrefix,
  GetUploadExpirySeconds,
};
