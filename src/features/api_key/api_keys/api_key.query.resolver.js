// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { GetApiKeys, GetAdminApiKeys } = require('./api_key.helper');
const { AssertAdmin } = require('../../../middlewares/auth.middleware');
const { ThrowFormattedError } = require('../../../core/error');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  Query: {
    /**
     * @param {*} _
     * @param {{ application_reference: string, sort: Object }} args
     * @param {Object} context
     */
    GetApiKeys: (_, { application_reference, sort }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetApiKeys(application_reference, sort);
    },

    /**
     * @param {*} _
     * @param {{ sort: Object }} args
     * @param {Object} context
     */
    GetAdminApiKeys: (_, { sort }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetAdminApiKeys(sort);
    },
  },
};
