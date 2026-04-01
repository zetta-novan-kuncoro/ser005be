// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const typeDef = require('./documentation_versions/documentation_version.typedef');
const queryResolver = require('./documentation_versions/documentation_version.query.resolver');
const mutationResolver = require('./documentation_versions/documentation_version.mutation.resolver');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  typeDef,
  resolvers: [queryResolver, mutationResolver],
};
