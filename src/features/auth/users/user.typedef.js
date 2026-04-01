// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { gql } = require('graphql-tag');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
const userTypeDef = gql`
  type User {
    id: ID!
    email: String!
    full_name: String
    role: String!
    assigned_applications: [String!]!
    is_active: Boolean!
    last_login: String
    created_at: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type RegisterPayload {
    user: User!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input RegisterInput {
    email: String!
    password: String!
    full_name: String
    role: String
  }

  type Query {
    Me: User!
  }

  type Mutation {
    Login(input: LoginInput!): AuthPayload!
    Logout: Boolean!
    Register(input: RegisterInput!): RegisterPayload!
  }
`;

module.exports = userTypeDef;
