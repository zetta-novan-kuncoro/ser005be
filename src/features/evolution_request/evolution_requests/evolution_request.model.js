// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const mongoose = require('mongoose');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const { Schema, model } = mongoose;

const EvolutionRequestSchema = new Schema(
  {
    request_id: { type: String, required: true, unique: true, index: true },
    application_reference: { type: String, required: true, index: true },
    type: { type: String, enum: ['Evolution', 'Fix'], required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    submitted_by: { type: String, required: true },
    priority: { type: Number, enum: [1, 2, 3], required: true },
    expected_date: { type: String, default: null },
    attachments: { type: [String], default: [] },
    submitted_from_ip: { type: String, default: null, index: true },
    submitted_user_agent: { type: String, default: null },
    status: {
      type: String,
      enum: [
        'Pending',
        'Reviewed',
        'Approved',
        'Ready for Development',
        'In Development',
        'Testing & UAT',
        'Release',
        'Rejected',
      ],
      default: 'Pending',
    },
    phase_id: { type: String, default: null },
    submitted_at: { type: Date, default: Date.now },
    jira_issue_key: { type: String, default: null },
    jira_issue_url: { type: String, default: null },
    jira_sync_state: { type: String, enum: ['NOT_STARTED', 'PENDING', 'SUCCEEDED', 'FAILED'], default: 'NOT_STARTED' },
    jira_status_mirror: { type: String },
    jira_status_mirrored_at: { type: String },
    jira_last_attempt_at: { type: String },
    jira_last_error_code: { type: String },
    jira_last_error_message: { type: String },
    youtrack_issue_id: { type: String, default: null },
    youtrack_issue_url: { type: String, default: null },
    youtrack_sync_state: { type: String, enum: ['NOT_STARTED', 'PENDING', 'SUCCEEDED', 'FAILED'], default: 'NOT_STARTED' },
    youtrack_last_attempt_at: { type: String },
    youtrack_last_error_code: { type: String },
    youtrack_last_error_message: { type: String },
    integration_errors: {
      type: [
        {
          target: { type: String },
          message: { type: String },
          failed_at: { type: String },
          _id: false,
        },
      ],
      default: [],
    },
    released_in_entry_id: { type: String, default: null },
    released_at: { type: String, default: null },
    rejection_reason: { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'evolution_requests',
  }
);

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = model('EvolutionRequest', EvolutionRequestSchema);
