// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const {
  CreateRoadmapPhase,
  UpdateRoadmapPhase,
  ReorderRoadmapPhases,
  DeleteRoadmapPhase,
} = require('./roadmap_phase.helper');
const { AssertAdmin } = require('../../../middlewares/auth.middleware');
const { ThrowFormattedError } = require('../../../core/error');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  Mutation: {
    /**
     * @param {*} _
     * @param {{ input: Object }} args
     * @param {Object} context
     */
    CreateRoadmapPhase: (_, { input }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return CreateRoadmapPhase(input);
    },

    /**
     * @param {*} _
     * @param {{ phase_id: string, input: Object }} args
     * @param {Object} context
     */
    UpdateRoadmapPhase: (_, { phase_id, input }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return UpdateRoadmapPhase(phase_id, input);
    },

    /**
     * @param {*} _
     * @param {{ application_reference: string, ordered_phase_ids: string[] }} args
     * @param {Object} context
     */
    ReorderRoadmapPhases: (_, { application_reference, ordered_phase_ids }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return ReorderRoadmapPhases(application_reference, ordered_phase_ids);
    },

    /**
     * @param {*} _
     * @param {{ phase_id: string }} args
     * @param {Object} context
     */
    DeleteRoadmapPhase: (_, { phase_id }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return DeleteRoadmapPhase(phase_id);
    },
  },
};
