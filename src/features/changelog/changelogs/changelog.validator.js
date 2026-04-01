// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const Joi = require('joi');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const CHANGE_TYPES = ['Feature', 'Fix', 'Breaking', 'Security', 'Performance', 'Ops', 'Compliance'];
const IMPACT_SCOPES = ['UI', 'API', 'Data', 'Infra', 'Mixed'];
const STATUSES = ['Draft', 'Published', 'Deprecated', 'RolledBack'];
const VISIBILITIES = ['PublicToCustomers', 'InternalOnly'];

const changelogTicketSchema = Joi.object({
  ticket_id: Joi.string().allow('').optional(),
  ticket_ref: Joi.string().allow('').optional(),
  ticket_name: Joi.string().allow('').optional(),
  ticket_url: Joi.string().uri().allow('').optional(),
}).custom((value, helpers) => {
  const hasContent = ['ticket_id', 'ticket_ref', 'ticket_name', 'ticket_url']
    .some((field) => typeof value[field] === 'string' && value[field].trim() !== '');

  if (!hasContent) {
    return helpers.error('any.invalid');
  }

  return value;
}, 'Changelog ticket content validation');

const createChangelogSchema = Joi.object({
  application_reference: Joi.string().required(),
  version: Joi.string().required(),
  title: Joi.string().required(),
  summary: Joi.string().allow('').optional(),
  details_md: Joi.string().allow('').optional(),
  change_type: Joi.string().valid(...CHANGE_TYPES).required(),
  impact_scope: Joi.string().valid(...IMPACT_SCOPES).required(),
  release_date: Joi.date().iso().required(),
  status: Joi.string().valid(...STATUSES).optional(),
  visibility: Joi.string().valid(...VISIBILITIES).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  tickets: Joi.array().items(changelogTicketSchema).optional(),
  attachments: Joi.array().items(Joi.string()).optional(),
  released_request_ids: Joi.array().items(Joi.string()).optional(),
});

const updateChangelogSchema = Joi.object({
  version: Joi.string().optional(),
  title: Joi.string().optional(),
  summary: Joi.string().allow('').optional(),
  details_md: Joi.string().allow('').optional(),
  change_type: Joi.string().valid(...CHANGE_TYPES).optional(),
  impact_scope: Joi.string().valid(...IMPACT_SCOPES).optional(),
  release_date: Joi.date().iso().optional(),
  status: Joi.string().valid(...STATUSES).optional(),
  visibility: Joi.string().valid(...VISIBILITIES).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  tickets: Joi.array().items(changelogTicketSchema).optional(),
  attachments: Joi.array().items(Joi.string()).optional(),
  released_request_ids: Joi.array().items(Joi.string()).optional(),
});

// *************** FUNCTIONS ***************
/**
 * Validates the input for CreateChangelog.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateCreateChangelog(input) {
  return createChangelogSchema.validate(input, { abortEarly: false });
}

/**
 * Validates the input for UpdateChangelog.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateUpdateChangelog(input) {
  return updateChangelogSchema.validate(input, { abortEarly: false });
}

// *************** EXPORT MODULE ***************
module.exports = { ValidateCreateChangelog, ValidateUpdateChangelog };
