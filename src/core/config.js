// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
require('dotenv').config();

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
/**
 * Central configuration object — reads exclusively from environment variables.
 * No feature code should ever call process.env directly.
 */
const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,
  isProduction: process.env.NODE_ENV === 'production',

  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/sat_changelog',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'changeme',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },

  aws: {
    region: process.env.AWS_REGION || 'eu-west-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    s3Bucket: process.env.AWS_S3_BUCKET || 'sat-changelog-assets',
  },

  app: {
    baseUrl: process.env.APP_BASE_URL || 'http://localhost:4000',
  },

  jira: {
    baseUrl: process.env.JIRA_BASE_URL || '',
    userEmail: process.env.JIRA_USER_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
    projectKey: process.env.JIRA_PROJECT_KEY || '',
    webhookSecret: process.env.JIRA_WEBHOOK_SECRET || '',
  },

  youtrack: {
    baseUrl: process.env.YOUTRACK_BASE_URL || '',
    apiToken: process.env.YOUTRACK_API_TOKEN || '',
    projectId: process.env.YOUTRACK_PROJECT_ID || '',
  },
};

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = config;
