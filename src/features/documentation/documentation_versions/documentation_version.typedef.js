// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { gql } = require('graphql-tag');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
const documentationVersionTypeDef = gql`
  type DocumentationVersion {
    _id: ID!
    document_id: String!
    version: String!
    generated_at: String
    s3_key: String!
    filename: String!
    generated_by: String
    created_at: String
    updated_at: String
  }

  input DocumentationVersionInput {
    version: String!
    s3_key: String!
    filename: String!
  }

  type DocumentationVersionPaginatedResult {
    data: [DocumentationVersion]
    total: Int
    page: Int
    limit: Int
    total_pages: Int
  }

  type Query {
    GetDocumentationVersions(pagination: PaginationInput): DocumentationVersionPaginatedResult
  }

  type Mutation {
    GenerateDocumentationVersion(input: DocumentationVersionInput!): DocumentationVersion
  }
`;

module.exports = documentationVersionTypeDef;
