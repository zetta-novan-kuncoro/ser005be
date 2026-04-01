// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const mongoose = require('mongoose');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const { Schema, model } = mongoose;

const ErrorLogSchema = new Schema(
  {
    error_id: { type: String, required: true, unique: true, index: true },
    timestamp: { type: String, required: true },
    error_code: { type: String, required: true },
    error_message: { type: String, required: true },
    source: {
      type: String,
      enum: ['JIRA', 'YouTrack', 'System'],
      required: true,
    },
    entity_type: { type: String, default: null },
    entity_id: { type: String, default: null },
    actor_type: { type: String, default: null },
    actor_id: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  {
    collection: 'error_logs',
  }
);

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = model('ErrorLog', ErrorLogSchema);
