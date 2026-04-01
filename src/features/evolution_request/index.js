// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const typeDef = require('./evolution_requests/evolution_request.typedef');
const queryResolver = require('./evolution_requests/evolution_request.query.resolver');
const mutationResolver = require('./evolution_requests/evolution_request.mutation.resolver');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  typeDef,
  resolvers: [queryResolver, mutationResolver],
};
