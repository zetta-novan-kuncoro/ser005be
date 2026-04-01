// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../core/config');
const TranslationModel = require('../features/translation/translations/translation.model');
const { GetTranslationDefinitions } = require('./translation_seed_data');

// *************** FUNCTIONS ***************
/**
 * Builds a stable identity string for a translation row.
 *
 * @param {{ key: string, namespace: string }} translation
 * @returns {string}
 */
function BuildTranslationIdentity(translation) {
  return `${translation.namespace}::${translation.key}`;
}

/**
 * Counts rows by namespace for readable seed output.
 *
 * @param {Array<{ namespace: string }>} translations
 * @returns {Object<string, number>}
 */
function CountByNamespace(translations) {
  return translations.reduce((counts, translation) => {
    counts[translation.namespace] = (counts[translation.namespace] || 0) + 1;
    return counts;
  }, {});
}

/**
 * Prints namespace distribution lines in a predictable order.
 *
 * @param {string} label
 * @param {Object<string, number>} counts
 * @returns {void}
 */
function PrintNamespaceSummary(label, counts) {
  const entries = Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));

  console.log(`\n${label}:`);

  if (entries.length === 0) {
    console.log('  none');
    return;
  }

  entries.forEach(([namespace, count]) => {
    console.log(`  ${namespace.padEnd(20)} ${count}`);
  });
}

/**
 * Inserts only missing translation rows and preserves existing edited values.
 *
 * @returns {Promise<{ inserted: Array<Object>, skippedCount: number, totalDefinitions: number }>}
 */
async function SeedMissingTranslations() {
  const definitions = GetTranslationDefinitions();
  const existingTranslations = await TranslationModel.find({}, { key: 1, namespace: 1 }).lean();
  const existingIdentities = new Set(existingTranslations.map(BuildTranslationIdentity));
  const missingDefinitions = definitions.filter((definition) => !existingIdentities.has(BuildTranslationIdentity(definition)));

  if (missingDefinitions.length > 0) {
    await TranslationModel.insertMany(missingDefinitions);
  }

  return {
    inserted: missingDefinitions,
    skippedCount: definitions.length - missingDefinitions.length,
    totalDefinitions: definitions.length,
  };
}

/**
 * Replaces all translations with the source-of-truth seed definitions.
 *
 * @returns {Promise<{ inserted: Array<Object>, deletedCount: number, totalDefinitions: number }>}
 */
async function ResetTranslations() {
  const definitions = GetTranslationDefinitions();
  const deleteResult = await TranslationModel.deleteMany({});
  await TranslationModel.insertMany(definitions);

  return {
    inserted: definitions,
    deletedCount: deleteResult.deletedCount || 0,
    totalDefinitions: definitions.length,
  };
}

/**
 * Runs the translation seed flow in either missing-only or full-reset mode.
 *
 * @param {{ reset?: boolean }} options
 * @returns {Promise<void>}
 */
async function SeedTranslations(options = {}) {
  const { reset = false } = options;

  console.log('[SeedTranslations] Connecting to MongoDB at:', config.mongo.uri);
  await mongoose.connect(config.mongo.uri);
  console.log('[SeedTranslations] Connected.');

  try {
    if (reset) {
      console.log('[SeedTranslations] Reset mode enabled. Replacing all translation rows...');
      const result = await ResetTranslations();

      console.log(`\n[SeedTranslations] Deleted ${result.deletedCount} existing rows.`);
      console.log(`[SeedTranslations] Inserted ${result.inserted.length} translation rows.`);
      PrintNamespaceSummary('Inserted by namespace', CountByNamespace(result.inserted));
      console.log(`\n[SeedTranslations] Reset complete. Total source definitions: ${result.totalDefinitions}`);
      return;
    }

    console.log('[SeedTranslations] Missing-only mode enabled. Preserving existing translation values...');
    const result = await SeedMissingTranslations();

    console.log(`\n[SeedTranslations] Inserted ${result.inserted.length} missing rows.`);
    console.log(`[SeedTranslations] Skipped ${result.skippedCount} existing rows.`);
    PrintNamespaceSummary('Inserted by namespace', CountByNamespace(result.inserted));
    console.log(`\n[SeedTranslations] Missing-only seed complete. Total source definitions: ${result.totalDefinitions}`);
  } finally {
    await mongoose.disconnect();
    console.log('[SeedTranslations] Disconnected.');
  }
}

// *************** EXPORT MODULE ***************
module.exports = {
  SeedTranslations,
  SeedMissingTranslations,
  ResetTranslations,
  BuildTranslationIdentity,
  CountByNamespace,
};

if (require.main === module) {
  const reset = process.argv.includes('--reset');

  SeedTranslations({ reset }).catch((err) => {
    console.error('[SeedTranslations] Fatal error:', err);
    process.exit(1);
  });
}
