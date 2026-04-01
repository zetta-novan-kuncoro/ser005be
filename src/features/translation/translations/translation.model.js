// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const mongoose = require('mongoose');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const { Schema, model } = mongoose;

const TranslationSchema = new Schema(
  {
    key: { type: String, required: true, index: true },
    namespace: { type: String, required: true, index: true },
    en: { type: String, default: '' },
    fr: { type: String, default: '' },
    es: { type: String, default: '' },
    id: { type: String, default: '' },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'translations',
  }
);

// *************** FUNCTIONS ***************
TranslationSchema.index({ key: 1, namespace: 1 }, { unique: true });

// *************** EXPORT MODULE ***************
module.exports = model('Translation', TranslationSchema);
