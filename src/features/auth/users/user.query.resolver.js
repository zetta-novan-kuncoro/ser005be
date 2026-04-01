// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { GetCurrentUser } = require('../auth.helper');
const { AssertAuthenticated } = require('../../../middlewares/auth.middleware');
const { ThrowFormattedError } = require('../../../core/error');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  Query: {
    /**
     * Returns the currently authenticated user's profile.
     * Requires a valid JWT — throws UNAUTHENTICATED if missing or invalid.
     *
     * @param {*} _ - Parent (unused)
     * @param {Object} _args - Arguments (unused)
     * @param {Object} context - Apollo context containing `user`
     * @returns {Promise<Object>} Safe user object
     */
    Me: (_, _args, context) => {
      AssertAuthenticated(context, ThrowFormattedError);
      return GetCurrentUser(context.user.id);
    },
  },
};
