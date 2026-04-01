// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { GetAdminChangelogs, GetChangelog, GetPublicChangelogs } = require('./changelog.helper');
const { AssertAdmin } = require('../../../middlewares/auth.middleware');
const { AssertApiKey } = require('../../../middlewares/api_key.middleware');
const { ThrowFormattedError } = require('../../../core/error');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  Query: {
    /**
     * @param {*} _
     * @param {{ filter: Object, pagination: Object, sort: Object }} args
     * @param {Object} context
     */
    GetAdminChangelogs: (_, { filter, pagination, sort }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetAdminChangelogs(filter, pagination, sort);
    },

    /**
     * @param {*} _
     * @param {{ entry_id: string }} args
     * @param {Object} context
     */
    GetChangelog: (_, { entry_id }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetChangelog(entry_id);
    },

    /**
     * @param {*} _
     * @param {{ application_reference: string, pagination: Object }} args
     * @param {Object} context
     */
    GetPublicChangelogs: (_, { application_reference, pagination }, context) => {
      AssertApiKey(context, ThrowFormattedError, application_reference);
      return GetPublicChangelogs(application_reference, pagination);
    },
  },
};
