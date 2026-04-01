// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const Joi = require('joi');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const generateDocumentationVersionSchema = Joi.object({
  version: Joi.string().required(),
  s3_key: Joi.string().required(),
  filename: Joi.string().required(),
});

// *************** FUNCTIONS ***************
/**
 * Validates input for GenerateDocumentationVersion.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateGenerateDocumentationVersion(input) {
  return generateDocumentationVersionSchema.validate(input, { abortEarly: false });
}

// *************** EXPORT MODULE ***************
module.exports = { ValidateGenerateDocumentationVersion };
