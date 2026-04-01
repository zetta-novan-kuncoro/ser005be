// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { CreateUploadAuthorization, CompleteUpload } = require('./upload.helper');
const { ThrowFormattedError } = require('../../../core/error');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Asserts that either an admin user or a valid API key is present in context.
 * Used for mutations that support both admin and API key callers.
 *
 * @param {Object} context
 */
function AssertAdminOrApiKey(context) {
  const hasAdmin = context.user && context.user.role === 'admin';
  const hasApiKey = !!context.apiKey;
  if (!hasAdmin && !hasApiKey) {
    ThrowFormattedError('UNAUTHENTICATED', 'Admin session or valid API key required.');
  }
}

// *************** EXPORT MODULE ***************
module.exports = {
  Mutation: {
    /**
     * Accessible by admin users and API key holders.
     *
     * @param {*} _
     * @param {{ input: Object }} args
     * @param {Object} context
     */
    CreateUploadAuthorization: (_, { input }, context) => {
      AssertAdminOrApiKey(context);
      return CreateUploadAuthorization(input, context);
    },

    /**
     * Accessible by admin users and API key holders.
     *
     * @param {*} _
     * @param {{ input: Object }} args
     * @param {Object} context
     */
    CompleteUpload: (_, { input }, context) => {
      AssertAdminOrApiKey(context);
      return CompleteUpload(input, context);
    },
  },
};
