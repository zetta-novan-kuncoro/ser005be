// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { gql } = require('graphql-tag');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
const roadmapPhaseTypeDef = gql`
  type RoadmapPhase {
    _id: ID!
    phase_id: String!
    application_reference: String!
    phase_name: String!
    order: Int!
    description: String
    created_at: String
    updated_at: String
  }

  input RoadmapPhaseInput {
    application_reference: String!
    phase_name: String!
    order: Int!
    description: String
  }

  input RoadmapPhaseUpdateInput {
    phase_name: String
    order: Int
    description: String
  }

  type Query {
    GetRoadmapPhases(application_reference: String!): [RoadmapPhase]
    GetPublicRoadmap(application_reference: String!): [RoadmapPhase]
  }

  type Mutation {
    CreateRoadmapPhase(input: RoadmapPhaseInput!): RoadmapPhase
    UpdateRoadmapPhase(phase_id: String!, input: RoadmapPhaseUpdateInput!): RoadmapPhase
    ReorderRoadmapPhases(application_reference: String!, ordered_phase_ids: [String!]!): [RoadmapPhase]
    DeleteRoadmapPhase(phase_id: String!): Boolean
  }
`;

module.exports = roadmapPhaseTypeDef;
