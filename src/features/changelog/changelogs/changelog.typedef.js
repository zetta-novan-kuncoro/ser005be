// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { gql } = require('graphql-tag');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
const changelogTypeDef = gql`
  type ChangelogTicket {
    ticket_id: String
    ticket_ref: String
    ticket_name: String
    ticket_url: String
  }

  input ChangelogTicketInput {
    ticket_id: String
    ticket_ref: String
    ticket_name: String
    ticket_url: String
  }

  type Changelog {
    _id: ID!
    entry_id: String!
    entry_group_id: String!
    revision_number: Int!
    previous_entry_id: String
    application_reference: String!
    version: String!
    title: String!
    summary: String
    details_md: String
    change_type: String!
    impact_scope: String!
    release_date: String
    status: String
    visibility: String
    tags: [String]
    tickets: [ChangelogTicket]
    attachments: [String]
    immutable_s3_key: String
    immutable_sha256: String
    published_at: String
    created_by: String
    updated_by: String
    created_at: String
    updated_at: String
  }

  input ChangelogInput {
    application_reference: String!
    version: String!
    title: String!
    summary: String
    details_md: String
    change_type: String!
    impact_scope: String!
    release_date: String!
    status: String
    visibility: String
    tags: [String]
    tickets: [ChangelogTicketInput]
    attachments: [String]
    released_request_ids: [String!]
  }

  input ChangelogUpdateInput {
    version: String
    title: String
    summary: String
    details_md: String
    change_type: String
    impact_scope: String
    release_date: String
    status: String
    visibility: String
    tags: [String]
    tickets: [ChangelogTicketInput]
    attachments: [String]
    released_request_ids: [String!]
  }

  input ChangelogFilter {
    application_reference: String
    status: String
    visibility: String
    change_type: String
    impact_scope: String
    search: String
    page: Int
    limit: Int
  }

  type ChangelogPaginatedResult {
    data: [Changelog]
    total: Int
    page: Int
    limit: Int
    total_pages: Int
  }

  type Query {
    GetAdminChangelogs(filter: ChangelogFilter, pagination: PaginationInput, sort: SortInput): ChangelogPaginatedResult
    GetChangelog(entry_id: String!): Changelog
    GetPublicChangelogs(application_reference: String!, pagination: PaginationInput): ChangelogPaginatedResult
  }

  type Mutation {
    CreateChangelog(input: ChangelogInput!): Changelog
    CreateChangelogRevision(entry_id: String!, input: ChangelogUpdateInput!): Changelog
    UpdateChangelog(entry_id: String!, input: ChangelogUpdateInput!): Changelog
    PublishChangelog(entry_id: String!, released_request_ids: [String!]): Changelog
  }
`;

module.exports = changelogTypeDef;
