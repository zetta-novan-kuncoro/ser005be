// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const ApiKeyModel = require('../features/api_key/api_keys/api_key.model');
const { DecryptApiKey } = require('../utils/crypto.util');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Express middleware that resolves an API key from the request and attaches
 * the matching DB record to `req.apiKey`.
 *
 * Accepts the key from:
 *  1. `Authorization: Bearer <key>` header
 *  2. `api_key` field in the request body
 *  3. `api_key` query parameter
 *
 * Does NOT throw on missing/invalid keys — the resolver is responsible for
 * asserting that `req.apiKey` is present when required.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function ApiKeyMiddleware(req, res, next) {
  try {
    // Attempt to extract the raw key from multiple sources
    const authHeader = req.headers['authorization'] || '';
    let rawKey = null;

    if (authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7).trim();
    } else if (req.body && req.body.api_key) {
      rawKey = req.body.api_key;
    } else if (req.query && req.query.api_key) {
      rawKey = req.query.api_key;
    }

    if (!rawKey) {
      req.apiKey = null;
      return next();
    }

    // API keys start with 'zbk_'; JWT tokens do not — skip if it looks like a JWT
    if (!rawKey.startsWith('zbk_')) {
      req.apiKey = null;
      return next();
    }

    // Derive the prefix (first 8 chars of the raw key, which already starts with zbk_)
    const prefix = rawKey.slice(0, 8);

    // Find candidate records by prefix
    const candidates = await ApiKeyModel.find({
      key_prefix: prefix,
      is_active: true,
    }).lean();

    let matchedRecord = null;
    for (const record of candidates) {
      try {
        const decrypted = DecryptApiKey(record.api_key_encrypted);
        if (decrypted === rawKey) {
          matchedRecord = record;
          break;
        }
      } catch (_) {
        // Decryption failure — skip this record
      }
    }

    if (!matchedRecord) {
      req.apiKey = null;
      return next();
    }

    // Validate expiry
    if (matchedRecord.expires_at && new Date(matchedRecord.expires_at) < new Date()) {
      req.apiKey = null;
      return next();
    }

    // Update last_used and last_used_ip asynchronously (fire-and-forget)
    ApiKeyModel.updateOne(
      { _id: matchedRecord._id },
      {
        $set: {
          last_used: new Date().toISOString(),
          last_used_ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        },
      }
    ).exec();

    req.apiKey = matchedRecord;
    return next();
  } catch (err) {
    console.error('[ApiKeyMiddleware] Error:', err.message);
    req.apiKey = null;
    return next();
  }
}

/**
 * Asserts that `context.apiKey` is populated and active.
 * Optionally validates that the key's application_reference matches the expected one.
 *
 * @param {{ apiKey: Object|null }} context - Apollo context
 * @param {Function} ThrowFormattedError - Error thrower from core/error.js
 * @param {string|null} [expectedReference=null] - Expected application_reference to match
 */
function AssertApiKey(context, ThrowFormattedError, expectedReference = null) {
  if (!context.apiKey) {
    ThrowFormattedError('UNAUTHENTICATED', 'Valid API key required.');
  }
  if (expectedReference && context.apiKey.application_reference !== expectedReference) {
    ThrowFormattedError('FORBIDDEN', 'API key does not have access to this application.');
  }
}

// *************** EXPORT MODULE ***************
module.exports = { ApiKeyMiddleware, AssertApiKey };
