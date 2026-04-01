// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { SerializeDates } = require('../utils/date.util');

// *************** VARIABLES ***************
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// *************** FUNCTIONS ***************
/**
 * Normalizes raw pagination input into safe, bounded values.
 *
 * @param {Object} [pagination={}]
 * @param {number} [pagination.page]
 * @param {number} [pagination.limit]
 * @returns {{ page: number, limit: number, skip: number }}
 */
function NormalizePagination(pagination = {}) {
  const page = Math.max(1, parseInt(pagination.page, 10) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(pagination.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Wraps a data array with standard pagination metadata.
 *
 * @param {Array} data - The current page of results
 * @param {number} total - Total number of documents matching the query
 * @param {number} page - Current page number
 * @param {number} limit - Page size
 * @returns {{ data: Array, total: number, page: number, limit: number, total_pages: number }}
 */
function BuildPaginatedResponse(data, total, page, limit) {
  return {
    data: SerializeDates(data),
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit) || 1,
  };
}

// *************** EXPORT MODULE ***************
module.exports = { NormalizePagination, BuildPaginatedResponse };
