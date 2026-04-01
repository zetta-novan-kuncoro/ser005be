// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { LoginUser, RegisterUser } = require('../auth.helper');
const UserModel = require('./user.model');
const { ThrowFormattedError } = require('../../../core/error');
const config = require('../../../core/config');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  Mutation: {
    /**
     * Authenticates a user by email and password.
     * Returns a signed JWT and the user object on success.
     * No authentication required.
     *
     * @param {*} _ - Parent (unused)
     * @param {{ input: { email: string, password: string } }} args
     * @param {Object} _context - Apollo context (unused for this public mutation)
     * @returns {Promise<{ token: string, user: Object }>}
     */
    Login: (_, { input }) => {
      return LoginUser(input.email, input.password);
    },

    /**
     * Stateless JWT logout. The client must discard the token.
     * Always returns true — no server-side token invalidation.
     *
     * @param {*} _ - Parent (unused)
     * @param {Object} _args - Arguments (unused)
     * @param {Object} _context - Apollo context (unused)
     * @returns {boolean}
     */
    Logout: (_, _args, _context) => {
      return true;
    },

    /**
     * Creates a new user. Only available in non-production environments
     * or in production when zero users exist (first-run bootstrap).
     * Throws FORBIDDEN_ACTION if called in production with existing users.
     *
     * @param {*} _ - Parent (unused)
     * @param {{ input: { email: string, password: string, full_name?: string, role?: string } }} args
     * @param {Object} _context - Apollo context (unused)
     * @returns {Promise<{ user: Object }>}
     */
    Register: async (_, { input }) => {
      if (config.isProduction) {
        const userCount = await UserModel.countDocuments();
        if (userCount > 0) {
          ThrowFormattedError(
            'FORBIDDEN_ACTION',
            'Registration is disabled in production after initial setup.'
          );
        }
      }

      const user = await RegisterUser(input);
      return { user };
    },
  },
};
