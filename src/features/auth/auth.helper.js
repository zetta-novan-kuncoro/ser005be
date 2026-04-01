// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// *************** IMPORT MODULE ***************
const UserModel = require('./users/user.model');
const { ValidateLogin, ValidateRegister } = require('./auth.validator');
const { ThrowFormattedError } = require('../../core/error');
const config = require('../../core/config');

// *************** VARIABLES ***************
const BCRYPT_ROUNDS = 12;

// *************** FUNCTIONS ***************
/**
 * Generates a signed JWT for the given user.
 *
 * @param {{ _id: *, email: string, role: string }} user - Mongoose user document or lean object
 * @returns {string} Signed JWT
 */
function GenerateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

/**
 * Authenticates a user by email and password.
 * Returns a JWT and a safe user object on success.
 * Throws INVALID_CREDENTIALS (401) on any failure — no enumeration.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, user: Object }>}
 */
async function LoginUser(email, password) {
  const { error } = ValidateLogin({ email, password });
  if (error) {
    ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });
  }

  const user = await UserModel.findOne({ email: email.toLowerCase().trim() }).lean();

  if (!user || !user.is_active) {
    ThrowFormattedError('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    ThrowFormattedError('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  // Update last_login without waiting for it to finish (fire-and-forget)
  UserModel.updateOne({ _id: user._id }, { $set: { last_login: new Date() } }).exec();

  const token = GenerateToken(user);

  return {
    token,
    user: {
      id: user._id.toString(),
      email: user.email,
      full_name: user.full_name || '',
      role: user.role,
      assigned_applications: user.assigned_applications || [],
    },
  };
}

/**
 * Fetches a user by their MongoDB ObjectId and returns a safe user object.
 * Throws UNAUTHENTICATED if the user is not found or inactive.
 *
 * @param {string} userId - MongoDB ObjectId string
 * @returns {Promise<Object>} Safe user object
 */
async function GetCurrentUser(userId) {
  const user = await UserModel.findOne({ _id: userId, is_active: true })
    .select('-password_hash')
    .lean();

  if (!user) {
    ThrowFormattedError('UNAUTHENTICATED', 'User not found or inactive.');
  }

  return {
    id: user._id.toString(),
    email: user.email,
    full_name: user.full_name || '',
    role: user.role,
    assigned_applications: user.assigned_applications || [],
  };
}

/**
 * Creates a new user after hashing the password.
 * Only callable on first-run bootstrap or in non-production environments.
 *
 * @param {Object} data
 * @param {string} data.email
 * @param {string} data.password
 * @param {string} [data.full_name]
 * @param {string} [data.role]
 * @returns {Promise<Object>} Safe user object (no token)
 */
async function RegisterUser(data) {
  const { error, value } = ValidateRegister(data);
  if (error) {
    ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });
  }

  const existing = await UserModel.findOne({ email: value.email }).lean();
  if (existing) {
    ThrowFormattedError('CONFLICT', `A user with email '${value.email}' already exists.`);
  }

  const password_hash = await bcrypt.hash(value.password, BCRYPT_ROUNDS);

  const user = await UserModel.create({
    email: value.email,
    password_hash,
    full_name: value.full_name || '',
    role: value.role || 'user',
  });

  return {
    id: user._id.toString(),
    email: user.email,
    full_name: user.full_name || '',
    role: user.role,
  };
}

// *************** EXPORT MODULE ***************
module.exports = { LoginUser, GetCurrentUser, RegisterUser, GenerateToken };
