// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const Joi = require('joi');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const createApiKeySchema = Joi.object({
  name: Joi.string().required(),
  expires_at: Joi.date().iso().greater('now').optional().allow(null),
});

// *************** FUNCTIONS ***************
/**
 * Validates the input for CreateApiKey mutation.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateCreateApiKey(input) {
  return createApiKeySchema.validate(input, { abortEarly: false });
}

// *************** EXPORT MODULE ***************
module.exports = { ValidateCreateApiKey };
