'use strict';

const { LoadConfig } = require('./config');
const { LoadFindings } = require('./findings');
const { UpsertFinding } = require('./youtrack-client');

/**
 * Emits a compact console summary for CI logs.
 *
 * @param {Object[]} results - Upsert results
 * @param {Object} config - Loaded config
 * @returns {void} No return value
 */
function EmitSummary(results, config) {
  const counts = results.reduce((accumulator, result) => {
    accumulator[result.action] = (accumulator[result.action] || 0) + 1;
    return accumulator;
  }, {});

  console.log('[AutomatedIssueReporting] Summary');
  console.log(`- findings: ${results.length}`);
  console.log(`- write-allowed: ${String(config.writeAllowed)}`);
  console.log(`- dry-run: ${String(config.dryRun)}`);

  for (const [action, count] of Object.entries(counts)) {
    console.log(`- ${action}: ${count}`);
  }
}

/**
 * Processes all collected findings.
 *
 * @param {Object} config - Loaded config
 * @param {Function} [fetchImpl=fetch] - Fetch implementation
 * @returns {Promise<Object[]>} Upsert results
 */
async function ProcessFindings(config, fetchImpl = fetch) {
  const findings = LoadFindings(config);
  const results = [];

  for (const finding of findings) {
    results.push(await UpsertFinding(fetchImpl, config, finding));
  }

  return results;
}

/**
 * Runs the automated issue reporter.
 *
 * @param {NodeJS.ProcessEnv|Object} [env=process.env] - Environment-like object
 * @param {Function} [fetchImpl=fetch] - Fetch implementation
 * @returns {Promise<Object[]>} Upsert results
 */
async function Run(env = process.env, fetchImpl = fetch) {
  const config = LoadConfig(env);
  const results = await ProcessFindings(config, fetchImpl);
  EmitSummary(results, config);
  return results;
}

module.exports = {
  EmitSummary,
  ProcessFindings,
  Run,
};
