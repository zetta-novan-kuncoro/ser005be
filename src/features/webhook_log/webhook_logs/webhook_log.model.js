// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const mongoose = require('mongoose');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const { Schema, model } = mongoose;

const PROCESSING_STATUSES = ['SIGNATURE_REJECTED', 'PARSE_FAILED', 'IGNORED', 'PROCESSED', 'FAILED'];
const SOURCES = ['JIRA', 'YouTrack'];

const WebhookLogSchema = new Schema(
  {
    log_id:                 { type: String, required: true, unique: true, index: true },
    source:                 { type: String, enum: SOURCES, required: true, index: true },
    received_at:            { type: String, required: true, index: true },
    route:                  { type: String, required: true },
    remote_ip:              { type: String, default: null },
    http_method:            { type: String, default: 'POST' },
    content_type:           { type: String, default: null },
    payload_size_bytes:     { type: Number, default: null },
    signature_present:      { type: Boolean, required: true },
    signature_valid:        { type: Boolean, required: true },
    processing_status:      { type: String, enum: PROCESSING_STATUSES, required: true, index: true },
    processing_note:        { type: String, default: null },
    issue_key:              { type: String, default: null, index: true },
    entity_type:            { type: String, default: null },
    entity_id:              { type: String, default: null },
    resolved_status:        { type: String, default: null },
    auto_advance_attempted: { type: Boolean, default: false },
    auto_advance_succeeded: { type: Boolean, default: null },
    payload_summary:        { type: Schema.Types.Mixed, default: null },
    error_code:             { type: String, default: null },
    error_message:          { type: String, default: null },
    duration_ms:            { type: Number, default: null },
    http_response_status:   { type: Number, required: true },
  },
  {
    collection: 'webhook_logs',
  }
);

WebhookLogSchema.index({ source: 1, received_at: -1 });
WebhookLogSchema.index({ issue_key: 1, received_at: -1 });

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = model('WebhookLog', WebhookLogSchema);
