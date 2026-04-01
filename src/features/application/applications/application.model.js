// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const mongoose = require('mongoose');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const { Schema, model } = mongoose;

const OwnerSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, required: true },
  },
  { _id: false }
);

const ApplicationSchema = new Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['COR-A', 'COR-B', 'SAT', 'INT-ADMIN', 'INT-TECH', 'SER'],
      required: true,
    },
    reference: { type: String, required: true, unique: true, index: true },
    environment: {
      type: String,
      enum: ['dev', 'staging', 'prod'],
      required: true,
    },
    description: { type: String, default: '' },
    active: { type: Boolean, default: true },
    icon: { type: String, default: '' },
    tenant_scope: {
      type: String,
      enum: ['global', 'tenant-specific'],
      default: 'global',
    },
    owners: { type: [OwnerSchema], default: [] },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'applications',
  }
);

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = model('Application', ApplicationSchema);
