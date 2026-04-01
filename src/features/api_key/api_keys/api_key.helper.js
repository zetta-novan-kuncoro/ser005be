// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const mongoose = require('mongoose');

// *************** IMPORT MODULE ***************
const ApiKeyModel = require('./api_key.model');
const { ValidateCreateApiKey } = require('./api_key.validator');
const { ThrowFormattedError } = require('../../../core/error');
const { GenerateApiKey, EncryptApiKey, DecryptApiKey } = require('../../../utils/crypto.util');
const { SerializeDates } = require('../../../utils/date.util');
const config = require('../../../core/config');

// *************** VARIABLES ***************
const KEY_PREFIX_LENGTH = 8;
const DEV_TEST_KEY_NAME = 'DEV Test Key';
const DEV_TEST_KEY_PURPOSE = 'dev_test';
const DEV_TEST_KEY_TTL_MINUTES = 10;
const ALLOWED_SORT_FIELDS_KEYS = ['name', 'application_reference', 'created_at', 'expires_at', 'last_used', 'is_active'];

// *************** FUNCTIONS ***************
/**
 * Returns all API keys for a given application reference, with optional sorting.
 *
 * @param {string} application_reference
 * @param {Object} [sort={}]
 * @param {string} [sort.field]
 * @param {string} [sort.order]
 * @returns {Promise<Array>}
 */
async function GetApiKeys(application_reference, sort = {}) {
  const sortField = ALLOWED_SORT_FIELDS_KEYS.includes(sort.field) ? sort.field : 'created_at';
  const sortOrder = sort.order === 'asc' ? 1 : -1;
  const records = await ApiKeyModel.find({
    application_reference,
    key_purpose: { $ne: DEV_TEST_KEY_PURPOSE },
  }).sort({ [sortField]: sortOrder }).lean();
  return SerializeDates(records);
}

/**
 * Returns all API keys across applications, with optional sorting.
 *
 * @param {Object} [sort={}]
 * @param {string} [sort.field]
 * @param {string} [sort.order]
 * @returns {Promise<Array>}
 */
async function GetAdminApiKeys(sort = {}) {
  const sortField = ALLOWED_SORT_FIELDS_KEYS.includes(sort.field) ? sort.field : 'created_at';
  const sortOrder = sort.order === 'asc' ? 1 : -1;
  const records = await ApiKeyModel.find({
    key_purpose: { $ne: DEV_TEST_KEY_PURPOSE },
  }).sort({ [sortField]: sortOrder }).lean();
  return SerializeDates(records);
}

/**
 * Creates a new API key for an application.
 * Returns the plain-text key ONCE alongside the stored record.
 * The raw key is never stored — only the encrypted form.
 *
 * @param {string} application_reference
 * @param {Object} input
 * @param {string} input.name
 * @param {string|null} [input.expires_at]
 * @returns {Promise<{ api_key: Object, plain_text_key: string }>}
 */
async function CreateApiKey(application_reference, input) {
  const { error, value } = ValidateCreateApiKey(input);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });

  const plainKey = GenerateApiKey();
  const keyPrefix = plainKey.slice(0, KEY_PREFIX_LENGTH);
  const encrypted = EncryptApiKey(plainKey);

  const record = await ApiKeyModel.create({
    application_reference,
    name: value.name,
    key_purpose: 'default',
    key_prefix: keyPrefix,
    api_key_encrypted: encrypted,
    expires_at: value.expires_at ? value.expires_at.toISOString() : null,
  });

  return {
    api_key: SerializeDates(record.toObject()),
    plain_text_key: plainKey,
  };
}

/**
 * Permanently deletes an API key by its MongoDB ID.
 *
 * @param {string} key_id
 * @returns {Promise<boolean>}
 */
async function DeleteApiKey(key_id) {
  if (!mongoose.isValidObjectId(key_id)) {
    ThrowFormattedError('BAD_USER_INPUT', 'Invalid API key ID.');
  }
  const result = await ApiKeyModel.deleteOne({ _id: key_id });
  if (result.deletedCount === 0) ThrowFormattedError('NOT_FOUND', 'API key not found.');
  return true;
}

/**
 * Sets is_active=false for a given API key.
 *
 * @param {string} key_id
 * @returns {Promise<Object>} Updated API key document
 */
async function DeactivateApiKey(key_id) {
  if (!mongoose.isValidObjectId(key_id)) {
    ThrowFormattedError('BAD_USER_INPUT', 'Invalid API key ID.');
  }
  const record = await ApiKeyModel.findByIdAndUpdate(
    key_id,
    { $set: { is_active: false } },
    { new: true }
  ).lean();
  if (!record) ThrowFormattedError('NOT_FOUND', 'API key not found.');
  return SerializeDates(record);
}

/**
 * Returns true when the provided ISO expiry string is still in the future.
 *
 * @param {string|null} expiresAt
 * @returns {boolean}
 */
function IsUnexpiredKey(expiresAt) {
  return Boolean(expiresAt && new Date(expiresAt) > new Date());
}

/**
 * Creates or reuses a short-lived DEV-only API key for testing embed-authenticated flows.
 *
 * @param {string} application_reference
 * @returns {Promise<{ api_key: Object, plain_text_key: string }>}
 */
async function CreateDevTestApiKey(application_reference) {
  if (config.isProduction) {
    ThrowFormattedError('FORBIDDEN', 'DEV test API keys are disabled in production.');
  }

  const existingKey = await ApiKeyModel.findOne({
    application_reference,
    key_purpose: DEV_TEST_KEY_PURPOSE,
    is_active: true,
  }).sort({ created_at: -1 }).lean();

  if (existingKey && IsUnexpiredKey(existingKey.expires_at)) {
    return {
      api_key: SerializeDates(existingKey),
      plain_text_key: DecryptApiKey(existingKey.api_key_encrypted),
    };
  }

  await ApiKeyModel.updateMany(
    {
      application_reference,
      key_purpose: DEV_TEST_KEY_PURPOSE,
      is_active: true,
    },
    { $set: { is_active: false } }
  );

  const plainKey = GenerateApiKey();
  const keyPrefix = plainKey.slice(0, KEY_PREFIX_LENGTH);
  const expiresAt = new Date(Date.now() + (DEV_TEST_KEY_TTL_MINUTES * 60 * 1000)).toISOString();
  const encrypted = EncryptApiKey(plainKey);

  const record = await ApiKeyModel.create({
    application_reference,
    name: DEV_TEST_KEY_NAME,
    key_purpose: DEV_TEST_KEY_PURPOSE,
    key_prefix: keyPrefix,
    api_key_encrypted: encrypted,
    expires_at: expiresAt,
  });

  return {
    api_key: SerializeDates(record.toObject()),
    plain_text_key: plainKey,
  };
}

// *************** EXPORT MODULE ***************
module.exports = {
  GetApiKeys,
  GetAdminApiKeys,
  CreateApiKey,
  CreateDevTestApiKey,
  DeleteApiKey,
  DeactivateApiKey,
};
