// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const typeDef = require('./applications/application.typedef');
const queryResolver = require('./applications/application.query.resolver');
const mutationResolver = require('./applications/application.mutation.resolver');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  typeDef,
  resolvers: [queryResolver, mutationResolver],
};
