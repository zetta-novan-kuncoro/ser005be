// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { GetTranslations, GetTranslation } = require('./translation.helper');
const { AssertAdmin } = require('../../../middlewares/auth.middleware');
const { ThrowFormattedError } = require('../../../core/error');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  Query: {
    /**
     * Public endpoint — no auth required.
     *
     * @param {*} _
     * @param {{ namespace: string, search: string, pagination: Object }} args
     * @param {Object} context
     */
    GetTranslations: (_, { namespace, search, pagination }) => {
      return GetTranslations(namespace, search, pagination);
    },

    /**
     * Admin auth required.
     *
     * @param {*} _
     * @param {{ key: string, namespace: string }} args
     * @param {Object} context
     */
    GetTranslation: (_, { key, namespace }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetTranslation(key, namespace);
    },
  },
};
