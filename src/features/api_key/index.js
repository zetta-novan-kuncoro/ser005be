// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const typeDef = require('./api_keys/api_key.typedef');
const queryResolver = require('./api_keys/api_key.query.resolver');
const mutationResolver = require('./api_keys/api_key.mutation.resolver');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  typeDef,
  resolvers: [queryResolver, mutationResolver],
};
