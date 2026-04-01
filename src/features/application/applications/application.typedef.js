// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { gql } = require('graphql-tag');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
const applicationTypeDef = gql`
  type Owner {
    name: String
    email: String
    role: String
  }

  input OwnerInput {
    name: String!
    email: String!
    role: String!
  }

  type Application {
    _id: ID!
    name: String!
    type: String!
    reference: String!
    environment: String!
    description: String
    active: Boolean
    icon: String
    tenant_scope: String
    owners: [Owner]
    created_at: String
    updated_at: String
    api_keys_count: Int
  }

  input ApplicationFilter {
    search: String
    type: String
    active: Boolean
    environment: String
  }

  input ApplicationInput {
    name: String!
    type: String!
    reference: String!
    environment: String!
    description: String
    active: Boolean
    icon: String
    tenant_scope: String
    owners: [OwnerInput]
  }

  input ApplicationUpdateInput {
    name: String
    type: String
    environment: String
    description: String
    active: Boolean
    icon: String
    tenant_scope: String
    owners: [OwnerInput]
  }

  input PaginationInput {
    page: Int
    limit: Int
  }

  input SortInput {
    field: String
    order: String
  }

  type ApplicationPaginatedResult {
    data: [Application]
    total: Int
    page: Int
    limit: Int
    total_pages: Int
  }

  type EmbedInstructions {
    script_tag: String
    api_key_note: String
    endpoint: String
  }

  type Query {
    GetApplications(filter: ApplicationFilter, pagination: PaginationInput, sort: SortInput): ApplicationPaginatedResult
    GetApplication(reference: String!): Application
    GetApplicationUsers(reference: String!): [Owner]
    GetEmbedInstructions(application_reference: String!): EmbedInstructions
  }

  type Mutation {
    CreateApplication(input: ApplicationInput!): Application
    UpdateApplication(reference: String!, input: ApplicationUpdateInput!): Application
    DeleteApplication(reference: String!): Boolean
    AssignUsersToApplication(reference: String!, owners: [OwnerInput!]!): Application
  }
`;

module.exports = applicationTypeDef;
