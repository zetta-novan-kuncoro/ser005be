// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { gql } = require('graphql-tag');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
const translationTypeDef = gql`
  type Translation {
    _id: ID!
    key: String!
    namespace: String!
    en: String
    fr: String
    es: String
    id: String
    created_at: String
    updated_at: String
  }

  input TranslationInput {
    key: String!
    namespace: String!
    en: String
    fr: String
    es: String
    id: String
  }

  input TranslationUpdateInput {
    en: String
    fr: String
    es: String
    id: String
  }

  type TranslationPaginatedResult {
    data: [Translation]
    total: Int
    page: Int
    limit: Int
    total_pages: Int
  }

  type Query {
    GetTranslations(namespace: String, search: String, pagination: PaginationInput): TranslationPaginatedResult
    GetTranslation(key: String!, namespace: String!): Translation
  }

  type Mutation {
    CreateTranslation(input: TranslationInput!): Translation
    UpdateTranslation(key: String!, namespace: String!, input: TranslationUpdateInput!): Translation
    DeleteTranslation(key: String!, namespace: String!): Boolean
  }
`;

module.exports = translationTypeDef;
