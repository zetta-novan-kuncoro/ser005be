'use strict';

const fs = require('fs');
const path = require('path');
const { GenerateSha256 } = require('../../sat-changelog-be/src/utils/hash.util');

const SUMMARY_PREFIX = '[AUTO]';

/**
 * Loads a JSON file if it exists.
 *
 * @param {string} filePath - Absolute path to the JSON file
 * @returns {Object|null} Parsed JSON or null when the file does not exist
 */
function LoadJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Normalizes path separators to forward slashes.
 *
 * @param {string|null|undefined} value - Raw path
 * @returns {string} Normalized path
 */
function NormalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

/**
 * Removes terminal control sequences and color-code remnants from text.
 *
 * @param {string|null|undefined} value - Raw terminal text
 * @returns {string} Sanitized text
 */
function StripAnsiArtifacts(value) {
  return String(value || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\[[0-9;]*m/g, '');
}

/**
 * Resolves a path relative to the repository root.
 *
 * @param {string} repoRoot - Absolute repository root path
 * @param {string|null|undefined} targetPath - Raw path
 * @returns {string|null} Absolute path when it exists or null
 */
function ResolveArtifactPath(repoRoot, targetPath) {
  if (!targetPath) {
    return null;
  }

  const normalized = NormalizePath(targetPath);
  const absolutePath = path.isAbsolute(normalized)
    ? normalized
    : path.resolve(repoRoot, normalized);

  return fs.existsSync(absolutePath) ? absolutePath : null;
}

/**
 * Returns the first user-story style reference in text.
 *
 * @param {string} value - Raw text
 * @returns {string|null} First reference or null
 */
function ExtractSpecReference(value) {
  const match = String(value || '').match(/US-\d+(?:[-–]\d+)*/i);
  return match ? match[0].replace(/–/g, '-') : null;
}

/**
 * Extracts a locator or selector hint from a failure message.
 *
 * @param {string} value - Failure message
 * @returns {string|null} Selector hint
 */
function ExtractSelector(value) {
  const source = StripAnsiArtifacts(value);
  const patterns = [
    /locator\((.*?\)\))(?=\.| failed|$)/i,
    /(getBy[A-Za-z]+\([^)]+\))/,
    /(data-cy=['"`][^'"`]+['"`])/i,
    /(data-testid=['"`][^'"`]+['"`])/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) {
      return match[0].replace(/\)\)\)+$/g, '))');
    }
  }

  return null;
}

/**
 * Returns a stable feature hint from a file path.
 *
 * @param {string} filePath - Relative file path
 * @returns {string} Feature hint
 */
function InferFeatureHint(filePath) {
  const normalized = NormalizePath(filePath);

  if (normalized.includes('/features/')) {
    const featurePath = normalized.split('/features/')[1] || '';
    return featurePath.split('/')[0] || path.basename(normalized, path.extname(normalized));
  }

  const cleaned = normalized
    .replace(/^sat-changelog-fe\//, '')
    .replace(/^sat-changelog-be\//, '')
    .replace(/^e2e\//, '')
    .replace(/^src\//, '');
  const segments = cleaned.split('/').filter(Boolean);

  if (segments.length >= 2) {
    return segments[0] === 'fixtures'
      ? path.basename(cleaned, path.extname(cleaned))
      : segments[0];
  }

  return path.basename(normalized, path.extname(normalized));
}

/**
 * Removes volatile values from a message so duplicates hash consistently.
 *
 * @param {string} value - Raw message
 * @returns {string} Normalized message
 */
function NormalizeMessage(value) {
  return StripAnsiArtifacts(value)
    .replace(/\r/g, '')
    .replace(/\/home\/[^\s:]+/g, '<path>')
    .replace(/[A-Za-z]:\\[^\s:]+/g, '<path>')
    .replace(/\b[0-9a-f]{24}\b/gi, '<object-id>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '<uuid>')
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g, '<timestamp>')
    .replace(/\b\d+ms\b/g, '<duration>')
    .replace(/:\d+:\d+/g, ':<line>:<column>')
    .replace(/\brequest[_ -]?id[:= ]+[A-Za-z0-9-]+\b/gi, 'request_id=<request-id>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns the most relevant stack frame from an error string.
 *
 * @param {string} value - Raw error output
 * @returns {string|null} Most relevant app-owned stack frame
 */
function ExtractStackTop(value) {
  const lines = StripAnsiArtifacts(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!line.startsWith('at ')) {
      continue;
    }

    if (/(node_modules|jest-circus|internal\/process|playwright\/lib)/i.test(line)) {
      continue;
    }

    if (/(sat-changelog-fe|sat-changelog-be|\/e2e\/|\/src\/)/i.test(line)) {
      return NormalizeMessage(line);
    }
  }

  return null;
}

/**
 * Infers an error-class label from a raw message.
 *
 * @param {string} value - Raw error output
 * @returns {string|null} Error-class label
 */
function ExtractErrorClass(value) {
  const firstLine = StripAnsiArtifacts(value)
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return null;
  }

  const match = firstLine.match(/^([A-Za-z][A-Za-z0-9_.$-]+)(?::|\s)/);
  return match ? match[1] : null;
}

/**
 * Builds a short human-readable failure title for summaries.
 *
 * @param {string} normalizedMessage - Normalized failure message
 * @returns {string} Human-readable title
 */
function BuildFailureTitle(normalizedMessage) {
  const lower = normalizedMessage.toLowerCase();

  if (lower.includes('to be disabled')) {
    return 'Expected element to remain disabled';
  }

  if (lower.includes('to be visible')) {
    return 'Expected element to remain visible';
  }

  if (lower.includes('element') && lower.includes('not found')) {
    return 'Target element was not found';
  }

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'Scenario timed out before completion';
  }

  if (lower.includes('resolved instead of rejected')) {
    return 'Mutation resolved instead of rejecting';
  }

  if (lower.includes('rejected instead of resolved')) {
    return 'Mutation rejected instead of resolving';
  }

  if (lower.includes('cannot read properties of undefined')) {
    return 'Undefined property access crashed the test';
  }

  return normalizedMessage
    .replace(/\s+/g, ' ')
    .slice(0, 100)
    .replace(/^[a-z]/, (letter) => letter.toUpperCase());
}

/**
 * Classifies a normalized finding.
 *
 * @param {Object} finding - Partially normalized finding
 * @returns {string} Classification bucket
 */
function ClassifyFinding(finding) {
  const signal = [
    finding.normalizedMessage,
    finding.rawMessage,
    finding.stackTop,
    finding.filePath,
    finding.fullTestName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (finding.passedOnRetry) {
    return 'flaky';
  }

  if (/(global\.setup|global\.teardown|auth\.setup|seed|bootstrap|backend unavailable|environment unavailable|setup failed|login failed|webserver|connection refused|econnrefused|fetch failed)/i.test(signal)) {
    return 'infra-setup';
  }

  if (/cannot read properties of undefined/i.test(signal)) {
    if (/(fixtures|fixture|auth\.setup|global\.setup|global\.teardown|page-objects|matcher error|expect\.)/i.test(signal)) {
      return 'test-defect';
    }

    return 'hard-fail';
  }

  if (/(strict mode violation|element\(s\) not found|target closed|fixture assumption|test helper|matcher error)/i.test(signal)) {
    return 'test-defect';
  }

  if (signal) {
    return 'hard-fail';
  }

  return 'unknown';
}

/**
 * Maps a classification to a compact summary label.
 *
 * @param {string} classification - Internal classification
 * @returns {string} Summary label
 */
function GetSummaryClassLabel(classification) {
  const labels = {
    'hard-fail': 'HARD',
    flaky: 'FLAKY',
    'infra-setup': 'INFRA',
    'test-defect': 'TEST',
    unknown: 'UNKNOWN',
  };

  return labels[classification] || 'UNKNOWN';
}

/**
 * Builds the fingerprint anchor used in hashing.
 *
 * @param {Object} finding - Normalized finding
 * @returns {string} Stable anchor
 */
function BuildStableAnchor(finding) {
  return finding.selector
    || finding.specReference
    || finding.stackTop
    || finding.errorClass
    || InferFeatureHint(finding.filePath);
}

/**
 * Builds the deterministic raw fingerprint input.
 *
 * @param {Object} finding - Normalized finding
 * @returns {string} Raw fingerprint input
 */
function BuildRawFingerprint(finding) {
  return [
    finding.projectKey,
    finding.layer,
    finding.classification,
    finding.featureHint,
    NormalizePath(finding.filePath),
    finding.fullTestName || finding.testName,
    finding.normalizedMessage,
    finding.stableAnchor,
  ].join('|');
}

/**
 * Finalizes a finding with derived fields.
 *
 * @param {Object} finding - Partially normalized finding
 * @returns {Object} Final normalized finding
 */
function FinalizeFinding(finding) {
  const sanitizedRawMessage = StripAnsiArtifacts(finding.rawMessage);
  const normalizedMessage = NormalizeMessage(sanitizedRawMessage);
  const stackTop = finding.stackTop || ExtractStackTop(sanitizedRawMessage);
  const featureHint = finding.featureHint || InferFeatureHint(finding.filePath);
  const selector = finding.selector || ExtractSelector(sanitizedRawMessage);
  const specReference = finding.specReference || ExtractSpecReference(finding.fullTestName || finding.testName);

  const baseFinding = {
    ...finding,
    rawMessage: sanitizedRawMessage,
    errorClass: finding.errorClass || ExtractErrorClass(sanitizedRawMessage),
    featureHint,
    normalizedMessage,
    selector,
    specReference,
    stackTop,
  };

  const classification = finding.classification || ClassifyFinding(baseFinding);
  const stableAnchor = BuildStableAnchor({ ...baseFinding, classification });
  const fingerprint = GenerateSha256(BuildRawFingerprint({ ...baseFinding, classification, stableAnchor }));
  const summaryReference = specReference || path.basename(baseFinding.filePath, path.extname(baseFinding.filePath));
  const summary = `${SUMMARY_PREFIX}[${baseFinding.layer.toUpperCase()}][${GetSummaryClassLabel(classification)}] ${summaryReference} - ${BuildFailureTitle(normalizedMessage)}`;

  return {
    ...baseFinding,
    classification,
    fingerprint,
    stableAnchor,
    summary,
  };
}

/**
 * Returns a flat list of child suites from a Playwright suite node.
 *
 * @param {Object} suite - Playwright suite node
 * @param {string[]} titles - Parent suite titles
 * @returns {Object[]} Flattened suite descriptors
 */
function FlattenPlaywrightSuites(suite, titles = []) {
  const currentTitles = suite.title ? [...titles, suite.title] : titles;
  const items = [];

  if (Array.isArray(suite.specs)) {
    for (const spec of suite.specs) {
      items.push({ spec, titles: currentTitles });
    }
  }

  if (Array.isArray(suite.suites)) {
    for (const childSuite of suite.suites) {
      items.push(...FlattenPlaywrightSuites(childSuite, currentTitles));
    }
  }

  return items;
}

/**
 * Returns the most relevant Playwright result for a test.
 *
 * @param {Object[]} results - Raw Playwright results
 * @returns {Object|null} Selected result
 */
function SelectPlaywrightResult(results) {
  if (!Array.isArray(results) || !results.length) {
    return null;
  }

  const failedResults = results.filter((entry) => !['passed', 'skipped'].includes(entry.status));
  return failedResults[failedResults.length - 1] || results[results.length - 1];
}

/**
 * Extracts artifact descriptors from a Playwright result.
 *
 * @param {Object} result - Playwright test result
 * @param {Object} config - Loaded config
 * @returns {Object[]} Artifact descriptors
 */
function ExtractPlaywrightArtifacts(result, config) {
  const artifacts = [];

  for (const attachment of result.attachments || []) {
    const absolutePath = ResolveArtifactPath(config.repoRoot, attachment.path);
    if (!absolutePath) {
      continue;
    }

    let kind = 'other';
    if (/screenshot/i.test(attachment.name || '')) {
      kind = 'screenshot';
    } else if (/trace/i.test(attachment.name || '')) {
      kind = 'trace';
    } else if (/error-context/i.test(attachment.name || '')) {
      kind = 'error-context';
    }

    artifacts.push({
      kind,
      path: absolutePath,
    });
  }

  if (fs.existsSync(config.paths.feHtmlReportIndex)) {
    artifacts.push({
      kind: 'html-report',
      path: config.paths.feHtmlReportIndex,
    });
  }

  return artifacts;
}

/**
 * Collects normalized findings from the Playwright JSON reporter output.
 *
 * @param {Object} report - Parsed Playwright JSON report
 * @param {Object} config - Loaded config
 * @returns {Object[]} Normalized findings
 */
function CollectFeFindings(report, config) {
  if (!report || !Array.isArray(report.suites)) {
    return [];
  }

  const findings = [];
  const suiteEntries = report.suites.flatMap((suite) => FlattenPlaywrightSuites(suite));

  for (const entry of suiteEntries) {
    const { spec, titles } = entry;

    for (const test of spec.tests || []) {
      const results = Array.isArray(test.results) ? test.results : [];
      const finalResult = results[results.length - 1] || null;
      const selectedResult = SelectPlaywrightResult(results);
      const passedOnRetry = results.some((item) => item.status !== 'passed') && finalResult && finalResult.status === 'passed';

      if (!passedOnRetry && (!finalResult || ['passed', 'skipped'].includes(finalResult.status))) {
        continue;
      }

      const failureMessage = [
        ...(selectedResult && Array.isArray(selectedResult.errors)
          ? selectedResult.errors.map((error) => error.message || error.value || '')
          : []),
        selectedResult && selectedResult.error
          ? selectedResult.error.message || selectedResult.error.value || ''
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const suiteName = titles.join(' > ') || null;
      const fullTestName = [...titles, spec.title].filter(Boolean).join(' > ');

      findings.push(FinalizeFinding({
        source: 'ci',
        layer: 'fe-e2e',
        projectKey: config.projectKey,
        filePath: NormalizePath(spec.file || selectedResult?.file || ''),
        suiteName,
        testName: spec.title,
        fullTestName,
        browser: test.projectName || null,
        attempt: (selectedResult && typeof selectedResult.retry === 'number' ? selectedResult.retry + 1 : results.length) || 1,
        finalAttemptCount: results.length || 1,
        passedOnRetry,
        rawMessage: failureMessage || `Playwright test ended with status ${finalResult?.status || 'unknown'}.`,
        environmentName: config.environmentName,
        environmentUrl: config.environmentUrl,
        runUrl: config.runUrl,
        branch: config.branch || null,
        commit: config.commit || null,
        artifacts: selectedResult ? ExtractPlaywrightArtifacts(selectedResult, config) : [],
        occurredAt: selectedResult?.startTime || new Date().toISOString(),
      }));
    }
  }

  return findings;
}

/**
 * Collects normalized findings from the Jest JSON output.
 *
 * @param {Object} report - Parsed Jest JSON report
 * @param {Object} config - Loaded config
 * @returns {Object[]} Normalized findings
 */
function CollectBeFindings(report, config) {
  if (!report || !Array.isArray(report.testResults)) {
    return [];
  }

  const findings = [];

  for (const suite of report.testResults) {
    for (const assertion of suite.assertionResults || []) {
      if (assertion.status !== 'failed') {
        continue;
      }

      const rawMessage = (assertion.failureMessages || []).join('\n') || suite.message || 'Jest assertion failed.';
      const fullTestName = assertion.fullName
        || [...(assertion.ancestorTitles || []), assertion.title].filter(Boolean).join(' > ');

      findings.push(FinalizeFinding({
        source: 'ci',
        layer: 'be-unit',
        projectKey: config.projectKey,
        filePath: NormalizePath(path.relative(config.repoRoot, suite.name)),
        suiteName: (assertion.ancestorTitles || []).join(' > ') || null,
        testName: assertion.title,
        fullTestName,
        browser: null,
        attempt: 1,
        finalAttemptCount: 1,
        passedOnRetry: false,
        rawMessage,
        environmentName: config.environmentName,
        environmentUrl: config.environmentUrl,
        runUrl: config.runUrl,
        branch: config.branch || null,
        commit: config.commit || null,
        artifacts: [],
        occurredAt: new Date().toISOString(),
      }));
    }
  }

  return findings;
}

/**
 * Loads and normalizes all available findings.
 *
 * @param {Object} config - Loaded config
 * @returns {Object[]} Normalized findings
 */
function LoadFindings(config) {
  const feReport = LoadJsonFile(config.paths.feResultsFile);
  const beReport = LoadJsonFile(config.paths.beResultsFile);

  return [
    ...CollectFeFindings(feReport, config),
    ...CollectBeFindings(beReport, config),
  ];
}

module.exports = {
  BuildFailureTitle,
  ClassifyFinding,
  CollectBeFindings,
  CollectFeFindings,
  ExtractSelector,
  ExtractSpecReference,
  ExtractStackTop,
  FinalizeFinding,
  InferFeatureHint,
  LoadFindings,
  LoadJsonFile,
  NormalizeMessage,
  SUMMARY_PREFIX,
  StripAnsiArtifacts,
};
