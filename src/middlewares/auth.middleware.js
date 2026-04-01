// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { ThrowFormattedError } = require('../core/error');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Asserts that the current Apollo context has an authenticated admin user.
 * Throws UNAUTHENTICATED if no user is present; FORBIDDEN_ACTION if the user
 * is not an admin. Called inside resolvers — not an Express middleware.
 *
 * @param {{ user: { id: string, email: string, role: string }|null }} context - Apollo context object
 * @param {Function} ThrowFn - Error thrower from core/error.js
 */
function AssertAdmin(context, ThrowFn) {
  if (!context.user) {
    ThrowFn('UNAUTHENTICATED', 'Authentication required.');
  }
  if (context.user.role !== 'admin') {
    ThrowFn('FORBIDDEN_ACTION', 'Admin access required.');
  }
}

/**
 * Asserts that the current Apollo context has an authenticated user (any role).
 * Throws UNAUTHENTICATED if no user is present. Called inside resolvers — not
 * an Express middleware.
 *
 * @param {{ user: { id: string, email: string, role: string }|null }} context - Apollo context object
 * @param {Function} ThrowFn - Error thrower from core/error.js
 */
function AssertAuthenticated(context, ThrowFn) {
  if (!context.user) {
    ThrowFn('UNAUTHENTICATED', 'Authentication required.');
  }
}

// *************** EXPORT MODULE ***************
module.exports = { AssertAdmin, AssertAuthenticated };
