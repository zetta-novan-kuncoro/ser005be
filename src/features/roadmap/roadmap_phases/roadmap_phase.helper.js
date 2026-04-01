// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { v4: uuidv4 } = require('uuid');

// *************** IMPORT MODULE ***************
const RoadmapPhaseModel = require('./roadmap_phase.model');
const { ValidateCreateRoadmapPhase, ValidateUpdateRoadmapPhase } = require('./roadmap_phase.validator');
const { ThrowFormattedError } = require('../../../core/error');
const EvolutionRequestModel = require('../../evolution_request/evolution_requests/evolution_request.model');
const { SerializeDates } = require('../../../utils/date.util');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Returns all roadmap phases for an application sorted by order.
 *
 * @param {string} application_reference
 * @returns {Promise<Array>}
 */
async function GetRoadmapPhases(application_reference) {
  const phases = await RoadmapPhaseModel.find({ application_reference }).sort({ order: 1 }).lean();
  return SerializeDates(phases);
}

/**
 * Returns all roadmap phases for public consumption (API key auth).
 *
 * @param {string} application_reference
 * @returns {Promise<Array>}
 */
async function GetPublicRoadmap(application_reference) {
  const phases = await RoadmapPhaseModel.find({ application_reference }).sort({ order: 1 }).lean();
  return SerializeDates(phases);
}

/**
 * Creates a new roadmap phase with a generated UUID phase_id.
 *
 * @param {Object} input
 * @returns {Promise<Object>}
 */
async function CreateRoadmapPhase(input) {
  const { error, value } = ValidateCreateRoadmapPhase(input);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });

  const phase = await RoadmapPhaseModel.create({
    ...value,
    phase_id: uuidv4(),
  });

  return SerializeDates(phase.toObject());
}

/**
 * Updates an existing roadmap phase.
 *
 * @param {string} phase_id
 * @param {Object} input
 * @returns {Promise<Object>}
 */
async function UpdateRoadmapPhase(phase_id, input) {
  const { error, value } = ValidateUpdateRoadmapPhase(input);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });

  const phase = await RoadmapPhaseModel.findOneAndUpdate(
    { phase_id },
    { $set: value },
    { new: true, runValidators: true }
  ).lean();

  if (!phase) ThrowFormattedError('NOT_FOUND', `Roadmap phase '${phase_id}' not found.`);
  return SerializeDates(phase);
}

/**
 * Bulk-updates the order of roadmap phases according to the provided ordered list.
 * Returns the reordered phases sorted by new order.
 *
 * @param {string} application_reference
 * @param {string[]} ordered_phase_ids
 * @returns {Promise<Array>}
 */
async function ReorderRoadmapPhases(application_reference, ordered_phase_ids) {
  const bulkOps = ordered_phase_ids.map((phase_id, index) => ({
    updateOne: {
      filter: { phase_id, application_reference },
      update: { $set: { order: index } },
    },
  }));

  if (bulkOps.length > 0) {
    await RoadmapPhaseModel.bulkWrite(bulkOps);
  }

  const phases = await RoadmapPhaseModel.find({ application_reference }).sort({ order: 1 }).lean();
  return SerializeDates(phases);
}

/**
 * Deletes a roadmap phase and bulk-unsets phase_id on all linked evolution requests.
 *
 * @param {string} phase_id
 * @returns {Promise<boolean>}
 */
async function DeleteRoadmapPhase(phase_id) {
  const phase = await RoadmapPhaseModel.findOne({ phase_id }).lean();
  if (!phase) ThrowFormattedError('NOT_FOUND', `Roadmap phase '${phase_id}' not found.`);

  // First bulk-update all linked evolution requests to unset phase_id
  await EvolutionRequestModel.updateMany(
    { phase_id },
    { $set: { phase_id: null } }
  );

  // Then delete the phase
  await RoadmapPhaseModel.deleteOne({ phase_id });
  return true;
}

// *************** EXPORT MODULE ***************
module.exports = {
  GetRoadmapPhases,
  GetPublicRoadmap,
  CreateRoadmapPhase,
  UpdateRoadmapPhase,
  ReorderRoadmapPhases,
  DeleteRoadmapPhase,
};
