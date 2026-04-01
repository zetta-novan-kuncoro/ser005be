// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { mergeResolvers } = require('@graphql-tools/merge');

// *************** IMPORT MODULE ***************
const authFeature = require('./auth');
const applicationFeature = require('./application');
const apiKeyFeature = require('./api_key');
const changelogFeature = require('./changelog');
const evolutionRequestFeature = require('./evolution_request');
const roadmapFeature = require('./roadmap');
const translationFeature = require('./translation');
const documentationFeature = require('./documentation');
const uploadFeature = require('./upload');
const webhookLogFeature = require('./webhook_log');

// *************** VARIABLES ***************
const allFeatures = [
  authFeature,
  applicationFeature,
  apiKeyFeature,
  changelogFeature,
  evolutionRequestFeature,
  roadmapFeature,
  translationFeature,
  documentationFeature,
  uploadFeature,
  webhookLogFeature,
];

// *************** FUNCTIONS ***************
/**
 * Collects all type definitions from all features.
 * Apollo Server 4 accepts an array of DocumentNode / string SDL.
 */
const typeDefs = allFeatures.map((f) => f.typeDef);

/**
 * Merges all resolver maps from all features into a single resolver map.
 */
const resolvers = mergeResolvers(allFeatures.flatMap((f) => f.resolvers));

// *************** EXPORT MODULE ***************
module.exports = { typeDefs, resolvers };
