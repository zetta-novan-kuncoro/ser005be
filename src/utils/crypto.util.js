// *************** IMPORT CORE ***************
'use strict';

const crypto = require('crypto');

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const config = require('../core/config');

// *************** VARIABLES ***************
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;
const KEY_PREFIX = 'zbk_';
const RAW_KEY_LENGTH = 32; // bytes → 256-bit

// *************** FUNCTIONS ***************
/**
 * Returns a 32-byte Buffer derived from the configured encryption key.
 * Pads or truncates to exactly 32 bytes.
 *
 * @returns {Buffer}
 */
function _getKeyBuffer() {
  const rawKey = config.encryption.key || '';
  return Buffer.from(rawKey.padEnd(32, '0').slice(0, 32), 'utf8');
}

/**
 * Encrypts a plain-text API key using AES-256-GCM.
 * Returns a colon-delimited string: `iv:authTag:ciphertext` (all hex-encoded).
 *
 * @param {string} plainText - The plain-text value to encrypt
 * @returns {string} Encrypted string in the format `iv:authTag:ciphertext`
 */
function EncryptApiKey(plainText) {
  const key = _getKeyBuffer();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string produced by {@link EncryptApiKey}.
 *
 * @param {string} encryptedStr - The encrypted string in the format `iv:authTag:ciphertext`
 * @returns {string} The decrypted plain-text value
 */
function DecryptApiKey(encryptedStr) {
  const [ivHex, authTagHex, ciphertextHex] = encryptedStr.split(':');
  const key = _getKeyBuffer();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Generates a cryptographically secure API key with the `zbk_` prefix.
 * The key is 64 hex characters (32 random bytes) prefixed.
 *
 * @returns {string} A new API key e.g. `zbk_a1b2c3d4...`
 */
function GenerateApiKey() {
  const randomPart = crypto.randomBytes(RAW_KEY_LENGTH).toString('hex');
  return `${KEY_PREFIX}${randomPart}`;
}

// *************** EXPORT MODULE ***************
module.exports = { EncryptApiKey, DecryptApiKey, GenerateApiKey };
