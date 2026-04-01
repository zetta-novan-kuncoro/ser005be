// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const Joi = require('joi');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const ALLOWED_TYPES = ['COR-A', 'COR-B', 'SAT', 'INT-ADMIN', 'INT-TECH', 'SER'];
const ALLOWED_ENVIRONMENTS = ['dev', 'staging', 'prod'];
const ALLOWED_TENANT_SCOPES = ['global', 'tenant-specific'];

const ownerSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  role: Joi.string().required(),
});

const createApplicationSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid(...ALLOWED_TYPES).required(),
  reference: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).min(2).max(60).required(),
  environment: Joi.string().valid(...ALLOWED_ENVIRONMENTS).required(),
  description: Joi.string().allow('').optional(),
  active: Joi.boolean().optional(),
  icon: Joi.string().allow('').optional(),
  tenant_scope: Joi.string().valid(...ALLOWED_TENANT_SCOPES).optional(),
  owners: Joi.array().items(ownerSchema).optional(),
});

const updateApplicationSchema = Joi.object({
  name: Joi.string().optional(),
  type: Joi.string().valid(...ALLOWED_TYPES).optional(),
  environment: Joi.string().valid(...ALLOWED_ENVIRONMENTS).optional(),
  description: Joi.string().allow('').optional(),
  active: Joi.boolean().optional(),
  icon: Joi.string().allow('').optional(),
  tenant_scope: Joi.string().valid(...ALLOWED_TENANT_SCOPES).optional(),
  owners: Joi.array().items(ownerSchema).optional(),
});

// *************** FUNCTIONS ***************
/**
 * Validates the input for CreateApplication mutation.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateCreateApplication(input) {
  return createApplicationSchema.validate(input, { abortEarly: false });
}

/**
 * Validates the input for UpdateApplication mutation.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateUpdateApplication(input) {
  return updateApplicationSchema.validate(input, { abortEarly: false });
}

// *************** EXPORT MODULE ***************
module.exports = { ValidateCreateApplication, ValidateUpdateApplication };
