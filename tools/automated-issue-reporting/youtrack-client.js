'use strict';

const fs = require('fs');
const path = require('path');
const { SUMMARY_PREFIX, StripAnsiArtifacts } = require('./findings');

const DEFAULT_FIELDS = [
  'id',
  'idReadable',
  'summary',
  'description',
  'resolved',
  'updated',
  'url',
  'customFields(name,$type,value(name,text,presentation,id,idReadable,login,fullName))',
].join(',');

/**
 * Returns whether the YouTrack client has the minimum config required to write.
 *
 * @param {Object} config - Loaded config
 * @returns {boolean} Whether the client is configured
 */
function HasYouTrackWriteConfig(config) {
  return Boolean(
    config.youtrack.baseUrl
      && config.youtrack.apiToken
      && config.youtrack.projectId
  );
}

/**
 * Builds the Authorization header set.
 *
 * @param {Object} config - Loaded config
 * @returns {Object} Request headers
 */
function BuildHeaders(config) {
  return {
    Authorization: `Bearer ${config.youtrack.apiToken}`,
    Accept: 'application/json',
  };
}

/**
 * Builds a safe YouTrack search query.
 *
 * @param {Object} config - Loaded config
 * @param {boolean} unresolvedOnly - Whether to restrict to unresolved issues
 * @returns {string} Query string
 */
function BuildSearchQuery(config, unresolvedOnly) {
  const parts = [];

  if (config.youtrack.projectQuery) {
    const projectValue = /\s/.test(config.youtrack.projectQuery)
      ? `{${config.youtrack.projectQuery}}`
      : config.youtrack.projectQuery;
    parts.push(`project:${projectValue}`);
  }

  if (unresolvedOnly) {
    parts.push('#Unresolved');
  }

  parts.push(SUMMARY_PREFIX);

  return parts.join(' ');
}

/**
 * Parses a JSON response and throws on HTTP errors.
 *
 * @param {Response} response - Fetch response
 * @returns {Promise<Object|Array|string>} Parsed response body
 */
async function ParseJsonResponse(response) {
  const raw = await response.text();
  let parsed = raw;

  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch (_) {
    parsed = raw;
  }

  if (!response.ok) {
    const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    throw new Error(`YouTrack request failed (HTTP ${response.status}): ${detail}`);
  }

  return parsed;
}

/**
 * Executes a YouTrack JSON request.
 *
 * @param {Function} fetchImpl - Fetch implementation
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object|Array|string>} Parsed response body
 */
async function RequestJson(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  return ParseJsonResponse(response);
}

/**
 * Extracts the configured fingerprint value from a custom field.
 *
 * @param {Object} issue - YouTrack issue payload
 * @param {Object} config - Loaded config
 * @returns {string|null} Fingerprint value
 */
function ExtractFingerprintCustomField(issue, config) {
  if (!config.youtrack.fingerprintFieldName) {
    return null;
  }

  const customField = (issue.customFields || []).find((entry) => entry.name === config.youtrack.fingerprintFieldName);
  if (!customField || customField.value == null) {
    return null;
  }

  if (typeof customField.value === 'string') {
    return customField.value;
  }

  if (typeof customField.value.text === 'string') {
    return customField.value.text;
  }

  if (typeof customField.value.name === 'string') {
    return customField.value.name;
  }

  return null;
}

/**
 * Extracts the fallback fingerprint token from an issue description.
 *
 * @param {Object} issue - YouTrack issue payload
 * @returns {string|null} Fingerprint token
 */
function ExtractFingerprintToken(issue) {
  const match = String(issue.description || '').match(/Fingerprint:\s*`?([a-f0-9]{64})`?/i);
  return match ? match[1] : null;
}

/**
 * Returns whether an issue matches the finding fingerprint.
 *
 * @param {Object} issue - YouTrack issue payload
 * @param {Object} config - Loaded config
 * @param {string} fingerprint - Target fingerprint
 * @returns {boolean} Whether the issue matches
 */
function IssueMatchesFingerprint(issue, config, fingerprint) {
  return ExtractFingerprintCustomField(issue, config) === fingerprint
    || ExtractFingerprintToken(issue) === fingerprint;
}

/**
 * Builds the issue custom fields for create or update.
 *
 * @param {Object} config - Loaded config
 * @param {Object} finding - Normalized finding
 * @returns {Object[]} Custom fields payload
 */
function BuildIssueCustomFields(config, finding) {
  const fields = [
    {
      name: config.youtrack.typeFieldName,
      $type: 'SingleEnumIssueCustomField',
      value: { name: config.youtrack.typeFieldValue },
    },
    {
      name: config.youtrack.stateFieldName,
      $type: 'StateIssueCustomField',
      value: { name: config.youtrack.stateFieldValue },
    },
  ];

  if (config.youtrack.fingerprintFieldName) {
    fields.push({
      name: config.youtrack.fingerprintFieldName,
      $type: config.youtrack.fingerprintFieldType,
      value: finding.fingerprint,
    });
  }

  return fields;
}

/**
 * Builds a readable final-outcome label.
 *
 * @param {Object} finding - Normalized finding
 * @returns {string} Final outcome label
 */
function BuildFinalOutcome(finding) {
  if (finding.classification === 'flaky') {
    return 'passed on retry';
  }

  if (finding.classification === 'infra-setup') {
    return 'setup failed';
  }

  return 'failed after retries';
}

/**
 * Normalizes description options for backward-compatible calls.
 *
 * @param {string|Object|null|undefined} options - Previous issue id or options object
 * @returns {{ previousIssueId: string|null, artifactLinks: Object[] }} Normalized options
 */
function NormalizeDescriptionOptions(options) {
  if (typeof options === 'string' || options == null) {
    return {
      previousIssueId: options || null,
      artifactLinks: [],
    };
  }

  return {
    previousIssueId: options.previousIssueId || null,
    artifactLinks: Array.isArray(options.artifactLinks) ? options.artifactLinks : [],
  };
}

/**
 * Builds a fenced code block from multi-line text.
 *
 * @param {string|null|undefined} value - Raw content
 * @returns {string[]} Markdown lines
 */
function BuildCodeBlock(value) {
  const content = StripAnsiArtifacts(value)
    .replace(/\r/g, '')
    .trim();

  if (!content) {
    return ['- n/a'];
  }

  return ['```text', content, '```'];
}

/**
 * Extracts the human-readable error message section from raw error text.
 *
 * @param {Object} finding - Normalized finding
 * @returns {string} Observed error block
 */
function ExtractObservedBlock(finding) {
  const lines = StripAnsiArtifacts(finding.rawMessage)
    .split('\n')
    .map((line) => line.replace(/\r/g, ''));
  const stackStartIndex = lines.findIndex((line) => line.trim().startsWith('at '));

  if (stackStartIndex > 0) {
    return lines.slice(0, stackStartIndex).join('\n').trim();
  }

  return lines.join('\n').trim() || finding.normalizedMessage;
}

/**
 * Extracts the stack excerpt from raw error text.
 *
 * @param {Object} finding - Normalized finding
 * @returns {string} Stack excerpt
 */
function ExtractStackBlock(finding) {
  const lines = StripAnsiArtifacts(finding.rawMessage)
    .split('\n')
    .map((line) => line.replace(/\r/g, ''));
  const stackLines = lines.filter((line) => line.trim().startsWith('at '));

  if (stackLines.length) {
    return stackLines.join('\n').trim();
  }

  return finding.stackTop || '';
}

/**
 * Formats artifact links for the issue description.
 *
 * @param {Object[]} artifactLinks - Uploaded artifact descriptors
 * @returns {string[]} Markdown lines
 */
function BuildArtifactLines(artifactLinks) {
  const lines = [];
  const kinds = ['screenshot', 'trace', 'error-context', 'html-report', 'console-log', 'other'];

  for (const kind of kinds) {
    const matches = artifactLinks.filter((artifact) => artifact.kind === kind);
    for (const match of matches) {
      if (!match.url) {
        lines.push(`- ${kind}: ${match.name}`);
        continue;
      }

      lines.push(`- ${kind}: [${match.name}](${match.url})`);
    }
  }

  if (!lines.length) {
    lines.push('- none attached');
  }

  return lines;
}

/**
 * Builds the automated issue description.
 *
 * @param {Object} finding - Normalized finding
 * @param {string|null} previousIssueId - Previous closed issue ID
 * @returns {string} Markdown description
 */
function BuildIssueDescription(finding, options) {
  const normalizedOptions = NormalizeDescriptionOptions(options);
  const lines = [
    '**Source**',
    '- Automated CI finding',
    `- Layer: ${finding.layer === 'fe-e2e' ? 'FE E2E' : 'BE Unit'}`,
    `- Classification: ${finding.classification}`,
    '- State: 000A-Auto Triage To Do',
    '',
    '**Summary**',
  ];

  if (finding.layer === 'fe-e2e') {
    lines.push(`- Final outcome: ${BuildFinalOutcome(finding)}`);
    lines.push(`- Browser: ${finding.browser || 'n/a'}`);
    lines.push(`- Spec: \`${finding.filePath}\``);
    lines.push(`- Test: \`${finding.fullTestName}\``);
    lines.push(`- Feature hint: \`${finding.featureHint}\``);
  } else {
    lines.push(`- File: \`${finding.filePath}\``);
    lines.push(`- Test: \`${finding.fullTestName}\``);
    lines.push(`- Feature hint: \`${finding.featureHint}\``);
  }

  lines.push('');
  lines.push('**Observed**');
  lines.push(...BuildCodeBlock(ExtractObservedBlock(finding)));
  lines.push('');
  lines.push('**Technical Context**');

  if (finding.layer === 'fe-e2e') {
    lines.push(`- Selector / locator: \`${finding.selector || 'n/a'}\``);
    lines.push(`- Attempt: \`${finding.attempt}/${finding.finalAttemptCount}\``);
    lines.push(`- Passed on retry: \`${String(finding.passedOnRetry)}\``);
  } else {
    lines.push(`- Error class: \`${finding.errorClass || 'n/a'}\``);
    lines.push(`- Relevant helper / mutation / validator: \`${finding.stableAnchor || 'n/a'}\``);
  }

  lines.push('');
  lines.push('**Stack Excerpt**');
  lines.push(...BuildCodeBlock(ExtractStackBlock(finding)));

  lines.push('');
  lines.push('**CI Context**');
  lines.push(`- Branch: \`${finding.branch || 'n/a'}\``);
  lines.push(`- Commit: \`${finding.commit || 'n/a'}\``);
  lines.push(`- Run URL: ${finding.runUrl || 'n/a'}`);

  if (finding.environmentName || finding.environmentUrl) {
    lines.push(`- Environment: \`${finding.environmentName || 'n/a'}\``);
    lines.push(`- Environment URL: ${finding.environmentUrl || 'n/a'}`);
  }

  lines.push('');
  lines.push('**Artifacts**');
  lines.push(...BuildArtifactLines(normalizedOptions.artifactLinks));
  lines.push('');
  lines.push('**Deduplication**');
  lines.push(`- Fingerprint: \`${finding.fingerprint}\``);
  lines.push(`- Related closed issue: ${normalizedOptions.previousIssueId || 'n/a'}`);
  lines.push('');
  lines.push('**Triage Guidance**');

  if (finding.layer === 'fe-e2e') {
    lines.push('- `001A - Dev To Do` if confirmed product bug');
    lines.push('- `999D-Auto Flaky` if unstable but not consistently broken');
    lines.push('- `999E-Auto Infra/Setup` if caused by seed/env/setup');
    lines.push('- `999F-Auto Test Defect` if caused by test implementation');
    lines.push('- `999C-DSQ Not Relevant` if false alarm / duplicate / irrelevant');
  } else {
    lines.push('- `001A - Dev To Do` if confirmed real logic defect');
    lines.push('- `999E-Auto Infra/Setup` if setup/dependency issue');
    lines.push('- `999F-Auto Test Defect` if test/helper problem');
    lines.push('- `999C-DSQ Not Relevant` if false alarm / duplicate / irrelevant');
  }

  return lines.join('\n');
}

/**
 * Builds the repeat-occurrence comment body.
 *
 * @param {Object} finding - Normalized finding
 * @returns {string} Markdown comment
 */
function BuildRepeatComment(finding, uploadedArtifacts = []) {
  const artifactList = uploadedArtifacts.length
    ? uploadedArtifacts.map((artifact) => artifact.name).join(', ')
    : 'none';

  return [
    'Automated re-occurrence detected.',
    '',
    `- Run URL: ${finding.runUrl || 'n/a'}`,
    `- Branch: ${finding.branch || 'n/a'}`,
    `- Commit: ${finding.commit || 'n/a'}`,
    `- Classification: ${finding.classification}`,
    `- Final outcome: ${BuildFinalOutcome(finding)}`,
    `- New artifacts: ${artifactList}`,
  ].join('\n');
}

/**
 * Searches unresolved automated issues and filters them client-side.
 *
 * @param {Function} fetchImpl - Fetch implementation
 * @param {Object} config - Loaded config
 * @param {boolean} unresolvedOnly - Whether to search only unresolved issues
 * @returns {Promise<Object[]>} Matching issues
 */
async function SearchAutoIssues(fetchImpl, config, unresolvedOnly) {
  const baseUrl = config.youtrack.baseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({
    fields: DEFAULT_FIELDS,
    query: BuildSearchQuery(config, unresolvedOnly),
    '$top': String(config.searchLimit),
  });
  const url = `${baseUrl}/api/issues?${params.toString()}`;

  const response = await RequestJson(fetchImpl, url, {
    method: 'GET',
    headers: BuildHeaders(config),
  });

  return Array.isArray(response)
    ? response.filter((issue) => String(issue.summary || '').startsWith(SUMMARY_PREFIX))
    : [];
}

/**
 * Creates a new automated issue.
 *
 * @param {Function} fetchImpl - Fetch implementation
 * @param {Object} config - Loaded config
 * @param {Object} finding - Normalized finding
 * @param {string|null} previousIssueId - Previous closed issue
 * @returns {Promise<Object>} Created issue payload
 */
async function CreateIssue(fetchImpl, config, finding, previousIssueId) {
  const baseUrl = config.youtrack.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/api/issues?fields=id,idReadable,url,summary,description`;
  const body = {
    summary: finding.summary,
    description: BuildIssueDescription(finding, { previousIssueId, artifactLinks: [] }),
    project: { id: config.youtrack.projectId },
    customFields: BuildIssueCustomFields(config, finding),
  };

  return RequestJson(fetchImpl, url, {
    method: 'POST',
    headers: {
      ...BuildHeaders(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * Updates an existing automated issue.
 *
 * @param {Function} fetchImpl - Fetch implementation
 * @param {Object} config - Loaded config
 * @param {Object} issue - Existing issue payload
 * @param {Object} finding - Normalized finding
 * @returns {Promise<Object>} Updated issue payload
 */
async function UpdateIssue(fetchImpl, config, issue, finding, options) {
  const baseUrl = config.youtrack.baseUrl.replace(/\/+$/, '');
  const issueId = encodeURIComponent(issue.id || issue.idReadable);
  const url = `${baseUrl}/api/issues/${issueId}?fields=id,idReadable,url,summary,description`;
  const body = {
    summary: finding.summary,
    description: BuildIssueDescription(finding, options),
    customFields: BuildIssueCustomFields(config, finding),
  };

  return RequestJson(fetchImpl, url, {
    method: 'POST',
    headers: {
      ...BuildHeaders(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * Adds a repeat-occurrence comment to an issue.
 *
 * @param {Function} fetchImpl - Fetch implementation
 * @param {Object} config - Loaded config
 * @param {Object} issue - Existing issue payload
 * @param {Object} finding - Normalized finding
 * @returns {Promise<void>} Completion promise
 */
async function AddOccurrenceComment(fetchImpl, config, issue, finding, uploadedArtifacts = []) {
  const baseUrl = config.youtrack.baseUrl.replace(/\/+$/, '');
  const issueId = encodeURIComponent(issue.id || issue.idReadable);
  const url = `${baseUrl}/api/issues/${issueId}/comments?fields=id,text`;

  await RequestJson(fetchImpl, url, {
    method: 'POST',
    headers: {
      ...BuildHeaders(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: BuildRepeatComment(finding, uploadedArtifacts) }),
  });
}

/**
 * Builds an absolute attachment URL from a YouTrack attachment response.
 *
 * @param {Object} config - Loaded config
 * @param {string|null|undefined} attachmentUrl - Attachment URL from API
 * @returns {string|null} Absolute attachment URL
 */
function BuildAttachmentUrl(config, attachmentUrl) {
  if (!attachmentUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(attachmentUrl)) {
    return attachmentUrl;
  }

  return `${config.youtrack.baseUrl.replace(/\/+$/, '')}/${String(attachmentUrl).replace(/^\/+/, '')}`;
}

/**
 * Uploads existing artifacts to an issue and returns link metadata.
 *
 * @param {Function} fetchImpl - Fetch implementation
 * @param {Object} config - Loaded config
 * @param {Object} issue - Existing or created issue payload
 * @param {Object} finding - Normalized finding
 * @returns {Promise<Object[]>} Uploaded artifact descriptors
 */
async function UploadArtifacts(fetchImpl, config, issue, finding) {
  const uploaded = [];
  const baseUrl = config.youtrack.baseUrl.replace(/\/+$/, '');
  const issueId = encodeURIComponent(issue.id || issue.idReadable);

  for (const artifact of finding.artifacts || []) {
    if (!artifact.path || !fs.existsSync(artifact.path)) {
      continue;
    }

    const url = `${baseUrl}/api/issues/${issueId}/attachments?fields=id,name,url`;
    const form = new FormData();
    const fileBuffer = fs.readFileSync(artifact.path);
    form.append('upload', new Blob([fileBuffer]), path.basename(artifact.path));

    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.youtrack.apiToken}`,
      },
      body: form,
    });

    const uploadResult = await ParseJsonResponse(response);
    const attachments = Array.isArray(uploadResult) ? uploadResult : [uploadResult];

    for (const attachment of attachments) {
      uploaded.push({
        kind: artifact.kind,
        name: attachment.name || path.basename(artifact.path),
        url: BuildAttachmentUrl(config, attachment.url),
      });
    }
  }

  return uploaded;
}

/**
 * Upserts one automated finding into YouTrack.
 *
 * @param {Function} fetchImpl - Fetch implementation
 * @param {Object} config - Loaded config
 * @param {Object} finding - Normalized finding
 * @returns {Promise<Object>} Upsert result
 */
async function UpsertFinding(fetchImpl, config, finding) {
  if (config.dryRun) {
    return {
      action: 'dry-run',
      issueId: null,
      uploadedArtifacts: [],
      finding,
    };
  }

  if (!config.writeAllowed) {
    return {
      action: 'skipped-branch',
      issueId: null,
      uploadedArtifacts: [],
      finding,
    };
  }

  if (!HasYouTrackWriteConfig(config)) {
    return {
      action: 'skipped-config',
      issueId: null,
      uploadedArtifacts: [],
      finding,
    };
  }

  const openIssues = await SearchAutoIssues(fetchImpl, config, true);
  const openIssue = openIssues.find((issue) => IssueMatchesFingerprint(issue, config, finding.fingerprint)) || null;

  if (openIssue) {
    const uploadedArtifacts = await UploadArtifacts(fetchImpl, config, openIssue, finding);
    const updatedIssue = await UpdateIssue(fetchImpl, config, openIssue, finding, {
      previousIssueId: null,
      artifactLinks: uploadedArtifacts,
    });
    await AddOccurrenceComment(fetchImpl, config, openIssue, finding, uploadedArtifacts);

    return {
      action: 'updated',
      issueId: updatedIssue.idReadable || updatedIssue.id || openIssue.idReadable || openIssue.id,
      uploadedArtifacts,
      finding,
    };
  }

  const allIssues = await SearchAutoIssues(fetchImpl, config, false);
  const closedIssue = allIssues.find((issue) => Boolean(issue.resolved) && IssueMatchesFingerprint(issue, config, finding.fingerprint)) || null;
  const createdIssue = await CreateIssue(fetchImpl, config, finding, closedIssue ? (closedIssue.idReadable || closedIssue.id) : null);
  const uploadedArtifacts = await UploadArtifacts(fetchImpl, config, createdIssue, finding);
  const finalizedIssue = await UpdateIssue(fetchImpl, config, createdIssue, finding, {
    previousIssueId: closedIssue ? (closedIssue.idReadable || closedIssue.id) : null,
    artifactLinks: uploadedArtifacts,
  });

  return {
    action: 'created',
    issueId: finalizedIssue.idReadable || finalizedIssue.id || createdIssue.idReadable || createdIssue.id,
    uploadedArtifacts,
    finding,
    relatedClosedIssue: closedIssue ? (closedIssue.idReadable || closedIssue.id) : null,
  };
}

module.exports = {
  BuildIssueDescription,
  BuildRepeatComment,
  BuildSearchQuery,
  ExtractFingerprintToken,
  HasYouTrackWriteConfig,
  IssueMatchesFingerprint,
  SearchAutoIssues,
  UpsertFinding,
};
