# Automated Issue Reporting

Repo-root CI tool that reads FE and BE test artifacts, normalizes failures, and creates or updates YouTrack issues for repeated automated findings.

## Entry Point

```bash
node tools/automated-issue-reporting/run.js
```

## Expected Inputs

- FE Playwright JSON report at `sat-changelog-fe/test-results/playwright-results.json`
- FE HTML report at `sat-changelog-fe/playwright-report/index.html`
- BE Jest JSON report at `sat-changelog-be/test-results/jest-results.json`

## Required Environment

- `YOUTRACK_BASE_URL`
- `YOUTRACK_API_TOKEN`
- `YOUTRACK_PROJECT_ID`

## Optional Environment

- `AUTOMATED_ISSUE_PROJECT_KEY`
- `AUTOMATED_ISSUE_CI_BRANCH`
- `AUTOMATED_ISSUE_CI_COMMIT`
- `AUTOMATED_ISSUE_CI_RUN_URL`
- `AUTOMATED_ISSUE_ENVIRONMENT_NAME`
- `AUTOMATED_ISSUE_ENVIRONMENT_URL`
- `AUTOMATED_ISSUE_WRITE_BRANCHES`
- `AUTOMATED_ISSUE_DRY_RUN`
- `AUTOMATED_ISSUE_YOUTRACK_PROJECT_QUERY`
- `AUTOMATED_ISSUE_YOUTRACK_FINGERPRINT_FIELD_NAME`
- `AUTOMATED_ISSUE_YOUTRACK_FINGERPRINT_FIELD_TYPE`

## Branch Policy

Default write allowlist:

- `main`
- `staging`
- `release/*`

When the current branch is outside that allowlist, the tool emits a summary and skips YouTrack writes.
