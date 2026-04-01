// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const bcrypt = require('bcryptjs');

// *************** IMPORT MODULE ***************
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../core/config');
const UserModel = require('../features/auth/users/user.model');

// *************** VARIABLES ***************
const DEFAULT_EMAIL = 'admin@changelog.internal';
const DEFAULT_PASSWORD = 'Admin1234!';
const BCRYPT_ROUNDS = 12;

// *************** FUNCTIONS ***************
/**
 * One-time script to seed the initial admin user.
 * Creates admin@changelog.internal / Admin1234! if no users exist.
 * Safe to re-run — exits without error if a user already exists.
 *
 * Usage:
 *   node src/scripts/seed_admin.js
 *
 * @returns {Promise<void>}
 */
async function SeedAdmin() {
  console.log('[SeedAdmin] Connecting to MongoDB...');
  await mongoose.connect(config.mongo.uri);
  console.log('[SeedAdmin] Connected.');

  const existingCount = await UserModel.countDocuments();

  if (existingCount > 0) {
    console.log(`[SeedAdmin] ${existingCount} user(s) already exist. Skipping seed.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  const admin = await UserModel.create({
    email: DEFAULT_EMAIL,
    password_hash,
    full_name: 'Admin',
    role: 'admin',
    assigned_applications: [],
    is_active: true,
  });

  console.log('[SeedAdmin] Admin user created successfully:');
  console.log(`  ID:    ${admin._id}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Role:  ${admin.role}`);
  console.log('[SeedAdmin] Login with the default credentials and change the password immediately.');

  await mongoose.disconnect();
  process.exit(0);
}

// *************** EXPORT MODULE ***************
SeedAdmin().catch((err) => {
  console.error('[SeedAdmin] Fatal error:', err);
  process.exit(1);
});
