// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { gql } = require('graphql-tag');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
const evolutionRequestTypeDef = gql`
  type ErrorLog {
    _id: ID!
    error_id: String!
    timestamp: String!
    error_code: String!
    error_message: String!
    source: String!
    entity_type: String
    entity_id: String
    actor_type: String
    actor_id: String
    metadata: String
  }

  enum EvolutionRequestStatus {
    Pending
    Reviewed
    Approved
    ReadyForDevelopment
    InDevelopment
    TestingAndUAT
    Release
    Rejected
  }

  type IntegrationError {
    target: String!
    message: String!
    failed_at: String!
  }

  type EvolutionRequest {
    _id: ID!
    request_id: String!
    application_reference: String!
    type: String!
    title: String!
    description: String
    submitted_by_display_name: String
    priority: Int!
    expected_date: String
    status: String!
    phase_id: String
    submitted_at: String
    created_at: String
    updated_at: String
    jira_issue_key: String
    jira_issue_url: String
    released_in_entry_id: String
    released_at: String
    rejection_reason: String
  }

  type AdminEvolutionRequest {
    _id: ID!
    request_id: String!
    application_reference: String!
    type: String!
    title: String!
    description: String
    submitted_by: String!
    priority: Int!
    expected_date: String
    attachments: [String]
    status: String!
    phase_id: String
    submitted_at: String
    created_at: String
    updated_at: String
    jira_issue_key: String
    jira_issue_url: String
    released_in_entry_id: String
    released_at: String
    youtrack_issue_id: String
    youtrack_issue_url: String
    integration_errors: [IntegrationError!]
    jira_sync_state: String
    jira_status_mirror: String
    jira_status_mirrored_at: String
    jira_last_attempt_at: String
    jira_last_error_code: String
    jira_last_error_message: String
    youtrack_sync_state: String
    youtrack_last_attempt_at: String
    youtrack_last_error_code: String
    youtrack_last_error_message: String
    rejection_reason: String
  }

  input EvolutionRequestInput {
    application_reference: String!
    type: String!
    title: String!
    description: String
    submitted_by: String!
    priority: Int!
    expected_date: String
    attachments: [String]
    website: String
  }

  input EvolutionRequestFilter {
    application_reference: String
    type: String
    status: String
    priority: Int
    phase_id: String
    search: String
    page: Int
    limit: Int
  }

  input PublicEvolutionRequestFilter {
    type: String
    status: String
    priority: Int
  }

  input AdminEvolutionRequestUpdateInput {
    title: String
    description: String
    priority: Int
    type: String
    expected_date: String
  }

  type EvolutionRequestPaginatedResult {
    data: [EvolutionRequest]
    total: Int
    page: Int
    limit: Int
    total_pages: Int
  }

  type AdminEvolutionRequestPaginatedResult {
    data: [AdminEvolutionRequest]
    total: Int
    page: Int
    limit: Int
    total_pages: Int
  }

  type Query {
    GetAdminEvolutionRequests(filter: EvolutionRequestFilter, pagination: PaginationInput, sort: SortInput): AdminEvolutionRequestPaginatedResult
    GetEvolutionRequest(request_id: String!): AdminEvolutionRequest
    GetPublicEvolutionRequests(application_reference: String!, filter: PublicEvolutionRequestFilter, pagination: PaginationInput, sort: SortInput): EvolutionRequestPaginatedResult
    AdminErrorLogs(limit: Int, offset: Int): [ErrorLog!]!
  }

  type Mutation {
    SubmitEvolutionRequest(input: EvolutionRequestInput!): EvolutionRequest
    AdminUpdateEvolutionRequest(request_id: String!, input: AdminEvolutionRequestUpdateInput!): AdminEvolutionRequest!
    UpdateEvolutionRequestStatus(request_id: String!, status: String!): AdminEvolutionRequest
    ReviewEvolutionRequest(request_id: ID!): AdminEvolutionRequest!
    ApproveEvolutionRequest(request_id: ID!): AdminEvolutionRequest!
    RejectEvolutionRequest(request_id: String!, rejection_reason: String): AdminEvolutionRequest
    RetryEvolutionRequestIntegrations(request_id: ID!): AdminEvolutionRequest!
    AssignEvolutionRequestPhase(request_id: String!, phase_id: String!): AdminEvolutionRequest
    UnassignEvolutionRequestPhase(request_id: String!): AdminEvolutionRequest
    RefreshEvolutionRequestExternalStatus(request_id: ID!): AdminEvolutionRequest!
  }
`;

module.exports = evolutionRequestTypeDef;
