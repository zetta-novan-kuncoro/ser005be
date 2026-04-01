// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { gql } = require('graphql-tag');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
const webhookLogTypeDef = gql`
  type WebhookLog {
    _id: ID!
    log_id: String!
    source: String!
    received_at: String!
    route: String!
    remote_ip: String
    http_method: String
    content_type: String
    payload_size_bytes: Int
    signature_present: Boolean!
    signature_valid: Boolean!
    processing_status: String!
    processing_note: String
    issue_key: String
    entity_type: String
    entity_id: String
    resolved_status: String
    auto_advance_attempted: Boolean
    auto_advance_succeeded: Boolean
    payload_summary: String
    error_code: String
    error_message: String
    duration_ms: Int
    http_response_status: Int!
  }

  input WebhookLogFilter {
    source: String
    processing_status: String
    issue_key: String
    from_date: String
    to_date: String
  }

  type WebhookLogPaginatedResult {
    data: [WebhookLog]
    total: Int
    page: Int
    limit: Int
    total_pages: Int
  }

  type Query {
    GetAdminWebhookLogs(
      filter: WebhookLogFilter
      pagination: PaginationInput
      sort: SortInput
    ): WebhookLogPaginatedResult
  }
`;

module.exports = webhookLogTypeDef;
