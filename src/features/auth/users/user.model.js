// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const mongoose = require('mongoose');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const { Schema, model } = mongoose;

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password_hash: { type: String, required: true },
    full_name: { type: String, trim: true, default: '' },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    assigned_applications: [{ type: String }],
    is_active: { type: Boolean, default: true },
    last_login: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'users',
  }
);

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = model('User', UserSchema);
