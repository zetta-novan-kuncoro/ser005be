// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const Joi = require('joi');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const ALLOWED_PURPOSES = [
  'EvolutionRequestAttachment',
  'ChangelogAttachment',
  'DocumentationArtifact',
  'ApplicationAsset',
];

const uploadAuthorizationSchema = Joi.object({
  application_reference: Joi.string().required(),
  purpose: Joi.string().valid(...ALLOWED_PURPOSES).required(),
  filename: Joi.string().required(),
  content_type: Joi.string().required(),
}).options({ allowUnknown: false });

const completeUploadSchema = Joi.object({
  application_reference: Joi.string().required(),
  purpose: Joi.string().valid(...ALLOWED_PURPOSES).required(),
  s3_key: Joi.string().required(),
}).options({ allowUnknown: false });

// *************** FUNCTIONS ***************
/**
 * Validates input for CreateUploadAuthorization.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateUploadAuthorization(input) {
  return uploadAuthorizationSchema.validate(input, { abortEarly: false });
}

/**
 * Validates input for CompleteUpload.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateCompleteUpload(input) {
  return completeUploadSchema.validate(input, { abortEarly: false });
}

// *************** EXPORT MODULE ***************
module.exports = { ValidateUploadAuthorization, ValidateCompleteUpload, ALLOWED_PURPOSES };
