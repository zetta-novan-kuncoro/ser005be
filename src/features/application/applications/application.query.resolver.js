// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const {
  GetApplications,
  GetApplication,
  GetApplicationUsers,
  GetEmbedInstructions,
} = require('./application.helper');
const { AssertAdmin } = require('../../../middlewares/auth.middleware');
const { ThrowFormattedError } = require('../../../core/error');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  Query: {
    /**
     * @param {*} _ - Parent (unused)
     * @param {{ filter: Object, pagination: Object, sort: Object }} args
     * @param {Object} context - Apollo context with req
     */
    GetApplications: (_, { filter, pagination, sort }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetApplications(filter, pagination, sort);
    },

    /**
     * @param {*} _
     * @param {{ reference: string }} args
     * @param {Object} context
     */
    GetApplication: (_, { reference }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetApplication(reference);
    },

    /**
     * @param {*} _
     * @param {{ reference: string }} args
     * @param {Object} context
     */
    GetApplicationUsers: (_, { reference }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetApplicationUsers(reference);
    },

    /**
     * @param {*} _
     * @param {{ application_reference: string }} args
     * @param {Object} context
     */
    GetEmbedInstructions: (_, { application_reference }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetEmbedInstructions(application_reference);
    },
  },
};
