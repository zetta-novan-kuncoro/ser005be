// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const mongoose = require('mongoose');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const { Schema, model } = mongoose;

const UserLogSchema = new Schema(
  {
    log_id: { type: String, required: true, unique: true, index: true },
    application_reference: { type: String, required: true, index: true },
    actor_type: {
      type: String,
      enum: ['Admin', 'User', 'PublicEmbedConsumer', 'System'],
      required: true,
    },
    actor_id: { type: String, default: null },
    actor_label: { type: String, default: null },
    action: { type: String, required: true },
    entity_type: { type: String, required: true },
    entity_id: { type: String, required: true },
    before_state: { type: Schema.Types.Mixed, default: null },
    after_state: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    created_at: { type: String, required: true },
  },
  {
    collection: 'user_logs',
  }
);

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = model('UserLog', UserLogSchema);
