// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const mongoose = require('mongoose');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const { Schema, model } = mongoose;

const DocumentationVersionSchema = new Schema(
  {
    document_id: { type: String, required: true, unique: true, index: true },
    version: { type: String, required: true },
    generated_at: { type: String, default: () => new Date().toISOString() },
    s3_key: { type: String, required: true },
    filename: { type: String, required: true },
    generated_by: { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'documentation_versions',
  }
);

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = model('DocumentationVersion', DocumentationVersionSchema);
