// *************** IMPORT CORE ***************
'use strict';

const crypto = require('crypto');

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Generates a SHA-256 hash of the provided data after JSON-stringifying it.
 * Used to produce an immutable fingerprint for published changelog entries.
 *
 * @param {*} data - Any JSON-serializable value to hash
 * @returns {string} Hex-encoded SHA-256 digest
 */
function GenerateSha256(data) {
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(json, 'utf8').digest('hex');
}

// *************** EXPORT MODULE ***************
module.exports = { GenerateSha256 };
