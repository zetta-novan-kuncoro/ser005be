'use strict';

const { Run } = require('./index');

Run().catch((error) => {
  console.error('[AutomatedIssueReporting] Failed:', error.message);
  process.exitCode = 1;
});
