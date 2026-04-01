'use strict';

const path = require('path');

const {
  ClassifyFinding,
  CollectBeFindings,
  CollectFeFindings,
  ExtractSelector,
  FinalizeFinding,
  NormalizeMessage,
} = require('../../../tools/automated-issue-reporting/findings');

const CONFIG = {
  repoRoot: '/home/pan/code/sat-changelog',
  projectKey: 'sat-changelog',
  branch: 'main',
  commit: 'abc123',
  runUrl: 'https://ci.example.com/runs/1',
  environmentName: 'ci',
  environmentUrl: 'https://app.example.com',
  paths: {
    feHtmlReportIndex: path.join(__dirname, '..', '..', '..', 'sat-changelog-fe', 'playwright-report', 'index.html'),
  },
};

describe('automated issue reporting findings', () => {
  it('normalizes volatile values from failure text', () => {
    const normalized = NormalizeMessage('Timeout 5000ms at /home/pan/code/file.js:42:9 request_id=req-123');

    expect(normalized).toContain('<duration>');
    expect(normalized).toContain('<path>');
    expect(normalized).toContain('request_id=<request-id>');
  });

  it('classifies retry-pass failures as flaky', () => {
    const finding = FinalizeFinding({
      source: 'ci',
      layer: 'fe-e2e',
      projectKey: 'sat-changelog',
      filePath: 'sat-changelog-fe/e2e/kanban.spec.ts',
      suiteName: 'Kanban Board (US-121-124)',
      testName: 'approve button is disabled while mutation is in flight',
      fullTestName: 'Kanban Board (US-121-124) > approve button is disabled while mutation is in flight',
      attempt: 2,
      finalAttemptCount: 2,
      passedOnRetry: true,
      rawMessage: 'expect(locator).toBeDisabled() failed',
      artifacts: [],
      occurredAt: '2026-03-30T00:00:00.000Z',
    });

    expect(finding.classification).toBe('flaky');
    expect(finding.summary).toContain('[FLAKY]');
  });

  it('classifies setup-style failures as infra/setup', () => {
    expect(ClassifyFinding({
      normalizedMessage: 'global.setup seed failed before scenario execution',
      rawMessage: '',
      stackTop: null,
      filePath: 'sat-changelog-fe/e2e/fixtures/global.setup.ts',
      fullTestName: 'global setup',
      passedOnRetry: false,
    })).toBe('infra-setup');
  });

  it('treats undefined-property failures in app code as hard-fail', () => {
    expect(ClassifyFinding({
      normalizedMessage: 'Cannot read properties of undefined (reading ok)',
      rawMessage: 'TypeError: Cannot read properties of undefined (reading ok)\n    at sat-changelog-be/src/features/evolution_request/evolution_requests/evolution_request.helper.js:120:5',
      stackTop: 'at sat-changelog-be/src/features/evolution_request/evolution_requests/evolution_request.helper.js:<line>:<column>',
      filePath: 'sat-changelog-be/src/features/evolution_request/evolution_requests/evolution_request.helper.js',
      fullTestName: 'UpdateEvolutionRequestStatus > should reject invalid release',
      passedOnRetry: false,
    })).toBe('hard-fail');
  });

  it('treats undefined-property failures in fixture code as test-defect', () => {
    expect(ClassifyFinding({
      normalizedMessage: 'Cannot read properties of undefined (reading ok)',
      rawMessage: 'TypeError: Cannot read properties of undefined (reading ok)\n    at sat-changelog-fe/e2e/page-objects/request-form.ts:21:5',
      stackTop: 'at sat-changelog-fe/e2e/page-objects/request-form.ts:<line>:<column>',
      filePath: 'sat-changelog-fe/e2e/page-objects/request-form.ts',
      fullTestName: 'request form page object',
      passedOnRetry: false,
    })).toBe('test-defect');
  });

  it('sanitizes ansi color-code remnants from selector extraction', () => {
    const selector = ExtractSelector("locator([32mgetByRole('button', { name: 'Save' })[39m)");
    expect(selector).toBe("locator(getByRole('button', { name: 'Save' }))");
  });

  it('collects FE findings from Playwright JSON shape', () => {
    const findings = CollectFeFindings({
      suites: [
        {
          title: 'Kanban Board (US-121-124)',
          specs: [
            {
              title: 'US-123: approve button is disabled while mutation is in flight',
              file: 'sat-changelog-fe/e2e/kanban.spec.ts',
              tests: [
                {
                  projectName: 'chromium',
                  results: [
                    {
                      status: 'failed',
                      retry: 0,
                      startTime: '2026-03-30T00:00:00.000Z',
                      errors: [{ message: "expect(locator([32mgetByRole('button', { name: 'Approve' })[39m)).toBeDisabled() failed\nat sat-changelog-fe/e2e/kanban.spec.ts:20:5" }],
                      attachments: [],
                    },
                    {
                      status: 'passed',
                      retry: 1,
                      startTime: '2026-03-30T00:01:00.000Z',
                      attachments: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }, CONFIG);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      layer: 'fe-e2e',
      classification: 'flaky',
      browser: 'chromium',
      passedOnRetry: true,
      selector: "locator(getByRole('button', { name: 'Approve' }))",
    });
  });

  it('collects BE findings from Jest JSON output', () => {
    const findings = CollectBeFindings({
      testResults: [
        {
          name: path.join(CONFIG.repoRoot, 'sat-changelog-be/src/features/evolution_request/evolution_requests/__tests__/evolution_request.helper.test.js'),
          assertionResults: [
            {
              status: 'failed',
              title: 'Release transition is forbidden via this mutation',
              fullName: 'UpdateEvolutionRequestStatus > Release transition is forbidden via this mutation',
              ancestorTitles: ['UpdateEvolutionRequestStatus'],
              failureMessages: ['Error: promise resolved instead of rejected\n    at sat-changelog-be/src/features/evolution_request/evolution_requests/evolution_request.helper.js:120:5'],
            },
          ],
        },
      ],
    }, CONFIG);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      layer: 'be-unit',
      classification: 'hard-fail',
      featureHint: 'evolution_request',
    });
    expect(findings[0].summary).toContain('[HARD]');
  });
});
