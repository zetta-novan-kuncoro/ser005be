'use strict';

// US-036, US-037, US-038, US-039, US-040, US-041, US-042, US-043

const { ValidateCreateChangelog, ValidateUpdateChangelog } = require('../changelog.validator');

const VALID_CREATE = {
  application_reference: 'my-app',
  version: '1.2.3',
  title: 'New release',
  change_type: 'Feature',
  impact_scope: 'API',
  release_date: new Date().toISOString(),
};

describe('ValidateCreateChangelog (US-036)', () => {
  it('accepts valid minimal input', () => {
    const { error } = ValidateCreateChangelog(VALID_CREATE);
    expect(error).toBeUndefined();
  });

  it('accepts all optional fields', () => {
    const { error } = ValidateCreateChangelog({
      ...VALID_CREATE,
      summary: 'A summary',
      details_md: '## Details',
      status: 'Draft',
      visibility: 'PublicToCustomers',
      tags: ['api', 'breaking'],
      attachments: ['s3://bucket/file.pdf'],
      released_request_ids: ['req-uuid-1'],
    });
    expect(error).toBeUndefined();
  });

  it('requires application_reference', () => {
    const { error } = ValidateCreateChangelog({ ...VALID_CREATE, application_reference: undefined });
    expect(error).toBeDefined();
  });

  it('requires version', () => {
    const { error } = ValidateCreateChangelog({ ...VALID_CREATE, version: undefined });
    expect(error).toBeDefined();
  });

  it('requires title', () => {
    const { error } = ValidateCreateChangelog({ ...VALID_CREATE, title: undefined });
    expect(error).toBeDefined();
  });

  it('requires change_type', () => {
    const { error } = ValidateCreateChangelog({ ...VALID_CREATE, change_type: undefined });
    expect(error).toBeDefined();
  });

  it('rejects invalid change_type', () => {
    const { error } = ValidateCreateChangelog({ ...VALID_CREATE, change_type: 'Unknown' });
    expect(error).toBeDefined();
  });

  it('accepts all valid change_types', () => {
    ['Feature', 'Fix', 'Breaking', 'Security', 'Performance', 'Ops', 'Compliance'].forEach((ct) => {
      const { error } = ValidateCreateChangelog({ ...VALID_CREATE, change_type: ct });
      expect(error).toBeUndefined();
    });
  });

  it('requires impact_scope', () => {
    const { error } = ValidateCreateChangelog({ ...VALID_CREATE, impact_scope: undefined });
    expect(error).toBeDefined();
  });

  it('rejects invalid impact_scope', () => {
    const { error } = ValidateCreateChangelog({ ...VALID_CREATE, impact_scope: 'Network' });
    expect(error).toBeDefined();
  });

  it('accepts all valid impact_scopes', () => {
    ['UI', 'API', 'Data', 'Infra', 'Mixed'].forEach((scope) => {
      const { error } = ValidateCreateChangelog({ ...VALID_CREATE, impact_scope: scope });
      expect(error).toBeUndefined();
    });
  });

  it('requires release_date (US-043)', () => {
    const { error } = ValidateCreateChangelog({ ...VALID_CREATE, release_date: undefined });
    expect(error).toBeDefined();
  });

  it('rejects invalid release_date (US-043)', () => {
    const { error } = ValidateCreateChangelog({ ...VALID_CREATE, release_date: 'not-a-date' });
    expect(error).toBeDefined();
  });

  it('rejects invalid status', () => {
    const { error } = ValidateCreateChangelog({ ...VALID_CREATE, status: 'Unknown' });
    expect(error).toBeDefined();
  });

  it('rejects invalid visibility', () => {
    const { error } = ValidateCreateChangelog({ ...VALID_CREATE, visibility: 'Everyone' });
    expect(error).toBeDefined();
  });

  describe('ticket validation (US-042)', () => {
    it('accepts valid ticket object', () => {
      const { error } = ValidateCreateChangelog({
        ...VALID_CREATE,
        tickets: [{ ticket_id: 'SAT-123', ticket_ref: 'SAT-123', ticket_name: 'Fix', ticket_url: '' }],
      });
      expect(error).toBeUndefined();
    });

    it('rejects ticket with invalid ticket_url (not a URI)', () => {
      const { error } = ValidateCreateChangelog({
        ...VALID_CREATE,
        tickets: [{ ticket_id: 'SAT-123', ticket_url: 'not-a-url' }],
      });
      expect(error).toBeDefined();
    });

    it('rejects ticket with all empty fields', () => {
      const { error } = ValidateCreateChangelog({
        ...VALID_CREATE,
        tickets: [{ ticket_id: '', ticket_ref: '', ticket_name: '', ticket_url: '' }],
      });
      expect(error).toBeDefined();
    });
  });
});

describe('ValidateUpdateChangelog (US-037)', () => {
  it('accepts empty object (all optional)', () => {
    const { error } = ValidateUpdateChangelog({});
    expect(error).toBeUndefined();
  });

  it('accepts partial update with only title', () => {
    const { error } = ValidateUpdateChangelog({ title: 'Updated title' });
    expect(error).toBeUndefined();
  });

  it('rejects invalid status in update', () => {
    const { error } = ValidateUpdateChangelog({ status: 'Unknown' });
    expect(error).toBeDefined();
  });

  it('accepts Deprecated and RolledBack statuses (US-046)', () => {
    ['Deprecated', 'RolledBack'].forEach((status) => {
      const { error } = ValidateUpdateChangelog({ status });
      expect(error).toBeUndefined();
    });
  });
});
