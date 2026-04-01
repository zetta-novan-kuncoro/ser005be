// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const {
  CreateApplication,
  UpdateApplication,
  DeleteApplication,
  AssignUsersToApplication,
} = require('./application.helper');
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
    CreateApplication: (_, { input }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return CreateApplication(input);
    },

    /**
     * @param {*} _
     * @param {{ reference: string, input: Object }} args
     * @param {Object} context
     */
    UpdateApplication: (_, { reference, input }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return UpdateApplication(reference, input);
    },

    /**
     * @param {*} _
     * @param {{ reference: string }} args
     * @param {Object} context
     */
    DeleteApplication: (_, { reference }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return DeleteApplication(reference);
    },

    /**
     * @param {*} _
     * @param {{ reference: string, owners: Array }} args
     * @param {Object} context
     */
    AssignUsersToApplication: (_, { reference, owners }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return AssignUsersToApplication(reference, owners);
    },
  },
};
