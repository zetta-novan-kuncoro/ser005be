// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const mongoose = require('mongoose');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const { Schema, model } = mongoose;

const ApiKeySchema = new Schema(
  {
    application_reference: { type: String, required: true, index: true },
    name: { type: String, required: true },
    key_purpose: { type: String, enum: ['default', 'dev_test'], default: 'default', index: true },
    key_prefix: { type: String, required: true, index: true },
    api_key_encrypted: { type: String, required: true },
    expires_at: { type: String, default: null },
    last_used: { type: String, default: null },
    last_used_ip: { type: String, default: null },
    is_active: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'api_keys',
  }
);

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = model('ApiKey', ApiKeySchema);
