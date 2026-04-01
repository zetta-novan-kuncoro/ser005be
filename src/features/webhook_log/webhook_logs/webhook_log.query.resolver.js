// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { GetAdminWebhookLogs } = require('./webhook_log.helper');
const { AssertAdmin } = require('../../../middlewares/auth.middleware');
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
    GetAdminWebhookLogs: (_, { filter, pagination, sort }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetAdminWebhookLogs(filter, pagination, sort);
    },
  },
};
