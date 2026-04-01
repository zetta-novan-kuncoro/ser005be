// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const typeDef = require('./roadmap_phases/roadmap_phase.typedef');
const queryResolver = require('./roadmap_phases/roadmap_phase.query.resolver');
const mutationResolver = require('./roadmap_phases/roadmap_phase.mutation.resolver');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  typeDef,
  resolvers: [queryResolver, mutationResolver],
};
