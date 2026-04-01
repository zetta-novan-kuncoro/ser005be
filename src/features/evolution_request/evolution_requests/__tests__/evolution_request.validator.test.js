'use strict';

// US-062, US-063, US-064

const {
  ValidateSubmitEvolutionRequest,
  ValidateEvolutionRequestStatus,
  ValidateAdminEvolutionRequestUpdate,
} = require('../evolution_request.validator');

const VALID_SUBMIT = {
  application_reference: 'my-app',
  type: 'Evolution',
  title: 'Add dark mode',
  submitted_by: 'alice@example.com',
  priority: 2,
};

describe('ValidateSubmitEvolutionRequest (US-062)', () => {
  it('accepts valid minimal input', () => {
    const { error } = ValidateSubmitEvolutionRequest(VALID_SUBMIT);
    expect(error).toBeUndefined();
  });

  it('accepts all optional fields (US-063, US-064)', () => {
    const { error } = ValidateSubmitEvolutionRequest({
      ...VALID_SUBMIT,
      description: 'Please add dark mode',
      expected_date: new Date().toISOString(),
      attachments: ['s3://bucket/screenshot.png'],
    });
    expect(error).toBeUndefined();
  });

  it('accepts null expected_date (US-064)', () => {
    const { error } = ValidateSubmitEvolutionRequest({ ...VALID_SUBMIT, expected_date: null });
    expect(error).toBeUndefined();
  });

  it('requires application_reference', () => {
    const { error } = ValidateSubmitEvolutionRequest({ ...VALID_SUBMIT, application_reference: undefined });
    expect(error).toBeDefined();
  });

  it('requires type (US-062)', () => {
    const { error } = ValidateSubmitEvolutionRequest({ ...VALID_SUBMIT, type: undefined });
    expect(error).toBeDefined();
  });

  it('rejects invalid type (US-062)', () => {
    const { error } = ValidateSubmitEvolutionRequest({ ...VALID_SUBMIT, type: 'Feature' });
    expect(error).toBeDefined();
  });

  it('accepts valid types: Evolution and Fix (US-062)', () => {
    ['Evolution', 'Fix'].forEach((type) => {
      const { error } = ValidateSubmitEvolutionRequest({ ...VALID_SUBMIT, type });
      expect(error).toBeUndefined();
    });
  });

  it('requires title (US-062)', () => {
    const { error } = ValidateSubmitEvolutionRequest({ ...VALID_SUBMIT, title: undefined });
    expect(error).toBeDefined();
  });

  it('requires submitted_by (US-062)', () => {
    const { error } = ValidateSubmitEvolutionRequest({ ...VALID_SUBMIT, submitted_by: undefined });
    expect(error).toBeDefined();
  });

  it('requires priority (US-062)', () => {
    const { error } = ValidateSubmitEvolutionRequest({ ...VALID_SUBMIT, priority: undefined });
    expect(error).toBeDefined();
  });

  it('rejects invalid priority — only 1, 2, 3 allowed (US-062)', () => {
    [0, 4, 'high'].forEach((priority) => {
      const { error } = ValidateSubmitEvolutionRequest({ ...VALID_SUBMIT, priority });
      expect(error).toBeDefined();
    });
  });

  it('accepts all valid priorities: 1, 2, 3 (US-062)', () => {
    [1, 2, 3].forEach((priority) => {
      const { error } = ValidateSubmitEvolutionRequest({ ...VALID_SUBMIT, priority });
      expect(error).toBeUndefined();
    });
  });

  it('rejects invalid expected_date ISO string (US-064)', () => {
    const { error } = ValidateSubmitEvolutionRequest({ ...VALID_SUBMIT, expected_date: 'not-a-date' });
    expect(error).toBeDefined();
  });
});

describe('ValidateEvolutionRequestStatus', () => {
  it('accepts all valid statuses', () => {
    const statuses = [
      'Pending', 'Reviewed', 'Approved', 'Ready for Development',
      'In Development', 'Testing & UAT', 'Release', 'Rejected',
    ];
    statuses.forEach((status) => {
      const { error } = ValidateEvolutionRequestStatus({ status });
      expect(error).toBeUndefined();
    });
  });

  it('rejects invalid status', () => {
    const { error } = ValidateEvolutionRequestStatus({ status: 'Unknown' });
    expect(error).toBeDefined();
  });

  it('requires status field', () => {
    const { error } = ValidateEvolutionRequestStatus({});
    expect(error).toBeDefined();
  });
});

describe('ValidateAdminEvolutionRequestUpdate', () => {
  it('accepts a valid partial update', () => {
    const { error } = ValidateAdminEvolutionRequestUpdate({
      title: 'Updated title',
      priority: 1,
    });

    expect(error).toBeUndefined();
  });

  it('accepts null expected_date', () => {
    const { error } = ValidateAdminEvolutionRequestUpdate({
      expected_date: null,
    });

    expect(error).toBeUndefined();
  });

  it('rejects empty input', () => {
    const { error } = ValidateAdminEvolutionRequestUpdate({});
    expect(error).toBeDefined();
  });

  it('rejects invalid priority', () => {
    const { error } = ValidateAdminEvolutionRequestUpdate({ priority: 4 });
    expect(error).toBeDefined();
  });

  it('rejects invalid type', () => {
    const { error } = ValidateAdminEvolutionRequestUpdate({ type: 'Bug' });
    expect(error).toBeDefined();
  });

  it('rejects unknown keys', () => {
    const { error } = ValidateAdminEvolutionRequestUpdate({ submitted_by: 'alice@example.com' });
    expect(error).toBeDefined();
  });
});
