// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { v4: uuidv4 } = require('uuid');

// *************** IMPORT MODULE ***************
const DocumentationVersionModel = require('./documentation_version.model');
const { ValidateGenerateDocumentationVersion } = require('./documentation_version.validator');
const { ThrowFormattedError } = require('../../../core/error');
const { NormalizePagination, BuildPaginatedResponse } = require('../../../shared/pagination.helper');
const { SerializeDates } = require('../../../utils/date.util');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Returns paginated documentation versions sorted by generated_at descending.
 *
 * @param {Object} [pagination={}]
 * @returns {Promise<Object>}
 */
async function GetDocumentationVersions(pagination = {}) {
  const { page, limit, skip } = NormalizePagination(pagination);

  const [data, total] = await Promise.all([
    DocumentationVersionModel.find({}).sort({ generated_at: -1 }).skip(skip).limit(limit).lean(),
    DocumentationVersionModel.countDocuments({}),
  ]);

  return BuildPaginatedResponse(data, total, page, limit);
}

/**
 * Records a new documentation version entry.
 *
 * @param {Object} input
 * @param {string|null} [generated_by=null]
 * @returns {Promise<Object>}
 */
async function GenerateDocumentationVersion(input, generated_by = null) {
  const { error, value } = ValidateGenerateDocumentationVersion(input);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });

  const entry = await DocumentationVersionModel.create({
    ...value,
    document_id: uuidv4(),
    generated_at: new Date().toISOString(),
    generated_by,
  });

  return SerializeDates(entry.toObject());
}

// *************** EXPORT MODULE ***************
module.exports = { GetDocumentationVersions, GenerateDocumentationVersion };
