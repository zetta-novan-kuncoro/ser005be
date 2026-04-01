// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { ApolloError } = require('apollo-server-errors');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Throws a standardized Apollo error with a code, message, and optional metadata.
 * All resolvers and helpers MUST use this instead of throwing raw errors.
 *
 * @param {string} code - Machine-readable error code (e.g. 'NOT_FOUND', 'FORBIDDEN')
 * @param {string} message - Human-readable error message
 * @param {Object} [metadata={}] - Additional metadata attached to the error extensions
 * @throws {ApolloError}
 */
function ThrowFormattedError(code, message, metadata = {}) {
  throw new ApolloError(message, code, { ...metadata });
}

// *************** EXPORT MODULE ***************
module.exports = { ThrowFormattedError };
