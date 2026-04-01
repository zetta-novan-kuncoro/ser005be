// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { CreateTranslation, UpdateTranslation, DeleteTranslation } = require('./translation.helper');
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
    CreateTranslation: (_, { input }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return CreateTranslation(input);
    },

    /**
     * @param {*} _
     * @param {{ key: string, namespace: string, input: Object }} args
     * @param {Object} context
     */
    UpdateTranslation: (_, { key, namespace, input }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return UpdateTranslation(key, namespace, input);
    },

    /**
     * @param {*} _
     * @param {{ key: string, namespace: string }} args
     * @param {Object} context
     */
    DeleteTranslation: (_, { key, namespace }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return DeleteTranslation(key, namespace);
    },
  },
};
