// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const typeDef = require('./users/user.typedef');
const queryResolver = require('./users/user.query.resolver');
const mutationResolver = require('./users/user.mutation.resolver');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  typeDef,
  resolvers: [queryResolver, mutationResolver],
};
