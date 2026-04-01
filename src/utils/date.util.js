// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { format, parseISO, isValid, isAfter, isBefore } = require('date-fns');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const DEFAULT_FORMAT = 'yyyy-MM-dd HH:mm:ss';

// *************** FUNCTIONS ***************
/**
 * Returns true when the input is a plain object that can be safely traversed.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function IsPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Returns true when the input looks like a BSON ObjectId instance.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function IsObjectIdLike(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    value._bsontype === 'ObjectId' &&
    typeof value.toHexString === 'function'
  );
}

/**
 * Formats a Date object or ISO string into a human-readable string.
 *
 * @param {Date|string} date - The date to format
 * @param {string} [formatStr] - date-fns format string (defaults to 'yyyy-MM-dd HH:mm:ss')
 * @returns {string} Formatted date string
 */
function FormatDate(date, formatStr = DEFAULT_FORMAT) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

/**
 * Returns true if the provided value is a valid date.
 *
 * @param {Date|string} date - Value to check
 * @returns {boolean}
 */
function IsValidDate(date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d);
}

/**
 * Returns true if `date` is after `reference`.
 *
 * @param {Date|string} date
 * @param {Date|string} reference
 * @returns {boolean}
 */
function IsAfterDate(date, reference) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const r = typeof reference === 'string' ? parseISO(reference) : reference;
  return isAfter(d, r);
}

/**
 * Returns true if `date` is before `reference`.
 *
 * @param {Date|string} date
 * @param {Date|string} reference
 * @returns {boolean}
 */
function IsBeforeDate(date, reference) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const r = typeof reference === 'string' ? parseISO(reference) : reference;
  return isBefore(d, r);
}

/**
 * Returns the current UTC date.
 *
 * @returns {Date}
 */
function NowUTC() {
  return new Date();
}

/**
 * Recursively converts Date instances inside arrays and plain objects to ISO strings.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function SerializeDates(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (IsObjectIdLike(value)) {
    return value.toHexString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => SerializeDates(entry));
  }

  if (IsPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, SerializeDates(entry)])
    );
  }

  return value;
}

// *************** EXPORT MODULE ***************
module.exports = { FormatDate, IsValidDate, IsAfterDate, IsBeforeDate, NowUTC, SerializeDates };
