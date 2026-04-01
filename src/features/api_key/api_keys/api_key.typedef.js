// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { gql } = require('graphql-tag');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
const apiKeyTypeDef = gql`
  type ApiKey {
    _id: ID!
    application_reference: String!
    name: String!
    key_prefix: String
    expires_at: String
    last_used: String
    last_used_ip: String
    is_active: Boolean
    created_at: String
    updated_at: String
  }

  type ApiKeyCreateResult {
    api_key: ApiKey
    plain_text_key: String
  }

  input ApiKeyInput {
    name: String!
    expires_at: String
  }

  type Query {
    GetApiKeys(application_reference: String!, sort: SortInput): [ApiKey]
    GetAdminApiKeys(sort: SortInput): [ApiKey]
  }

  type Mutation {
    CreateApiKey(application_reference: String!, input: ApiKeyInput!): ApiKeyCreateResult
    CreateDevTestApiKey(application_reference: String!): ApiKeyCreateResult
    DeleteApiKey(key_id: ID!): Boolean
    DeactivateApiKey(key_id: ID!): ApiKey
  }
`;

module.exports = apiKeyTypeDef;
