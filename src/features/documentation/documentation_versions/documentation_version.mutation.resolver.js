// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { GenerateDocumentationVersion } = require('./documentation_version.helper');
const { AssertAdmin } = require('../../../middlewares/auth.middleware');
const { ThrowFormattedError } = require('../../../core/error');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  Mutation: {
    /**
     * @param {*} _
     * @param {{ input: Object }} args
     * @param {Object} context
     */
    GenerateDocumentationVersion: (_, { input }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GenerateDocumentationVersion(input, context.user?.email);
    },
  },
};
