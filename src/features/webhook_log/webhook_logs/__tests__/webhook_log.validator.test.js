'use strict';

const { ValidateGetAdminWebhookLogs } = require('../webhook_log.validator');

describe('ValidateGetAdminWebhookLogs', () => {
  it('accepts an empty filter', () => {
    const { error } = ValidateGetAdminWebhookLogs({});
    expect(error).toBeUndefined();
  });

  it('accepts all valid fields combined', () => {
    const { error } = ValidateGetAdminWebhookLogs({
      source: 'JIRA',
      processing_status: 'PROCESSED',
      issue_key: 'SAT-123',
      from_date: '2026-01-01',
      to_date: '2026-03-31',
    });
    expect(error).toBeUndefined();
  });

  describe('source', () => {
    it('accepts JIRA', () => {
      const { error } = ValidateGetAdminWebhookLogs({ source: 'JIRA' });
      expect(error).toBeUndefined();
    });

    it('accepts YouTrack', () => {
      const { error } = ValidateGetAdminWebhookLogs({ source: 'YouTrack' });
      expect(error).toBeUndefined();
    });

    it('rejects invalid source', () => {
      const { error } = ValidateGetAdminWebhookLogs({ source: 'GitHub' });
      expect(error).toBeDefined();
    });
  });

  describe('processing_status', () => {
    const validStatuses = ['SIGNATURE_REJECTED', 'PARSE_FAILED', 'IGNORED', 'PROCESSED', 'FAILED'];

    validStatuses.forEach((status) => {
      it(`accepts ${status}`, () => {
        const { error } = ValidateGetAdminWebhookLogs({ processing_status: status });
        expect(error).toBeUndefined();
      });
    });

    it('rejects invalid processing_status', () => {
      const { error } = ValidateGetAdminWebhookLogs({ processing_status: 'UNKNOWN' });
      expect(error).toBeDefined();
    });
  });

  describe('issue_key', () => {
    it('accepts a valid issue key', () => {
      const { error } = ValidateGetAdminWebhookLogs({ issue_key: 'SAT-42' });
      expect(error).toBeUndefined();
    });

    it('rejects an issue_key exceeding 50 characters', () => {
      const { error } = ValidateGetAdminWebhookLogs({ issue_key: 'A'.repeat(51) });
      expect(error).toBeDefined();
    });
  });

  describe('from_date / to_date', () => {
    it('accepts valid ISO date strings', () => {
      const { error } = ValidateGetAdminWebhookLogs({ from_date: '2026-01-01', to_date: '2026-12-31' });
      expect(error).toBeUndefined();
    });

    it('rejects non-date strings', () => {
      const { error } = ValidateGetAdminWebhookLogs({ from_date: 'not-a-date' });
      expect(error).toBeDefined();
    });
  });

  describe('unknown keys', () => {
    it('rejects unknown filter keys', () => {
      const { error } = ValidateGetAdminWebhookLogs({ unknown_field: 'value' });
      expect(error).toBeDefined();
    });
  });
});
