// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const {
  SubmitEvolutionRequest,
  AdminUpdateEvolutionRequest,
  UpdateEvolutionRequestStatus,
  ReviewEvolutionRequest,
  ApproveEvolutionRequest,
  RejectEvolutionRequest,
  RetryEvolutionRequestIntegrations,
  AssignEvolutionRequestPhase,
  UnassignEvolutionRequestPhase,
  RefreshEvolutionRequestExternalStatus,
} = require('./evolution_request.helper');
const { AssertAdmin } = require('../../../middlewares/auth.middleware');
const { AssertApiKey } = require('../../../middlewares/api_key.middleware');
const { ThrowFormattedError } = require('../../../core/error');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  Mutation: {
    /**
     * API key auth: end users submit evolution/fix requests from the embed widget.
     * Status is always forced to Pending regardless of input.
     *
     * @param {*} _
     * @param {{ input: Object }} args
     * @param {Object} context
     */
    SubmitEvolutionRequest: (_, { input }, context) => {
      AssertApiKey(context, ThrowFormattedError, input.application_reference);
      return SubmitEvolutionRequest(input, context.requestMeta);
    },

    /**
     * @param {*} _
     * @param {{ request_id: string, input: Object }} args
     * @param {Object} context
     */
    AdminUpdateEvolutionRequest: (_, { request_id, input }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return AdminUpdateEvolutionRequest(request_id, input, {
        id: context.user?.id || null,
        label: context.user?.email || 'Admin',
      });
    },

    /**
     * @param {*} _
     * @param {{ request_id: string, status: string }} args
     * @param {Object} context
     */
    UpdateEvolutionRequestStatus: (_, { request_id, status }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return UpdateEvolutionRequestStatus(request_id, status, context.user?.id);
    },

    /**
     * @param {*} _
     * @param {{ request_id: string }} args
     * @param {Object} context
     */
    ReviewEvolutionRequest: (_, { request_id }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return ReviewEvolutionRequest(request_id, context.user?.id);
    },

    /**
     * @param {*} _
     * @param {{ request_id: string }} args
     * @param {Object} context
     */
    ApproveEvolutionRequest: (_, { request_id }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return ApproveEvolutionRequest(request_id, context.user?.id);
    },

    /**
     * @param {*} _
     * @param {{ request_id: string, rejection_reason?: string }} args
     * @param {Object} context
     */
    RejectEvolutionRequest: (_, { request_id, rejection_reason }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return RejectEvolutionRequest(request_id, rejection_reason || null, context.user?.id);
    },

    /**
     * @param {*} _
     * @param {{ request_id: string }} args
     * @param {Object} context
     */
    RetryEvolutionRequestIntegrations: (_, { request_id }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return RetryEvolutionRequestIntegrations(request_id, context.user?.id);
    },

    /**
     * @param {*} _
     * @param {{ request_id: string, phase_id: string }} args
     * @param {Object} context
     */
    AssignEvolutionRequestPhase: (_, { request_id, phase_id }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return AssignEvolutionRequestPhase(request_id, phase_id);
    },

    /**
     * @param {*} _
     * @param {{ request_id: string }} args
     * @param {Object} context
     */
    UnassignEvolutionRequestPhase: (_, { request_id }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return UnassignEvolutionRequestPhase(request_id);
    },

    /**
     * Admin-only: performs an on-demand GET to JIRA and updates jira_status_mirror.
     *
     * @param {*} _
     * @param {{ request_id: string }} args
     * @param {Object} context
     */
    RefreshEvolutionRequestExternalStatus: (_, { request_id }, context) => {
      AssertAdmin(context, ThrowFormattedError);
      return RefreshEvolutionRequestExternalStatus(request_id, context.user?.id);
    },
  },
};
