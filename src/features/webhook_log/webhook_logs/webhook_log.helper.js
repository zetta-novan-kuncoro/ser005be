// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { v4: uuidv4 } = require('uuid');

// *************** IMPORT MODULE ***************
const WebhookLogModel = require('./webhook_log.model');
const { ValidateGetAdminWebhookLogs } = require('./webhook_log.validator');
const { ThrowFormattedError } = require('../../../core/error');
const { NormalizePagination, BuildPaginatedResponse } = require('../../../shared/pagination.helper');

// *************** VARIABLES ***************
const ALLOWED_SORT_FIELDS = ['received_at', 'duration_ms', 'http_response_status', 'processing_status'];

// *************** FUNCTIONS ***************
/**
 * Appends an immutable webhook log entry. This function is append-only.
 *
 * @param {Object} params
 * @param {'JIRA'|'YouTrack'} params.source
 * @param {string} params.received_at - ISO 8601 timestamp
 * @param {string} params.route
 * @param {boolean} params.signature_present
 * @param {boolean} params.signature_valid
 * @param {'SIGNATURE_REJECTED'|'PARSE_FAILED'|'IGNORED'|'PROCESSED'|'FAILED'} params.processing_status
 * @param {number} params.http_response_status
 * @param {string|null} [params.remote_ip]
 * @param {string|null} [params.content_type]
 * @param {number|null} [params.payload_size_bytes]
 * @param {string|null} [params.processing_note]
 * @param {string|null} [params.issue_key]
 * @param {string|null} [params.entity_type]
 * @param {string|null} [params.entity_id]
 * @param {string|null} [params.resolved_status]
 * @param {boolean} [params.auto_advance_attempted]
 * @param {boolean|null} [params.auto_advance_succeeded]
 * @param {Object|null} [params.payload_summary]
 * @param {string|null} [params.error_code]
 * @param {string|null} [params.error_message]
 * @param {number|null} [params.duration_ms]
 * @returns {Promise<Object>}
 */
async function AppendWebhookLog({
  source,
  received_at,
  route,
  signature_present,
  signature_valid,
  processing_status,
  http_response_status,
  remote_ip = null,
  content_type = null,
  payload_size_bytes = null,
  processing_note = null,
  issue_key = null,
  entity_type = null,
  entity_id = null,
  resolved_status = null,
  auto_advance_attempted = false,
  auto_advance_succeeded = null,
  payload_summary = null,
  error_code = null,
  error_message = null,
  duration_ms = null,
}) {
  const entry = await WebhookLogModel.create({
    log_id: uuidv4(),
    source,
    received_at,
    route,
    signature_present,
    signature_valid,
    processing_status,
    http_response_status,
    remote_ip,
    content_type,
    payload_size_bytes,
    processing_note,
    issue_key,
    entity_type,
    entity_id,
    resolved_status,
    auto_advance_attempted,
    auto_advance_succeeded,
    payload_summary,
    error_code,
    error_message,
    duration_ms,
  });

  return entry.toObject();
}

/**
 * Returns paginated webhook logs for admin review.
 *
 * @param {Object} [filter={}]
 * @param {Object} [pagination={}]
 * @param {Object} [sort={}]
 * @returns {Promise<Object>}
 */
async function GetAdminWebhookLogs(filter = {}, pagination = {}, sort = {}) {
  const { error } = ValidateGetAdminWebhookLogs(filter);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });

  const { page, limit, skip } = NormalizePagination(pagination);
  const query = {};

  if (filter.source) query.source = filter.source;
  if (filter.processing_status) query.processing_status = filter.processing_status;
  if (filter.issue_key) query.issue_key = filter.issue_key;

  if (filter.from_date || filter.to_date) {
    query.received_at = {};
    if (filter.from_date) query.received_at.$gte = filter.from_date;
    if (filter.to_date) query.received_at.$lte = filter.to_date;
  }

  const sortField = ALLOWED_SORT_FIELDS.includes(sort.field) ? sort.field : 'received_at';
  const sortOrder = sort.order === 'asc' ? 1 : -1;

  const [data, total] = await Promise.all([
    WebhookLogModel.find(query).sort({ [sortField]: sortOrder }).skip(skip).limit(limit).lean(),
    WebhookLogModel.countDocuments(query),
  ]);

  return BuildPaginatedResponse(data, total, page, limit);
}

// *************** EXPORT MODULE ***************
module.exports = { AppendWebhookLog, GetAdminWebhookLogs };
