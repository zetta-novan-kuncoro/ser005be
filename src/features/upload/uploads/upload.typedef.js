// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { gql } = require('graphql-tag');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
const uploadTypeDef = gql`
  enum UploadPurpose {
    EvolutionRequestAttachment
    ChangelogAttachment
    DocumentationArtifact
    ApplicationAsset
  }

  type UploadAuthorization {
    upload_url: String!
    s3_key: String!
    expires_in: Int!
  }

  type CompleteUploadResult {
    s3_key: String!
    download_url: String!
  }

  input UploadAuthorizationInput {
    application_reference: String!
    purpose: UploadPurpose!
    filename: String!
    content_type: String!
  }

  input CompleteUploadInput {
    application_reference: String!
    purpose: UploadPurpose!
    s3_key: String!
  }

  type Mutation {
    CreateUploadAuthorization(input: UploadAuthorizationInput!): UploadAuthorization
    CompleteUpload(input: CompleteUploadInput!): CompleteUploadResult
  }
`;

module.exports = uploadTypeDef;
