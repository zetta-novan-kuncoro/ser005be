// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const TranslationModel = require('./translation.model');
const { ValidateCreateTranslation, ValidateUpdateTranslation } = require('./translation.validator');
const { ThrowFormattedError } = require('../../../core/error');
const { NormalizePagination, BuildPaginatedResponse } = require('../../../shared/pagination.helper');
const { SerializeDates } = require('../../../utils/date.util');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Returns paginated translations with optional namespace filter and full-text search.
 *
 * @param {string|null} [namespace=null]
 * @param {string|null} [search=null]
 * @param {Object} [pagination={}]
 * @returns {Promise<Object>}
 */
async function GetTranslations(namespace = null, search = null, pagination = {}) {
  const { page, limit, skip } = NormalizePagination(pagination);
  const query = {};

  if (namespace) query.namespace = namespace;
  if (search) {
    query.$or = [
      { key: { $regex: search, $options: 'i' } },
      { en: { $regex: search, $options: 'i' } },
      { fr: { $regex: search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    TranslationModel.find(query).sort({ key: 1 }).skip(skip).limit(limit).lean(),
    TranslationModel.countDocuments(query),
  ]);

  return BuildPaginatedResponse(data, total, page, limit);
}

/**
 * Returns a single translation by its unique key.
 *
 * @param {string} key
 * @returns {Promise<Object>}
 */
async function GetTranslation(key, namespace) {
  const translation = await TranslationModel.findOne({ key, namespace }).lean();
  if (!translation) ThrowFormattedError('NOT_FOUND', `Translation key '${namespace}.${key}' not found.`);
  return SerializeDates(translation);
}

/**
 * Creates a new translation entry.
 *
 * @param {Object} input
 * @returns {Promise<Object>}
 */
async function CreateTranslation(input) {
  const { error, value } = ValidateCreateTranslation(input);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });

  const existing = await TranslationModel.findOne({ key: value.key, namespace: value.namespace }).lean();
  if (existing) ThrowFormattedError('CONFLICT', `Translation key '${value.namespace}.${value.key}' already exists.`);

  const entry = await TranslationModel.create(value);
  return SerializeDates(entry.toObject());
}

/**
 * Updates an existing translation by key.
 *
 * @param {string} key
 * @param {Object} input
 * @returns {Promise<Object>}
 */
async function UpdateTranslation(key, namespace, input) {
  const { error, value } = ValidateUpdateTranslation(input);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });

  const entry = await TranslationModel.findOneAndUpdate(
    { key, namespace },
    { $set: value },
    { new: true, runValidators: true }
  ).lean();

  if (!entry) ThrowFormattedError('NOT_FOUND', `Translation key '${namespace}.${key}' not found.`);
  return SerializeDates(entry);
}

/**
 * Deletes a translation by key.
 *
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function DeleteTranslation(key, namespace) {
  const result = await TranslationModel.deleteOne({ key, namespace });
  if (result.deletedCount === 0) ThrowFormattedError('NOT_FOUND', `Translation key '${namespace}.${key}' not found.`);
  return true;
}

// *************** EXPORT MODULE ***************
module.exports = { GetTranslations, GetTranslation, CreateTranslation, UpdateTranslation, DeleteTranslation };
