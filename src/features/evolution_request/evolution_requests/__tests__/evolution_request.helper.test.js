'use strict';

// US-076–US-112 — critical workflow cases

jest.mock('../evolution_request.model');
jest.mock('../../../user_log/user_logs/user_log.helper');
jest.mock('../../../../shared/integrations/jira/jira.helper');
jest.mock('../../../../shared/integrations/youtrack/youtrack.helper');
jest.mock('../../../../shared/integrations/evolution_request_sync.helper');
jest.mock('../../../../core/config', () => ({
  jira: {
    baseUrl: 'https://jira.example.com',
    userEmail: 'user@example.com',
    apiToken: 'token',
    projectKey: 'SAT',
  },
  youtrack: {
    baseUrl: 'https://youtrack.example.com',
    apiToken: 'yt-token',
    projectId: '0-1',
  },
  isProduction: false,
}));

const EvolutionRequestModel = require('../evolution_request.model');
const { AppendUserLog } = require('../../../user_log/user_logs/user_log.helper');
const { AddJiraComment, CreateJiraIssue, TransitionJiraIssue } = require('../../../../shared/integrations/jira/jira.helper');
const { CreateYouTrackIssue } = require('../../../../shared/integrations/youtrack/youtrack.helper');
const { SyncEvolutionRequestOnApproval } = require('../../../../shared/integrations/evolution_request_sync.helper');

const {
  GetPublicEvolutionRequests,
  AdminUpdateEvolutionRequest,
  UpdateEvolutionRequestStatus,
  ReviewEvolutionRequest,
  ApproveEvolutionRequest,
  RejectEvolutionRequest,
  RetryEvolutionRequestIntegrations,
  AssignEvolutionRequestPhase,
  UnassignEvolutionRequestPhase,
  GetEvolutionRequest,
  SubmitEvolutionRequest,
  RefreshEvolutionRequestExternalStatus,
} = require('../evolution_request.helper');

function mockRequest(overrides = {}) {
  return {
    _id: 'mongo-id-123',
    request_id: 'req-uuid-1',
    application_reference: 'test-app',
    type: 'Evolution',
    title: 'Test request',
    submitted_by: 'alice@example.com',
    priority: 2,
    status: 'Pending',
    jira_sync_state: null,
    youtrack_sync_state: null,
    jira_issue_key: null,
    jira_issue_url: null,
    integration_errors: [],
    ...overrides,
  };
}

function setupFindOne(req) {
  EvolutionRequestModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(req) });
}

function setupFindOneAndUpdate(req) {
  EvolutionRequestModel.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(req) });
}

function setupFindChain(data, querySink = null) {
  const limit = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(data) });
  const skip = jest.fn().mockReturnValue({ limit });
  const sort = jest.fn().mockReturnValue({ skip });
  EvolutionRequestModel.find = jest.fn((query) => {
    if (querySink) {
      querySink(query);
    }

    return { sort };
  });

  return { sort, skip, limit };
}

beforeEach(() => {
  jest.clearAllMocks();
  AppendUserLog.mockResolvedValue(undefined);
  AddJiraComment.mockResolvedValue({ ok: true });
  TransitionJiraIssue.mockResolvedValue({ ok: true });
  EvolutionRequestModel.countDocuments = jest.fn().mockResolvedValue(0);
  EvolutionRequestModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
});

// ─── GetEvolutionRequest (US-077) ───────────────────────────────────────────

describe('GetEvolutionRequest (US-077)', () => {
  it('returns the request when found', async () => {
    const req = mockRequest();
    setupFindOne(req);
    const result = await GetEvolutionRequest('req-uuid-1');
    expect(result.request_id).toBe('req-uuid-1');
  });

  it('throws NOT_FOUND when request does not exist', async () => {
    setupFindOne(null);
    await expect(GetEvolutionRequest('non-existent')).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
  });
});

// ─── SubmitEvolutionRequest (US-061, US-067) ────────────────────────────────

describe('SubmitEvolutionRequest (US-061, US-067)', () => {
  it('creates a request with status Pending and returns public fields only', async () => {
    const created = mockRequest({ status: 'Pending' });
    EvolutionRequestModel.create = jest.fn().mockResolvedValue({ ...created, toObject: () => created });

    const result = await SubmitEvolutionRequest({
      application_reference: 'test-app',
      type: 'Evolution',
      title: 'Add dark mode',
      submitted_by: 'alice@example.com',
      priority: 1,
    });

    expect(result.status).toBe('Pending');
    expect(result).not.toHaveProperty('jira_sync_state');
    expect(result).not.toHaveProperty('youtrack_sync_state');
    expect(result).toHaveProperty('submitted_by_display_name', 'alice@example.com');
    expect(result).not.toHaveProperty('submitted_by');
    expect(result).not.toHaveProperty('attachments');
  });

  it('calls AppendUserLog with SUBMIT_EVOLUTION_REQUEST (US-067)', async () => {
    const created = mockRequest({ status: 'Pending' });
    EvolutionRequestModel.create = jest.fn().mockResolvedValue({ ...created, toObject: () => created });

    await SubmitEvolutionRequest({
      application_reference: 'test-app',
      type: 'Fix',
      title: 'Fix bug',
      submitted_by: 'bob@example.com',
      priority: 3,
    });

    expect(AppendUserLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SUBMIT_EVOLUTION_REQUEST' })
    );
  });

  it('does not throw when AppendUserLog fails (US-204)', async () => {
    const created = mockRequest({ status: 'Pending' });
    EvolutionRequestModel.create = jest.fn().mockResolvedValue({ ...created, toObject: () => created });
    AppendUserLog.mockRejectedValue(new Error('log error'));

    await expect(
      SubmitEvolutionRequest({
        application_reference: 'test-app',
        type: 'Evolution',
        title: 'Title',
        submitted_by: 'user',
        priority: 1,
      })
    ).resolves.toBeDefined();
  });

  it('throws VALIDATION_ERROR for missing required fields (US-062)', async () => {
    await expect(SubmitEvolutionRequest({ title: 'No app ref' })).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });

  it('rejects honeypot submissions', async () => {
    await expect(
      SubmitEvolutionRequest({
        application_reference: 'test-app',
        type: 'Evolution',
        title: 'Blocked',
        submitted_by: 'alice@example.com',
        priority: 1,
        website: 'spam',
      })
    ).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN_ACTION' },
    });
  });

  it('rejects duplicate submissions inside the duplicate window', async () => {
    setupFindOne(mockRequest({ status: 'Pending', title: 'Add dark mode' }));

    await expect(
      SubmitEvolutionRequest({
        application_reference: 'test-app',
        type: 'Evolution',
        title: 'Add dark mode',
        description: '',
        submitted_by: 'alice@example.com',
        priority: 1,
      })
    ).rejects.toMatchObject({
      extensions: { code: 'DUPLICATE_REQUEST' },
    });
  });

  it('rate limits repeated submissions from the same IP', async () => {
    EvolutionRequestModel.countDocuments = jest.fn().mockResolvedValue(5);

    await expect(
      SubmitEvolutionRequest(
        {
          application_reference: 'test-app',
          type: 'Evolution',
          title: 'Add dark mode',
          submitted_by: 'alice@example.com',
          priority: 1,
        },
        { ip: '203.0.113.10' }
      )
    ).rejects.toMatchObject({
      extensions: { code: 'RATE_LIMITED' },
    });
  });
});

describe('GetPublicEvolutionRequests', () => {
  it('filters by application_reference and returns paginated data', async () => {
    let capturedQuery = null;
    setupFindChain([mockRequest()], (query) => {
      capturedQuery = query;
    });
    EvolutionRequestModel.countDocuments = jest.fn().mockResolvedValue(1);

    const result = await GetPublicEvolutionRequests(
      'test-app',
      { status: 'Pending', priority: 2 },
      { page: 1, limit: 10 },
      { field: 'updated_at', order: 'asc' }
    );

    expect(capturedQuery).toMatchObject({
      application_reference: 'test-app',
      status: 'Pending',
      priority: 2,
    });
    expect(result).toMatchObject({
      total: 1,
      page: 1,
      limit: 10,
      total_pages: 1,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toHaveProperty('submitted_by_display_name', 'alice@example.com');
    expect(result.data[0]).not.toHaveProperty('submitted_by');
    expect(result.data[0]).not.toHaveProperty('attachments');
  });
});

describe('AdminUpdateEvolutionRequest', () => {
  it('updates editable fields for Pending requests', async () => {
    setupFindOne(mockRequest({ status: 'Pending', title: 'Old title', priority: 2 }));
    setupFindOneAndUpdate(mockRequest({ status: 'Pending', title: 'New title', priority: 1 }));

    const result = await AdminUpdateEvolutionRequest(
      'req-uuid-1',
      { title: 'New title', priority: 1 },
      { id: 'admin-1', label: 'admin@example.com' }
    );

    expect(result.title).toBe('New title');
    expect(result.priority).toBe(1);
    expect(AppendUserLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ADMIN_UPDATE_EVOLUTION_REQUEST',
        before_state: { title: 'Old title', priority: 2 },
        after_state: { title: 'New title', priority: 1 },
      })
    );
  });

  it('updates editable fields for Reviewed requests', async () => {
    setupFindOne(mockRequest({ status: 'Reviewed', description: 'Old description' }));
    setupFindOneAndUpdate(mockRequest({ status: 'Reviewed', description: 'Updated description' }));

    const result = await AdminUpdateEvolutionRequest('req-uuid-1', { description: 'Updated description' });
    expect(result.description).toBe('Updated description');
  });

  it('rejects non-editable statuses with FORBIDDEN_ACTION', async () => {
    setupFindOne(mockRequest({ status: 'Approved' }));

    await expect(
      AdminUpdateEvolutionRequest('req-uuid-1', { title: 'Blocked change' })
    ).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN_ACTION' },
    });
  });

  it('returns existing record without logging when values do not change', async () => {
    setupFindOne(mockRequest({ status: 'Pending', title: 'No-op title' }));
    EvolutionRequestModel.findOneAndUpdate = jest.fn();

    const result = await AdminUpdateEvolutionRequest('req-uuid-1', { title: 'No-op title' });

    expect(result.title).toBe('No-op title');
    expect(EvolutionRequestModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(AppendUserLog).not.toHaveBeenCalled();
  });

  it('does not throw when AppendUserLog fails', async () => {
    setupFindOne(mockRequest({ status: 'Pending', title: 'Old title' }));
    setupFindOneAndUpdate(mockRequest({ status: 'Pending', title: 'New title' }));
    AppendUserLog.mockRejectedValue(new Error('log error'));

    await expect(
      AdminUpdateEvolutionRequest('req-uuid-1', { title: 'New title' })
    ).resolves.toBeDefined();
  });
});

// ─── ReviewEvolutionRequest (US-079) ─────────────────────────────────────────

describe('ReviewEvolutionRequest (US-079)', () => {
  it('moves Pending → Reviewed', async () => {
    const before = mockRequest({ status: 'Pending' });
    const after = mockRequest({ status: 'Reviewed' });
    setupFindOne(before);
    setupFindOneAndUpdate(after);

    const result = await ReviewEvolutionRequest('req-uuid-1');
    expect(result.status).toBe('Reviewed');
  });

  it('throws VALIDATION_ERROR for non-Pending status (US-079)', async () => {
    setupFindOne(mockRequest({ status: 'Approved' }));
    await expect(ReviewEvolutionRequest('req-uuid-1')).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });
});

// ─── ApproveEvolutionRequest (US-078) ────────────────────────────────────────

describe('ApproveEvolutionRequest (US-078)', () => {
  it('delegates to SyncEvolutionRequestOnApproval for Reviewed requests', async () => {
    const reviewed = mockRequest({ status: 'Reviewed' });
    setupFindOne(reviewed);
    const approved = mockRequest({ status: 'Approved', jira_sync_state: 'SUCCEEDED' });
    SyncEvolutionRequestOnApproval.mockResolvedValue(approved);

    const result = await ApproveEvolutionRequest('req-uuid-1');
    expect(SyncEvolutionRequestOnApproval).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('Approved');
  });

  it('is idempotent — returns current record when already Approved (US-078)', async () => {
    const already = mockRequest({ status: 'Approved' });
    setupFindOne(already);

    const result = await ApproveEvolutionRequest('req-uuid-1');
    expect(SyncEvolutionRequestOnApproval).not.toHaveBeenCalled();
    expect(result.status).toBe('Approved');
  });

  it('throws VALIDATION_ERROR for non-Reviewed status (US-078)', async () => {
    setupFindOne(mockRequest({ status: 'Pending' }));
    await expect(ApproveEvolutionRequest('req-uuid-1')).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });
});

// ─── RejectEvolutionRequest (US-080) ─────────────────────────────────────────

describe('RejectEvolutionRequest (US-080)', () => {
  it('moves Reviewed → Rejected with optional reason', async () => {
    setupFindOne(mockRequest({ status: 'Reviewed' }));
    const rejected = mockRequest({ status: 'Rejected', rejection_reason: 'Out of scope' });
    setupFindOneAndUpdate(rejected);

    const result = await RejectEvolutionRequest('req-uuid-1', 'Out of scope');
    expect(result.status).toBe('Rejected');
  });

  it('throws VALIDATION_ERROR for non-Reviewed status (US-080)', async () => {
    setupFindOne(mockRequest({ status: 'Pending' }));
    await expect(RejectEvolutionRequest('req-uuid-1')).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });
});

// ─── UpdateEvolutionRequestStatus — delivery gate (US-101–US-112) ────────────

describe('UpdateEvolutionRequestStatus (US-101–US-112)', () => {
  it('Approved → Ready for Development — blocked when jira_sync_state !== SUCCEEDED (US-101)', async () => {
    setupFindOne(mockRequest({ status: 'Approved', jira_sync_state: 'FAILED' }));
    await expect(
      UpdateEvolutionRequestStatus('req-uuid-1', 'Ready for Development')
    ).rejects.toMatchObject({
      extensions: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
  });

  it('Approved → Ready for Development — blocked when jira_sync_state is null (US-101)', async () => {
    setupFindOne(mockRequest({ status: 'Approved', jira_sync_state: null }));
    await expect(
      UpdateEvolutionRequestStatus('req-uuid-1', 'Ready for Development')
    ).rejects.toMatchObject({
      extensions: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
  });

  it('Approved → Ready for Development — allowed when jira_sync_state === SUCCEEDED (US-101)', async () => {
    const before = mockRequest({ status: 'Approved', jira_sync_state: 'SUCCEEDED' });
    setupFindOne(before);
    const after = mockRequest({ status: 'Ready for Development', jira_sync_state: 'SUCCEEDED' });
    setupFindOneAndUpdate(after);

    const result = await UpdateEvolutionRequestStatus('req-uuid-1', 'Ready for Development');
    expect(result.status).toBe('Ready for Development');
  });

  it('Approved → Ready for Development — skipJiraGate=true bypasses gate (US-112)', async () => {
    const before = mockRequest({ status: 'Approved', jira_sync_state: 'PENDING' });
    setupFindOne(before);
    const after = mockRequest({ status: 'Ready for Development' });
    setupFindOneAndUpdate(after);

    const result = await UpdateEvolutionRequestStatus('req-uuid-1', 'Ready for Development', null, { skipJiraGate: true });
    expect(result.status).toBe('Ready for Development');
  });

  it('Ready for Development → In Development is valid (US-102)', async () => {
    const before = mockRequest({ status: 'Ready for Development' });
    setupFindOne(before);
    const after = mockRequest({ status: 'In Development' });
    setupFindOneAndUpdate(after);

    const result = await UpdateEvolutionRequestStatus('req-uuid-1', 'In Development');
    expect(result.status).toBe('In Development');
  });

  it('In Development → Testing & UAT is valid (US-103)', async () => {
    const before = mockRequest({ status: 'In Development' });
    setupFindOne(before);
    const after = mockRequest({ status: 'Testing & UAT' });
    setupFindOneAndUpdate(after);

    const result = await UpdateEvolutionRequestStatus('req-uuid-1', 'Testing & UAT');
    expect(result.status).toBe('Testing & UAT');
  });

  it('Testing & UAT → Ready for Development regression is allowed (US-104)', async () => {
    const before = mockRequest({ status: 'Testing & UAT' });
    setupFindOne(before);
    const after = mockRequest({ status: 'Ready for Development' });
    setupFindOneAndUpdate(after);

    const result = await UpdateEvolutionRequestStatus('req-uuid-1', 'Ready for Development');
    expect(result.status).toBe('Ready for Development');
  });

  it('Testing & UAT → Release is a valid delivery transition (US-105)', async () => {
    setupFindOne(mockRequest({ status: 'Testing & UAT' }));
    setupFindOneAndUpdate(mockRequest({ status: 'Release' }));
    const result = await UpdateEvolutionRequestStatus('req-uuid-1', 'Release');
    expect(result.status).toBe('Release');
  });

  it('status skip Pending → In Development is rejected (US-106)', async () => {
    setupFindOne(mockRequest({ status: 'Pending' }));
    await expect(
      UpdateEvolutionRequestStatus('req-uuid-1', 'In Development')
    ).rejects.toMatchObject({
      extensions: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
  });

  it('Approved → In Development is rejected (must go via Ready for Development) (US-106)', async () => {
    setupFindOne(mockRequest({ status: 'Approved', jira_sync_state: 'SUCCEEDED' }));
    await expect(
      UpdateEvolutionRequestStatus('req-uuid-1', 'In Development')
    ).rejects.toMatchObject({
      extensions: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
  });

  it('JIRA comment failure does NOT roll back status update (US-107)', async () => {
    const before = mockRequest({ status: 'Ready for Development', jira_issue_key: 'SAT-1' });
    setupFindOne(before);
    const after = mockRequest({ status: 'In Development', jira_issue_key: 'SAT-1' });
    setupFindOneAndUpdate(after);
    AddJiraComment.mockResolvedValue({ ok: false });

    // Should not throw
    const result = await UpdateEvolutionRequestStatus('req-uuid-1', 'In Development');
    expect(result.status).toBe('In Development');
  });

  it('appends user_log on status change (US-108)', async () => {
    const before = mockRequest({ status: 'Ready for Development' });
    setupFindOne(before);
    const after = mockRequest({ status: 'In Development' });
    setupFindOneAndUpdate(after);

    await UpdateEvolutionRequestStatus('req-uuid-1', 'In Development');
    expect(AppendUserLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_EVOLUTION_REQUEST_STATUS' })
    );
  });

  it('governance targets (Pending/Reviewed/Approved/Rejected) are rejected (US-109)', async () => {
    for (const target of ['Pending', 'Reviewed', 'Approved', 'Rejected']) {
      setupFindOne(mockRequest({ status: 'In Development' }));
      await expect(
        UpdateEvolutionRequestStatus('req-uuid-1', target)
      ).rejects.toMatchObject({
        extensions: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      });
    }
  });

  it('throws NOT_FOUND for missing request', async () => {
    setupFindOne(null);
    await expect(
      UpdateEvolutionRequestStatus('non-existent', 'In Development')
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });
  });
});

// ─── RetryEvolutionRequestIntegrations (US-081) ──────────────────────────────

describe('RetryEvolutionRequestIntegrations (US-081)', () => {
  it('throws VALIDATION_ERROR when status is not Approved', async () => {
    setupFindOne(mockRequest({ status: 'Reviewed' }));
    await expect(RetryEvolutionRequestIntegrations('req-uuid-1')).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });

  it('marks SUCCEEDED when jira_issue_key already exists (dedup, no duplicate creation) (US-081)', async () => {
    const req = mockRequest({ status: 'Approved', jira_issue_key: 'SAT-99', jira_sync_state: 'FAILED' });
    setupFindOne(req);

    const afterJira = { ...req, jira_sync_state: 'SUCCEEDED' };
    const afterYt = { ...afterJira, youtrack_sync_state: 'SUCCEEDED' };

    EvolutionRequestModel.findOneAndUpdate = jest.fn()
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterJira) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterYt) });

    CreateYouTrackIssue.mockResolvedValue({ issue_id: 'YT-1', issue_url: 'https://yt/YT-1' });

    const result = await RetryEvolutionRequestIntegrations('req-uuid-1');

    expect(CreateJiraIssue).not.toHaveBeenCalled();
    expect(result.jira_sync_state).toBe('SUCCEEDED');
  });

  it('YouTrack failure keeps request valid and sets youtrack_sync_state=FAILED (US-081)', async () => {
    const req = mockRequest({ status: 'Approved', jira_sync_state: 'SUCCEEDED', jira_issue_key: 'SAT-99', youtrack_sync_state: 'FAILED' });
    setupFindOne(req);

    const afterYt = { ...req, youtrack_sync_state: 'FAILED' };
    EvolutionRequestModel.findOneAndUpdate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(afterYt),
    });
    CreateYouTrackIssue.mockResolvedValue({ ok: false, error: 'YouTrack down' });

    const result = await RetryEvolutionRequestIntegrations('req-uuid-1');
    expect(result.youtrack_sync_state).toBe('FAILED');
  });

  it('creates a missing JIRA issue and records retry audit log', async () => {
    const req = mockRequest({
      status: 'Approved',
      jira_sync_state: 'FAILED',
      jira_issue_key: null,
      youtrack_sync_state: 'SUCCEEDED',
    });
    setupFindOne(req);

    const afterJira = {
      ...req,
      jira_sync_state: 'SUCCEEDED',
      jira_issue_key: 'SAT-123',
      jira_issue_url: 'https://jira.example.com/browse/SAT-123',
    };

    EvolutionRequestModel.findOneAndUpdate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(afterJira),
    });
    CreateJiraIssue.mockResolvedValue({
      issue_key: 'SAT-123',
      issue_url: 'https://jira.example.com/browse/SAT-123',
    });

    const result = await RetryEvolutionRequestIntegrations('req-uuid-1', 'admin-1');

    expect(CreateJiraIssue).toHaveBeenCalledWith(req, expect.objectContaining({ projectKey: 'SAT' }));
    expect(AppendUserLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RETRY_EVOLUTION_REQUEST_INTEGRATIONS',
        actor_id: 'admin-1',
      })
    );
    expect(result.jira_issue_key).toBe('SAT-123');
    expect(result.jira_sync_state).toBe('SUCCEEDED');
  });
});

// ─── AssignEvolutionRequestPhase (US-110, US-111) ────────────────────────────

describe('AssignEvolutionRequestPhase (US-110)', () => {
  it('assigns phase_id to the request', async () => {
    const updated = mockRequest({ phase_id: 'phase-uuid-1' });
    setupFindOneAndUpdate(updated);

    const result = await AssignEvolutionRequestPhase('req-uuid-1', 'phase-uuid-1');
    expect(EvolutionRequestModel.findOneAndUpdate).toHaveBeenCalledWith(
      { request_id: 'req-uuid-1' },
      { $set: { phase_id: 'phase-uuid-1' } },
      { new: true }
    );
    expect(result.phase_id).toBe('phase-uuid-1');
  });

  it('throws NOT_FOUND when request does not exist', async () => {
    EvolutionRequestModel.findOneAndUpdate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    await expect(AssignEvolutionRequestPhase('non-existent', 'phase-1')).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
  });
});

describe('UnassignEvolutionRequestPhase (US-111)', () => {
  it('sets phase_id to null', async () => {
    const updated = mockRequest({ phase_id: null });
    setupFindOneAndUpdate(updated);

    const result = await UnassignEvolutionRequestPhase('req-uuid-1');
    expect(EvolutionRequestModel.findOneAndUpdate).toHaveBeenCalledWith(
      { request_id: 'req-uuid-1' },
      { $set: { phase_id: null } },
      { new: true }
    );
    expect(result.phase_id).toBeNull();
  });
});

describe('RefreshEvolutionRequestExternalStatus', () => {
  it('updates jira_status_mirror without changing canonical status', async () => {
    const before = mockRequest({
      status: 'Approved',
      jira_issue_key: 'SAT-55',
      jira_status_mirror: 'Prêt à développer',
    });
    const after = {
      ...before,
      jira_status_mirror: 'Test et recettes',
      jira_status_mirrored_at: '2026-03-19T10:00:00.000Z',
    };

    setupFindOne(before);
    setupFindOneAndUpdate(after);
    const { GetJiraIssueStatus } = require('../../../../shared/integrations/jira/jira.helper');
    GetJiraIssueStatus.mockResolvedValue({ ok: true, status_name: 'Test et recettes' });

    const result = await RefreshEvolutionRequestExternalStatus('req-uuid-1', 'admin-2');

    expect(GetJiraIssueStatus).toHaveBeenCalledWith('SAT-55', expect.objectContaining({ projectKey: 'SAT' }));
    expect(result.status).toBe('Approved');
    expect(result.jira_status_mirror).toBe('Test et recettes');
    expect(AppendUserLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REFRESH_EXTERNAL_STATUS',
        actor_id: 'admin-2',
      })
    );
  });

  it('throws VALIDATION_ERROR when no JIRA issue exists', async () => {
    setupFindOne(mockRequest({ jira_issue_key: null }));

    await expect(RefreshEvolutionRequestExternalStatus('req-uuid-1')).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });
});
