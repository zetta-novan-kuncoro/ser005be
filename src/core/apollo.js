// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { ApolloServer } = require('@apollo/server');
const depthLimit = require('graphql-depth-limit');
const jwt = require('jsonwebtoken');

// *************** IMPORT MODULE ***************
const config = require('./config');
const { typeDefs, resolvers } = require('../features');
const UserModel = require('../features/auth/users/user.model');

// *************** VARIABLES ***************
const MAX_QUERY_DEPTH = 7;

// *************** FUNCTIONS ***************
/**
 * Builds and returns a configured Apollo Server 4 instance.
 * - Enforces query depth limit of 7
 * - Disables introspection in production
 * - Sanitizes stack traces in production via formatError
 *
 * @returns {ApolloServer} Configured Apollo Server instance
 */
function BuildApolloServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    validationRules: [depthLimit(MAX_QUERY_DEPTH)],
    introspection: !config.isProduction,
    formatError: (formattedError, error) => {
      // Suppress known client errors from server-side logging
      const code = formattedError.extensions?.code;
      const suppressedCodes = ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR'];
      if (!suppressedCodes.includes(code)) {
        console.error('[GraphQL] Unhandled error:', {
          message: formattedError.message,
          code,
          path: formattedError.path,
          error,
        });
      }

      if (config.isProduction) {
        const { stacktrace, ...safeExtensions } = formattedError.extensions || {};
        return {
          message: formattedError.message,
          locations: formattedError.locations,
          path: formattedError.path,
          extensions: safeExtensions,
        };
      }
      return formattedError;
    },
  });
  return server;
}

/**
 * Builds the Apollo context object from the incoming Express request.
 * Resolves a JWT Bearer token to an authenticated user (if valid and active).
 * API key resolution is handled by the Express ApiKeyMiddleware upstream and
 * passed through via req.apiKey.
 *
 * @param {{ req: import('express').Request }} param0
 * @returns {Promise<{ user: Object|null, apiKey: Object|null }>}
 */
async function BuildApolloContext({ req }) {
  let user = null;
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0].trim()
      : req.ip || null;

  const authHeader = req.headers.authorization || '';

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();

    // Only attempt JWT verification if the token does not look like an API key.
    // API keys begin with 'zbk_' and are handled by ApiKeyMiddleware separately.
    if (token && !token.startsWith('zbk_')) {
      try {
        const decoded = jwt.verify(token, config.jwt.secret);
        const dbUser = await UserModel.findOne({ _id: decoded.id, is_active: true })
          .select('_id email role assigned_applications')
          .lean();

        if (dbUser) {
          user = {
            id: dbUser._id.toString(),
            email: dbUser.email,
            role: dbUser.role,
            assigned_applications: dbUser.assigned_applications || [],
          };
        }
      } catch (_) {
        // Invalid or expired token — user remains null.
        // The resolver's guard (AssertAuthenticated / AssertAdmin) will throw.
      }
    }
  }

  return {
    user,
    apiKey: req.apiKey || null,
    requestMeta: {
      ip,
      userAgent: req.headers['user-agent'] || null,
    },
  };
}

// *************** EXPORT MODULE ***************
module.exports = { BuildApolloServer, BuildApolloContext };
