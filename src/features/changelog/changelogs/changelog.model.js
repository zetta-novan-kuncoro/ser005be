// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const mongoose = require('mongoose');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const { Schema, model } = mongoose;

const ChangelogTicketSchema = new Schema(
  {
    ticket_id: { type: String, default: '' },
    ticket_ref: { type: String, default: '' },
    ticket_name: { type: String, default: '' },
    ticket_url: { type: String, default: '' },
  },
  { _id: false }
);

const ChangelogSchema = new Schema(
  {
    entry_id: { type: String, required: true, unique: true, index: true },
    entry_group_id: { type: String, required: true, index: true },
    revision_number: { type: Number, required: true, default: 1 },
    previous_entry_id: { type: String, default: null },
    application_reference: { type: String, required: true, index: true },
    version: { type: String, required: true },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    details_md: { type: String, default: '' },
    change_type: {
      type: String,
      enum: ['Feature', 'Fix', 'Breaking', 'Security', 'Performance', 'Ops', 'Compliance'],
      required: true,
    },
    impact_scope: {
      type: String,
      enum: ['UI', 'API', 'Data', 'Infra', 'Mixed'],
      required: true,
    },
    release_date: { type: String, required: true },
    status: {
      type: String,
      enum: ['Draft', 'Published', 'Deprecated', 'RolledBack'],
      default: 'Draft',
    },
    visibility: {
      type: String,
      enum: ['PublicToCustomers', 'InternalOnly'],
      default: 'InternalOnly',
    },
    tags: { type: [String], default: [] },
    tickets: { type: [ChangelogTicketSchema], default: [] },
    attachments: { type: [String], default: [] },
    immutable_s3_key: { type: String, default: null },
    immutable_sha256: { type: String, default: null },
    published_at: { type: String, default: null },
    created_by: { type: String, default: null },
    updated_by: { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'changelogs',
  }
);

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = model('Changelog', ChangelogSchema);
