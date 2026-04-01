// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { CreateApiKey, CreateDevTestApiKey, DeleteApiKey, DeactivateApiKey } = require('./api_key.helper');
const { AssertAdmin } = require('../../../middlewares/auth.middleware');
const { ThrowFormattedError } = require('../../../core/error');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  Mutation: {
    /**
     * @param {*} _
     * @param {{ application_reference: string, input: Object }} args
     * @param {Object} context
     */
    CreateApiKey: (_, { application_reference, input }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return CreateApiKey(application_reference, input);
    },

    /**
     * @param {*} _
     * @param {{ application_reference: string }} args
     * @param {Object} context
     */
    CreateDevTestApiKey: (_, { application_reference }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return CreateDevTestApiKey(application_reference);
    },

    /**
     * @param {*} _
     * @param {{ key_id: string }} args
     * @param {Object} context
     */
    DeleteApiKey: (_, { key_id }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return DeleteApiKey(key_id);
    },

    /**
     * @param {*} _
     * @param {{ key_id: string }} args
     * @param {Object} context
     */
    DeactivateApiKey: (_, { key_id }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return DeactivateApiKey(key_id);
    },
  },
};
