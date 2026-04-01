// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const Joi = require('joi');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const createTranslationSchema = Joi.object({
  key: Joi.string().required(),
  namespace: Joi.string().required(),
  en: Joi.string().allow('').optional(),
  fr: Joi.string().allow('').optional(),
  es: Joi.string().allow('').optional(),
  id: Joi.string().allow('').optional(),
});

const updateTranslationSchema = Joi.object({
  en: Joi.string().allow('').optional(),
  fr: Joi.string().allow('').optional(),
  es: Joi.string().allow('').optional(),
  id: Joi.string().allow('').optional(),
});

// *************** FUNCTIONS ***************
/**
 * Validates input for CreateTranslation.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateCreateTranslation(input) {
  return createTranslationSchema.validate(input, { abortEarly: false });
}

/**
 * Validates input for UpdateTranslation.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateUpdateTranslation(input) {
  return updateTranslationSchema.validate(input, { abortEarly: false });
}

// *************** EXPORT MODULE ***************
module.exports = { ValidateCreateTranslation, ValidateUpdateTranslation };
