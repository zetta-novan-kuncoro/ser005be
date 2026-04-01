// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { v4: uuidv4 } = require('uuid');

// *************** IMPORT MODULE ***************
const ErrorLogModel = require('./error_log.model');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Appends an immutable error log entry. This function is append-only.
 *
 * @param {Object} params
 * @param {string} params.error_code - Machine-readable error code
 * @param {string} params.error_message - Human-readable error message
 * @param {'JIRA'|'YouTrack'|'System'} params.source - Error source system
 * @param {string|null} [params.entity_type]
 * @param {string|null} [params.entity_id]
 * @param {string|null} [params.actor_type]
 * @param {string|null} [params.actor_id]
 * @param {*} [params.metadata]
 * @returns {Promise<Object>}
 */
async function AppendErrorLog({
  error_code,
  error_message,
  source,
  entity_type = null,
  entity_id = null,
  actor_type = null,
  actor_id = null,
  metadata = null,
}) {
  const entry = await ErrorLogModel.create({
    error_id: uuidv4(),
    timestamp: new Date().toISOString(),
    error_code,
    error_message,
    source,
    entity_type,
    entity_id,
    actor_type,
    actor_id,
    metadata,
  });

  return entry.toObject();
}

/**
 * Returns paginated error logs for admin review.
 *
 * @param {number} [limit=50]
 * @param {number} [offset=0]
 * @returns {Promise<Object[]>}
 */
async function GetAdminErrorLogs(limit = 50, offset = 0) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  return ErrorLogModel.find({})
    .sort({ timestamp: -1 })
    .skip(safeOffset)
    .limit(safeLimit)
    .lean();
}

// *************** EXPORT MODULE ***************
module.exports = { AppendErrorLog, GetAdminErrorLogs };
