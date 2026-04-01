// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { GetDocumentationVersions } = require('./documentation_version.helper');
const { AssertAdmin } = require('../../../middlewares/auth.middleware');
const { ThrowFormattedError } = require('../../../core/error');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  Query: {
    /**
     * @param {*} _
     * @param {{ pagination: Object }} args
     * @param {Object} context
     */
    GetDocumentationVersions: (_, { pagination }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetDocumentationVersions(pagination);
    },
  },
};
