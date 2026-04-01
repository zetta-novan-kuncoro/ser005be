'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_WRITE_BRANCHES = 'main,staging,release/*';
const DEFAULT_PROJECT_KEY = 'sat-changelog';

/**
 * Resolves a repo-relative path to an absolute path.
 *
 * @param {string} repoRoot - Absolute repository root path
 * @param {string} relativePath - Repo-relative path
 * @returns {string} Absolute path
 */
function ResolveRepoPath(repoRoot, relativePath) {
  return path.resolve(repoRoot, relativePath);
}

/**
 * Returns the first non-empty environment value.
 *
 * @param {NodeJS.ProcessEnv|Object} env - Environment-like object
 * @param {string[]} keys - Candidate keys
 * @returns {string} First non-empty value or empty string
 */
function GetFirstEnvValue(env, keys) {
  for (const key of keys) {
    if (typeof env[key] === 'string' && env[key].trim()) {
      return env[key].trim();
    }
  }

  return '';
}

/**
 * Normalizes a comma-separated branch allowlist.
 *
 * @param {string} value - Raw allowlist string
 * @returns {string[]} Normalized patterns
 */
function ParseWriteBranches(value) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Returns whether a branch matches an allowlist pattern.
 *
 * Supported patterns:
 * - exact branch names
 * - `prefix/*` prefix matches
 *
 * @param {string} branch - Current branch name
 * @param {string[]} patterns - Allowed branch patterns
 * @returns {boolean} Whether the branch is allowed to write
 */
function MatchesWriteBranch(branch, patterns) {
  if (!branch) {
    return false;
  }

  return patterns.some((pattern) => {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1);
      return branch.startsWith(prefix);
    }

    return branch === pattern;
  });
}

/**
 * Loads the repo-root automation config from environment variables.
 *
 * @param {NodeJS.ProcessEnv|Object} [env=process.env] - Environment-like object
 * @returns {Object} Loaded configuration
 */
function LoadConfig(env = process.env) {
  const repoRoot = REPO_ROOT;
  const branch = GetFirstEnvValue(env, [
    'AUTOMATED_ISSUE_CI_BRANCH',
    'GITHUB_REF_NAME',
    'CI_COMMIT_REF_NAME',
    'BRANCH_NAME',
  ]);
  const writeBranches = ParseWriteBranches(env.AUTOMATED_ISSUE_WRITE_BRANCHES || DEFAULT_WRITE_BRANCHES);

  return {
    repoRoot,
    dryRun: String(env.AUTOMATED_ISSUE_DRY_RUN || '').toLowerCase() === 'true',
    failOnError: String(env.AUTOMATED_ISSUE_FAIL_ON_REPORT_ERROR || '').toLowerCase() === 'true',
    projectKey: env.AUTOMATED_ISSUE_PROJECT_KEY || DEFAULT_PROJECT_KEY,
    branch,
    commit: GetFirstEnvValue(env, ['AUTOMATED_ISSUE_CI_COMMIT', 'GITHUB_SHA', 'CI_COMMIT_SHA']),
    runUrl: GetFirstEnvValue(env, ['AUTOMATED_ISSUE_CI_RUN_URL', 'GITHUB_SERVER_URL']),
    environmentName: env.AUTOMATED_ISSUE_ENVIRONMENT_NAME || null,
    environmentUrl: env.AUTOMATED_ISSUE_ENVIRONMENT_URL || null,
    writeBranches,
    writeAllowed: MatchesWriteBranch(branch, writeBranches),
    searchLimit: Number.parseInt(env.AUTOMATED_ISSUE_YOUTRACK_SEARCH_LIMIT || '100', 10),
    paths: {
      feResultsFile: ResolveRepoPath(repoRoot, env.AUTOMATED_ISSUE_FE_RESULTS_FILE || 'sat-changelog-fe/test-results/playwright-results.json'),
      feHtmlReportIndex: ResolveRepoPath(repoRoot, env.AUTOMATED_ISSUE_FE_HTML_REPORT_INDEX || 'sat-changelog-fe/playwright-report/index.html'),
      beResultsFile: ResolveRepoPath(repoRoot, env.AUTOMATED_ISSUE_BE_RESULTS_FILE || 'sat-changelog-be/test-results/jest-results.json'),
    },
    youtrack: {
      baseUrl: (env.AUTOMATED_ISSUE_YOUTRACK_BASE_URL || env.YOUTRACK_BASE_URL || '').trim(),
      apiToken: (env.AUTOMATED_ISSUE_YOUTRACK_API_TOKEN || env.YOUTRACK_API_TOKEN || '').trim(),
      projectId: (env.AUTOMATED_ISSUE_YOUTRACK_PROJECT_ID || env.YOUTRACK_PROJECT_ID || '').trim(),
      projectQuery: (env.AUTOMATED_ISSUE_YOUTRACK_PROJECT_QUERY || env.AUTOMATED_ISSUE_YOUTRACK_PROJECT_ID || env.YOUTRACK_PROJECT_ID || '').trim(),
      typeFieldName: env.AUTOMATED_ISSUE_YOUTRACK_TYPE_FIELD_NAME || 'Type',
      typeFieldValue: env.AUTOMATED_ISSUE_YOUTRACK_TYPE_FIELD_VALUE || '006-Bug',
      stateFieldName: env.AUTOMATED_ISSUE_YOUTRACK_STATE_FIELD_NAME || 'State',
      stateFieldValue: env.AUTOMATED_ISSUE_YOUTRACK_STATE_FIELD_VALUE || '000A-Auto Triage To Do',
      fingerprintFieldName: (env.AUTOMATED_ISSUE_YOUTRACK_FINGERPRINT_FIELD_NAME || '').trim(),
      fingerprintFieldType: env.AUTOMATED_ISSUE_YOUTRACK_FINGERPRINT_FIELD_TYPE || 'SimpleIssueCustomField',
    },
  };
}

module.exports = {
  DEFAULT_PROJECT_KEY,
  DEFAULT_WRITE_BRANCHES,
  LoadConfig,
  MatchesWriteBranch,
  ParseWriteBranches,
  ResolveRepoPath,
};
