// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const Joi = require('joi');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const createRoadmapPhaseSchema = Joi.object({
  application_reference: Joi.string().required(),
  phase_name: Joi.string().required(),
  order: Joi.number().integer().min(0).required(),
  description: Joi.string().allow('').optional(),
});

const updateRoadmapPhaseSchema = Joi.object({
  phase_name: Joi.string().optional(),
  order: Joi.number().integer().min(0).optional(),
  description: Joi.string().allow('').optional(),
});

// *************** FUNCTIONS ***************
/**
 * Validates the input for CreateRoadmapPhase.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateCreateRoadmapPhase(input) {
  return createRoadmapPhaseSchema.validate(input, { abortEarly: false });
}

/**
 * Validates the input for UpdateRoadmapPhase.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateUpdateRoadmapPhase(input) {
  return updateRoadmapPhaseSchema.validate(input, { abortEarly: false });
}

// *************** EXPORT MODULE ***************
module.exports = { ValidateCreateRoadmapPhase, ValidateUpdateRoadmapPhase };
