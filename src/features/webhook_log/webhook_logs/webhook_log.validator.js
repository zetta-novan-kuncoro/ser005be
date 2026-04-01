// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const Joi = require('joi');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const SOURCES = ['JIRA', 'YouTrack'];
const PROCESSING_STATUSES = ['SIGNATURE_REJECTED', 'PARSE_FAILED', 'IGNORED', 'PROCESSED', 'FAILED'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

const getAdminWebhookLogsSchema = Joi.object({
  source:            Joi.string().valid(...SOURCES).optional(),
  processing_status: Joi.string().valid(...PROCESSING_STATUSES).optional(),
  issue_key:         Joi.string().max(50).optional(),
  from_date:         Joi.string().pattern(DATE_PATTERN).optional(),
  to_date:           Joi.string().pattern(DATE_PATTERN).optional(),
}).options({ allowUnknown: false });

// *************** FUNCTIONS ***************
/**
 * Validates filter input for GetAdminWebhookLogs.
 *
 * @param {Object} filter
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateGetAdminWebhookLogs(filter) {
  return getAdminWebhookLogsSchema.validate(filter, { abortEarly: false });
}

// *************** EXPORT MODULE ***************
module.exports = { ValidateGetAdminWebhookLogs };
