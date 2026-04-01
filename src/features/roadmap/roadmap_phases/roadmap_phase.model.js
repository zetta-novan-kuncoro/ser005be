// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const mongoose = require('mongoose');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const { Schema, model } = mongoose;

const RoadmapPhaseSchema = new Schema(
  {
    phase_id: { type: String, required: true, unique: true, index: true },
    application_reference: { type: String, required: true, index: true },
    phase_name: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
    description: { type: String, default: '' },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'roadmap_phases',
  }
);

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = model('RoadmapPhase', RoadmapPhaseSchema);
