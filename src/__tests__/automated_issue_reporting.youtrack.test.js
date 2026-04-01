'use strict';

const path = require('path');

const {
  BuildIssueDescription,
  BuildSearchQuery,
  ExtractFingerprintToken,
  IssueMatchesFingerprint,
  UpsertFinding,
} = require('../../../tools/automated-issue-reporting/youtrack-client');

const FINDING = {
  classification: 'hard-fail',
  layer: 'be-unit',
  summary: '[AUTO][BE-UNIT][HARD] US-105 - Mutation resolved instead of rejecting',
  normalizedMessage: 'promise resolved instead of rejected',
  rawMessage: 'Error: promise resolved instead of rejected\n    at sat-changelog-be/src/features/evolution_request/evolution_requests/evolution_request.helper.js:120:5',
  filePath: 'sat-changelog-be/src/features/evolution_request/evolution_requests/__tests__/evolution_request.helper.test.js',
  fullTestName: 'UpdateEvolutionRequestStatus > Release transition is forbidden via this mutation',
  featureHint: 'evolution_request',
  errorClass: 'Error',
  stableAnchor: 'UpdateEvolutionRequestStatus',
  fingerprint: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  branch: 'main',
  commit: 'abc123',
  runUrl: 'https://ci.example.com/runs/1',
  stackTop: 'at sat-changelog-be/src/features/evolution_request/evolution_requests/evolution_request.helper.js:<line>:<column>',
  artifacts: [],
};

const CONFIG = {
  dryRun: false,
  writeAllowed: true,
  searchLimit: 50,
  youtrack: {
    baseUrl: 'https://youtrack.example.com',
    apiToken: 'secret',
    projectId: '0-1',
    projectQuery: 'SAT',
    typeFieldName: 'Type',
    typeFieldValue: '006-Bug',
    stateFieldName: 'State',
    stateFieldValue: '000A-Auto Triage To Do',
    fingerprintFieldName: 'Auto Fingerprint',
    fingerprintFieldType: 'SimpleIssueCustomField',
  },
};

/**
 * Creates a mocked fetch implementation from a response queue.
 *
 * @param {Array<Object>} queue - Response queue
 * @returns {Function} Fetch mock
 */
function CreateFetchMock(queue) {
  return jest.fn(async () => {
    const next = queue.shift();
    return {
      ok: next.ok !== false,
      status: next.status || 200,
      async text() {
        return JSON.stringify(next.body);
      },
    };
  });
}

describe('automated issue reporting youtrack client', () => {
  it('builds a project-scoped unresolved query', () => {
    expect(BuildSearchQuery(CONFIG, true)).toBe('project:SAT #Unresolved [AUTO]');
  });

  it('embeds the fingerprint token in the issue description', () => {
    const description = BuildIssueDescription(FINDING, null);
    expect(description).toContain(FINDING.fingerprint);
    expect(description).toContain('```text');
    expect(description).toContain('promise resolved instead of rejected');
    expect(ExtractFingerprintToken({ description })).toBe(FINDING.fingerprint);
  });

  it('matches issues by fallback fingerprint token', () => {
    expect(IssueMatchesFingerprint({
      description: `Fingerprint: \`${FINDING.fingerprint}\``,
      customFields: [],
    }, CONFIG, FINDING.fingerprint)).toBe(true);
  });

  it('skips writes when the branch is not allowed', async () => {
    const result = await UpsertFinding(jest.fn(), { ...CONFIG, writeAllowed: false }, FINDING);
    expect(result.action).toBe('skipped-branch');
  });

  it('updates an existing open issue on repeated occurrence', async () => {
    const fetchMock = CreateFetchMock([
      {
        body: [
          {
            id: '2-1',
            idReadable: 'SAT-100',
            summary: FINDING.summary,
            description: `Fingerprint: \`${FINDING.fingerprint}\``,
            resolved: null,
            customFields: [],
          },
        ],
      },
      {
        body: {
          id: '2-1',
          idReadable: 'SAT-100',
          summary: FINDING.summary,
          description: 'updated',
        },
      },
      {
        body: {
          id: 'comment-1',
          text: 'Automated re-occurrence detected.',
        },
      },
    ]);

    const result = await UpsertFinding(fetchMock, CONFIG, FINDING);

    expect(result).toMatchObject({
      action: 'updated',
      issueId: 'SAT-100',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('creates a new issue when only a closed match exists', async () => {
    const fetchMock = CreateFetchMock([
      { body: [] },
      {
        body: [
          {
            id: '2-9',
            idReadable: 'SAT-9',
            summary: FINDING.summary,
            description: `Fingerprint: \`${FINDING.fingerprint}\``,
            resolved: '2026-03-01T00:00:00.000Z',
            customFields: [],
          },
        ],
      },
      {
        body: {
          id: '2-10',
          idReadable: 'SAT-10',
          summary: FINDING.summary,
          description: 'created',
        },
      },
      {
        body: {
          id: '2-10',
          idReadable: 'SAT-10',
          summary: FINDING.summary,
          description: 'updated',
        },
      },
    ]);

    const result = await UpsertFinding(fetchMock, CONFIG, FINDING);

    expect(result).toMatchObject({
      action: 'created',
      issueId: 'SAT-10',
      relatedClosedIssue: 'SAT-9',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('renders uploaded artifact links in the final updated description', async () => {
    const fetchMock = CreateFetchMock([
      {
        body: [
          {
            id: '2-1',
            idReadable: 'SAT-100',
            summary: FINDING.summary,
            description: `Fingerprint: \`${FINDING.fingerprint}\``,
            resolved: null,
            customFields: [],
          },
        ],
      },
      {
        body: [
          {
            id: 'attachment-1',
            name: 'trace.zip',
            url: '/youtrack/api/files/trace.zip',
          },
        ],
      },
      {
        body: {
          id: '2-1',
          idReadable: 'SAT-100',
          summary: FINDING.summary,
          description: 'updated',
        },
      },
      {
        body: {
          id: 'comment-1',
          text: 'Automated re-occurrence detected.',
        },
      },
    ]);

    const result = await UpsertFinding(fetchMock, CONFIG, {
      ...FINDING,
      artifacts: [{ kind: 'trace', path: path.join(__dirname, 'automated_issue_reporting.youtrack.test.js') }],
    });

    expect(result).toMatchObject({
      action: 'updated',
      issueId: 'SAT-100',
      uploadedArtifacts: [
        {
          kind: 'trace',
          name: 'trace.zip',
          url: 'https://youtrack.example.com/youtrack/api/files/trace.zip',
        },
      ],
    });

    const updateBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(updateBody.description).toContain('[trace.zip](https://youtrack.example.com/youtrack/api/files/trace.zip)');
    expect(updateBody.description).not.toContain('__tests__/automated_issue_reporting.youtrack.test.js');
  });
});
