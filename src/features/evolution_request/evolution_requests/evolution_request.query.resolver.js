// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const {
  GetAdminEvolutionRequests,
  GetEvolutionRequest,
  GetPublicEvolutionRequests,
} = require('./evolution_request.helper');
const { GetAdminErrorLogs } = require('../../error_log/error_logs/error_log.helper');
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
    GetAdminEvolutionRequests: (_, { filter, pagination, sort }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetAdminEvolutionRequests(filter, pagination, sort);
    },

    /**
     * @param {*} _
     * @param {{ request_id: string }} args
     * @param {Object} context
     */
    GetEvolutionRequest: (_, { request_id }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetEvolutionRequest(request_id);
    },

    /**
     * @param {*} _
     * @param {{ application_reference: string, filter: Object, pagination: Object, sort: Object }} args
     * @param {Object} context
     */
    GetPublicEvolutionRequests: (_, { application_reference, filter, pagination, sort }, context) => {
      AssertApiKey(context, ThrowFormattedError, application_reference);
      return GetPublicEvolutionRequests(application_reference, filter, pagination, sort);
    },

    /**
     * Admin-only: returns recent error log entries (JIRA/YouTrack/System failures).
     *
     * @param {*} _
     * @param {{ limit: number, offset: number }} args
     * @param {Object} context
     */
    AdminErrorLogs: (_, { limit, offset }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetAdminErrorLogs(limit, offset);
    },
  },
};
