// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const Joi = require('joi');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const ALLOWED_TYPES = ['Evolution', 'Fix'];
const ALLOWED_STATUSES = [
  'Pending',
  'Reviewed',
  'Approved',
  'Ready for Development',
  'In Development',
  'Testing & UAT',
  'Release',
  'Rejected',
];
const ALLOWED_PRIORITIES = [1, 2, 3];

const submitEvolutionRequestSchema = Joi.object({
  application_reference: Joi.string().required(),
  type: Joi.string().valid(...ALLOWED_TYPES).required(),
  title: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  submitted_by: Joi.string().required(),
  priority: Joi.number().valid(...ALLOWED_PRIORITIES).required(),
  expected_date: Joi.date().iso().optional().allow(null),
  attachments: Joi.array().items(Joi.string()).optional(),
  website: Joi.string().allow('').optional(),
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid(...ALLOWED_STATUSES).required(),
});

const adminUpdateEvolutionRequestSchema = Joi.object({
  title: Joi.string().trim().min(1).optional(),
  description: Joi.string().allow('').optional(),
  priority: Joi.number().valid(...ALLOWED_PRIORITIES).optional(),
  type: Joi.string().valid(...ALLOWED_TYPES).optional(),
  expected_date: Joi.date().iso().optional().allow(null),
}).min(1).options({ allowUnknown: false });

// *************** FUNCTIONS ***************
/**
 * Validates the input for SubmitEvolutionRequest.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateSubmitEvolutionRequest(input) {
  return submitEvolutionRequestSchema.validate(input, { abortEarly: false });
}

/**
 * Validates a status transition value.
 *
 * @param {{ status: string }} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateEvolutionRequestStatus(input) {
  return updateStatusSchema.validate(input, { abortEarly: false });
}

/**
 * Validates the input for AdminUpdateEvolutionRequest.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateAdminEvolutionRequestUpdate(input) {
  return adminUpdateEvolutionRequestSchema.validate(input, { abortEarly: false });
}

// *************** EXPORT MODULE ***************
module.exports = {
  ValidateSubmitEvolutionRequest,
  ValidateEvolutionRequestStatus,
  ValidateAdminEvolutionRequestUpdate,
};
