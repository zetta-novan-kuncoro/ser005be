// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { GetRoadmapPhases, GetPublicRoadmap } = require('./roadmap_phase.helper');
const { AssertAdmin } = require('../../../middlewares/auth.middleware');
const { AssertApiKey } = require('../../../middlewares/api_key.middleware');
const { ThrowFormattedError } = require('../../../core/error');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  Query: {
    /**
     * @param {*} _
     * @param {{ application_reference: string }} args
     * @param {Object} context
     */
    GetRoadmapPhases: (_, { application_reference }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return GetRoadmapPhases(application_reference);
    },

    /**
     * @param {*} _
     * @param {{ application_reference: string }} args
     * @param {Object} context
     */
    GetPublicRoadmap: (_, { application_reference }, context) => {
      AssertApiKey(context, ThrowFormattedError, application_reference);
      return GetPublicRoadmap(application_reference);
    },
  },
};
