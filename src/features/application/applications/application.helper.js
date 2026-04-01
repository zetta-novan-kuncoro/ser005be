// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const ApplicationModel = require('./application.model');
const ApiKeyModel = require('../../api_key/api_keys/api_key.model');
const { ValidateCreateApplication, ValidateUpdateApplication } = require('./application.validator');
const { ThrowFormattedError } = require('../../../core/error');
const { NormalizePagination, BuildPaginatedResponse } = require('../../../shared/pagination.helper');
const config = require('../../../core/config');
const { SerializeDates } = require('../../../utils/date.util');

// *************** VARIABLES ***************
const ALLOWED_SORT_FIELDS = ['name', 'reference', 'type', 'created_at', 'updated_at', 'active'];
const EXCLUDED_API_KEY_PURPOSE = 'dev_test';

// *************** FUNCTIONS ***************
/**
 * Retrieves a paginated list of applications with optional filters and sorting.
 *
 * @param {Object} [filter={}]
 * @param {string} [filter.search]
 * @param {string} [filter.type]
 * @param {boolean} [filter.active]
 * @param {string} [filter.environment]
 * @param {Object} [pagination={}]
 * @param {Object} [sort={}]
 * @param {string} [sort.field]
 * @param {string} [sort.order]
 * @returns {Promise<Object>} Paginated response
 */
async function GetApplications(filter = {}, pagination = {}, sort = {}) {
  const { page, limit, skip } = NormalizePagination(pagination);

  const query = {};
  if (filter.search) {
    query.$or = [
      { name: { $regex: filter.search, $options: 'i' } },
      { reference: { $regex: filter.search, $options: 'i' } },
    ];
  }
  if (filter.type) query.type = filter.type;
  if (typeof filter.active === 'boolean') query.active = filter.active;
  if (filter.environment) query.environment = filter.environment;

  const sortField = ALLOWED_SORT_FIELDS.includes(sort.field) ? sort.field : 'created_at';
  const sortOrder = sort.order === 'asc' ? 1 : -1;

  const pipeline = [
    { $match: query },
    { $sort: { [sortField]: sortOrder } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'api_keys',
        let: { applicationReference: '$reference' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$application_reference', '$$applicationReference'] },
                  { $ne: ['$key_purpose', EXCLUDED_API_KEY_PURPOSE] },
                ],
              },
            },
          },
        ],
        as: '_api_keys',
      },
    },
    {
      $addFields: {
        api_keys_count: { $size: '$_api_keys' },
      },
    },
    { $project: { _api_keys: 0 } },
  ];

  const [data, total] = await Promise.all([
    ApplicationModel.aggregate(pipeline),
    ApplicationModel.countDocuments(query),
  ]);

  return BuildPaginatedResponse(data, total, page, limit);
}

/**
 * Retrieves a single application by its unique reference.
 *
 * @param {string} reference
 * @returns {Promise<Object>} Application document
 */
async function GetApplication(reference) {
  const app = await ApplicationModel.findOne({ reference }).lean();
  if (!app) ThrowFormattedError('NOT_FOUND', `Application '${reference}' not found.`);
  const count = await ApiKeyModel.countDocuments({
    application_reference: reference,
    key_purpose: { $ne: EXCLUDED_API_KEY_PURPOSE },
  });
  return SerializeDates({ ...app, api_keys_count: count });
}

/**
 * Returns the owners array for a given application reference.
 *
 * @param {string} reference
 * @returns {Promise<Array>} List of owners
 */
async function GetApplicationUsers(reference) {
  const app = await ApplicationModel.findOne({ reference }, { owners: 1 }).lean();
  if (!app) ThrowFormattedError('NOT_FOUND', `Application '${reference}' not found.`);
  return SerializeDates(app.owners || []);
}

/**
 * Builds embed instructions (script tag, endpoint info) for a given application.
 *
 * @param {string} application_reference
 * @returns {Promise<Object>} Embed instruction payload
 */
async function GetEmbedInstructions(application_reference) {
  const app = await ApplicationModel.findOne({ reference: application_reference }).lean();
  if (!app) ThrowFormattedError('NOT_FOUND', `Application '${application_reference}' not found.`);

  const endpoint = `${config.app.baseUrl}/graphql`;
  return {
    script_tag: `<script src="${config.app.baseUrl}/embed/changelog.js" data-app="${application_reference}"></script>`,
    api_key_note: 'Pass your API key via the Authorization: Bearer <key> header.',
    endpoint,
  };
}

/**
 * Creates a new application after validating the input.
 *
 * @param {Object} input
 * @returns {Promise<Object>} Created application document
 */
async function CreateApplication(input) {
  const { error, value } = ValidateCreateApplication(input);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });

  const existing = await ApplicationModel.findOne({ reference: value.reference }).lean();
  if (existing) ThrowFormattedError('CONFLICT', `Application reference '${value.reference}' already exists.`);

  const app = await ApplicationModel.create(value);
  return SerializeDates(app.toObject());
}

/**
 * Updates an existing application by reference.
 *
 * @param {string} reference
 * @param {Object} input
 * @returns {Promise<Object>} Updated application document
 */
async function UpdateApplication(reference, input) {
  const { error, value } = ValidateUpdateApplication(input);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });

  const app = await ApplicationModel.findOneAndUpdate(
    { reference },
    { $set: value },
    { new: true, runValidators: true }
  ).lean();

  if (!app) ThrowFormattedError('NOT_FOUND', `Application '${reference}' not found.`);
  return SerializeDates(app);
}

/**
 * Soft-deletes an application by setting active=false and removing it from the DB.
 *
 * @param {string} reference
 * @returns {Promise<boolean>}
 */
async function DeleteApplication(reference) {
  const result = await ApplicationModel.deleteOne({ reference });
  if (result.deletedCount === 0) ThrowFormattedError('NOT_FOUND', `Application '${reference}' not found.`);
  return true;
}

/**
 * Replaces the entire owners array for a given application.
 *
 * @param {string} reference
 * @param {Array} owners
 * @returns {Promise<Object>} Updated application document
 */
async function AssignUsersToApplication(reference, owners) {
  const app = await ApplicationModel.findOneAndUpdate(
    { reference },
    { $set: { owners } },
    { new: true, runValidators: true }
  ).lean();

  if (!app) ThrowFormattedError('NOT_FOUND', `Application '${reference}' not found.`);
  return SerializeDates(app);
}

// *************** EXPORT MODULE ***************
module.exports = {
  GetApplications,
  GetApplication,
  GetApplicationUsers,
  GetEmbedInstructions,
  CreateApplication,
  UpdateApplication,
  DeleteApplication,
  AssignUsersToApplication,
};
