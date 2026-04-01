// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { CreateChangelog, CreateChangelogRevision, UpdateChangelog, PublishChangelog } = require('./changelog.helper');
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
    CreateChangelog: (_, { input }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return CreateChangelog(input, context.user?.email);
    },

    /**
     * @param {*} _
     * @param {{ entry_id: string, input: Object }} args
     * @param {Object} context
     */
    CreateChangelogRevision: (_, { entry_id, input }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return CreateChangelogRevision(entry_id, input, context.user?.email);
    },

    /**
     * @param {*} _
     * @param {{ entry_id: string, input: Object }} args
     * @param {Object} context
     */
    UpdateChangelog: (_, { entry_id, input }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return UpdateChangelog(entry_id, input, context.user?.email);
    },

    /**
     * @param {*} _
     * @param {{ entry_id: string }} args
     * @param {Object} context
     */
    PublishChangelog: (_, { entry_id, released_request_ids }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return PublishChangelog(entry_id, context.user?.email, released_request_ids);
    },
  },
};
