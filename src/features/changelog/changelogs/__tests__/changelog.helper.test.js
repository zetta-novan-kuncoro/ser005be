'use strict';

// US-039, US-040, US-041, US-042, US-043, US-044, US-045

jest.mock('../changelog.model');
jest.mock('../../../evolution_request/evolution_requests/evolution_request.model');
jest.mock('../../../../shared/s3.service', () => ({
  UploadBuffer: jest.fn(),
  GetSignedUploadUrl: jest.fn(),
  GetSignedDownloadUrl: jest.fn(),
}));
jest.mock('../../../../utils/hash.util', () => ({
  GenerateSha256: jest.fn(),
}));
jest.mock('../../../../shared/integrations/jira/jira.helper', () => ({
  AddJiraComment: jest.fn(),
  CreateJiraIssue: jest.fn(),
  GetJiraIssueStatus: jest.fn(),
}));
jest.mock('../../../user_log/user_logs/user_log.helper', () => ({
  AppendUserLog: jest.fn(),
}));
jest.mock('../../../../core/config', () => ({
  jira: { baseUrl: 'https://jira.example.com', userEmail: 'user@example.com', apiToken: 'token', projectKey: 'SAT' },
  isProduction: false,
}));

const ChangelogModel = require('../changelog.model');
const EvolutionRequestModel = require('../../../evolution_request/evolution_requests/evolution_request.model');
const { UploadBuffer } = require('../../../../shared/s3.service');
const { GenerateSha256 } = require('../../../../utils/hash.util');
const { AddJiraComment } = require('../../../../shared/integrations/jira/jira.helper');

const {
  CreateChangelog,
  CreateChangelogRevision,
  PublishChangelog,
  UpdateChangelog,
  GetPublicChangelogs,
  GetAdminChangelogs,
  GetChangelog,
} = require('../changelog.helper');

function mockEntry(overrides = {}) {
  return {
    _id: 'entry-mongo-id',
    entry_id: 'uuid-entry-1',
    entry_group_id: 'uuid-entry-1',
    revision_number: 1,
    previous_entry_id: null,
    application_reference: 'test-app',
    version: '1.0.0',
    title: 'Release',
    change_type: 'Feature',
    impact_scope: 'API',
    release_date: new Date().toISOString(),
    status: 'Draft',
    visibility: 'PublicToCustomers',
    published_at: null,
    tickets: [],
    tags: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  GenerateSha256.mockReturnValue('abc123sha256');
  UploadBuffer.mockResolvedValue({ ok: true });
  AddJiraComment.mockResolvedValue({ ok: true });
});

describe('CreateChangelog (US-036)', () => {
  it('creates a changelog entry and returns it', async () => {
    const entry = mockEntry();
    ChangelogModel.create = jest.fn().mockResolvedValue({ ...entry, toObject: () => entry });

    const result = await CreateChangelog({
      application_reference: 'test-app',
      version: '1.0.0',
      title: 'Release',
      change_type: 'Feature',
      impact_scope: 'API',
      release_date: new Date().toISOString(),
    });

    expect(ChangelogModel.create).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty('entry_id');
  });

  it('throws VALIDATION_ERROR for missing required fields', async () => {
    await expect(CreateChangelog({ title: 'No app ref' })).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });

  it('publishes immediately when created with Published status', async () => {
    const draft = mockEntry({ status: 'Draft' });
    const published = mockEntry({
      status: 'Published',
      immutable_sha256: 'abc123sha256',
      immutable_s3_key: 'changelogs/snapshots/uuid-entry-1.json',
      published_at: new Date().toISOString(),
    });

    ChangelogModel.create = jest.fn().mockResolvedValue({ ...draft, toObject: () => draft });
    ChangelogModel.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(published) });

    const result = await CreateChangelog({
      application_reference: 'test-app',
      version: '1.0.0',
      title: 'Release',
      change_type: 'Feature',
      impact_scope: 'API',
      release_date: new Date().toISOString(),
      status: 'Published',
    });

    expect(result.status).toBe('Published');
    expect(result.published_at).toBeDefined();
  });
});

describe('PublishChangelog (US-039)', () => {
  it('publishes a draft entry and uploads snapshot to S3', async () => {
    const draft = mockEntry({ status: 'Draft' });
    ChangelogModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(draft) });
    const published = mockEntry({ status: 'Published', immutable_sha256: 'abc123sha256', immutable_s3_key: 'changelogs/snapshots/uuid-entry-1.json' });
    ChangelogModel.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(published) });

    const result = await PublishChangelog('uuid-entry-1');

    expect(GenerateSha256).toHaveBeenCalledTimes(1);
    expect(UploadBuffer).toHaveBeenCalledWith(
      'changelogs/snapshots/uuid-entry-1.json',
      expect.any(Buffer),
      'application/json'
    );
    expect(result.status).toBe('Published');
    expect(result.immutable_sha256).toBe('abc123sha256');
  });

  it('throws CONFLICT for already-published entry (US-039)', async () => {
    const published = mockEntry({ status: 'Published' });
    ChangelogModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(published) });

    await expect(PublishChangelog('uuid-entry-1')).rejects.toMatchObject({
      extensions: { code: 'CONFLICT' },
    });
  });

  it('throws NOT_FOUND for missing entry', async () => {
    ChangelogModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    await expect(PublishChangelog('non-existent')).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
  });

  it('links released_request_ids on publish (US-040)', async () => {
    const draft = mockEntry({ status: 'Draft' });
    ChangelogModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(draft) });

    const published = mockEntry({ status: 'Published' });
    ChangelogModel.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(published) });

    const evReq = {
      request_id: 'req-1',
      application_reference: 'test-app',
      jira_issue_key: 'SAT-100',
      jira_issue_url: 'https://jira.example.com/browse/SAT-100',
      title: 'Feature A',
    };
    EvolutionRequestModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(evReq) });
    EvolutionRequestModel.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(evReq) });

    await PublishChangelog('uuid-entry-1', null, ['req-1']);

    expect(EvolutionRequestModel.findOneAndUpdate).toHaveBeenCalledWith(
      { request_id: 'req-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          released_in_entry_id: 'uuid-entry-1',
          status: 'Release',
        }),
      })
    );
  });

  it('skips linking requests from another application', async () => {
    const draft = mockEntry({ status: 'Draft', application_reference: 'test-app' });
    ChangelogModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(draft) });

    const published = mockEntry({ status: 'Published', application_reference: 'test-app' });
    ChangelogModel.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(published) });

    const foreignRequest = {
      request_id: 'req-2',
      application_reference: 'other-app',
      jira_issue_key: 'SAT-200',
      jira_issue_url: 'https://jira.example.com/browse/SAT-200',
      title: 'Foreign Feature',
    };
    EvolutionRequestModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(foreignRequest) });
    EvolutionRequestModel.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(foreignRequest) });

    await PublishChangelog('uuid-entry-1', null, ['req-2']);

    expect(EvolutionRequestModel.findOneAndUpdate).not.toHaveBeenCalledWith(
      { request_id: 'req-2' },
      expect.objectContaining({
        $set: expect.objectContaining({ released_in_entry_id: 'uuid-entry-1' }),
      })
    );
  });

  it('JIRA comment failure does not throw (US-040)', async () => {
    const draft = mockEntry({ status: 'Draft' });
    ChangelogModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(draft) });
    const published = mockEntry({ status: 'Published' });
    ChangelogModel.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(published) });

    const evReq = {
      request_id: 'req-1',
      application_reference: 'test-app',
      jira_issue_key: 'SAT-100',
      title: 'Feature',
    };
    EvolutionRequestModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(evReq) });
    EvolutionRequestModel.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(evReq) });
    AddJiraComment.mockResolvedValue({ ok: false });

    // Should not throw even when JIRA comment fails
    await expect(PublishChangelog('uuid-entry-1', null, ['req-1'])).resolves.toBeDefined();
  });
});

describe('UpdateChangelog (US-037)', () => {
  it('applies partial update and returns updated document', async () => {
    const updated = mockEntry({ title: 'Updated Title' });
    ChangelogModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockEntry()) });
    ChangelogModel.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(updated) });

    const result = await UpdateChangelog('uuid-entry-1', { title: 'Updated Title' });
    expect(result.title).toBe('Updated Title');
  });

  it('throws NOT_FOUND for missing entry', async () => {
    ChangelogModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    ChangelogModel.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    await expect(UpdateChangelog('non-existent', { title: 'X' })).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
  });

  it('rejects direct edits to published entries', async () => {
    ChangelogModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockEntry({ status: 'Published' })) });

    await expect(UpdateChangelog('uuid-entry-1', { title: 'Updated Title' })).rejects.toMatchObject({
      extensions: { code: 'CONFLICT' },
    });
  });
});

describe('CreateChangelogRevision', () => {
  it('creates a draft revision from a published changelog', async () => {
    const source = mockEntry({
      status: 'Published',
      entry_id: 'published-entry',
      entry_group_id: 'group-1',
      revision_number: 2,
      published_at: '2026-03-02T00:00:00.000Z',
    });
    ChangelogModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(source) });
    ChangelogModel.create = jest.fn().mockImplementation(async (payload) => ({
      ...payload,
      toObject: () => payload,
    }));

    const result = await CreateChangelogRevision('published-entry', { title: 'Revision title' }, 'admin@example.com');

    expect(result.status).toBe('Draft');
    expect(result.entry_group_id).toBe('group-1');
    expect(result.revision_number).toBe(3);
    expect(result.previous_entry_id).toBe('published-entry');
    expect(result.title).toBe('Revision title');
  });

  it('rejects revising non-published changelogs', async () => {
    ChangelogModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockEntry({ status: 'Draft' })) });

    await expect(CreateChangelogRevision('uuid-entry-1', { title: 'X' })).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });
});

describe('GetPublicChangelogs (US-041, US-049)', () => {
  it('queries only Published + PublicToCustomers entries', async () => {
    ChangelogModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    await GetPublicChangelogs('test-app');

    expect(ChangelogModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Published', visibility: 'PublicToCustomers' })
    );
  });

  it('serializes ticket strings into structured ticket objects', async () => {
    ChangelogModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          mockEntry({
            status: 'Published',
            tickets: ['SAT-10'],
          }),
        ]),
      }),
    });

    const result = await GetPublicChangelogs('test-app');

    expect(result.data[0].tickets).toEqual([
      {
        ticket_id: 'SAT-10',
        ticket_ref: 'SAT-10',
        ticket_name: '',
        ticket_url: '',
      },
    ]);
  });

  it('returns only the latest published revision per entry group', async () => {
    ChangelogModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          mockEntry({
            entry_id: 'entry-v1',
            entry_group_id: 'group-1',
            revision_number: 1,
            status: 'Published',
            published_at: '2026-03-01T00:00:00.000Z',
            title: 'Old revision',
          }),
          mockEntry({
            entry_id: 'entry-v2',
            entry_group_id: 'group-1',
            revision_number: 2,
            status: 'Published',
            published_at: '2026-03-02T00:00:00.000Z',
            title: 'New revision',
          }),
        ]),
      }),
    });

    const result = await GetPublicChangelogs('test-app');

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].entry_id).toBe('entry-v2');
  });
});

describe('GetChangelog (US-048)', () => {
  it('returns entry when found', async () => {
    const entry = mockEntry();
    ChangelogModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(entry) });

    const result = await GetChangelog('uuid-entry-1');
    expect(result.entry_id).toBe('uuid-entry-1');
  });

  it('throws NOT_FOUND for missing entry', async () => {
    ChangelogModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    await expect(GetChangelog('non-existent')).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
  });
});

describe('GetAdminChangelogs (US-038, US-044, US-045)', () => {
  beforeEach(() => {
    ChangelogModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
        }),
      }),
    });
    ChangelogModel.countDocuments = jest.fn().mockResolvedValue(0);
  });

  it('applies status filter (US-038)', async () => {
    await GetAdminChangelogs({ status: 'Published' });
    expect(ChangelogModel.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'Published' }));
  });

  it('applies visibility filter (US-044)', async () => {
    await GetAdminChangelogs({ visibility: 'InternalOnly' });
    expect(ChangelogModel.find).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'InternalOnly' }));
  });

  it('applies search filter as $or query (US-045)', async () => {
    await GetAdminChangelogs({ search: 'feature' });
    expect(ChangelogModel.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }));
  });

  it('returns paginated response shape', async () => {
    const result = await GetAdminChangelogs({}, { page: 1, limit: 10 });
    expect(result).toMatchObject({ data: [], total: 0, page: 1, limit: 10, total_pages: 1 });
  });
});
