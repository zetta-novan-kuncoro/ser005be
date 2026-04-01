'use strict';

// US-078, US-111 — SyncEvolutionRequestOnApproval orchestration

jest.mock('../jira/jira.helper');
jest.mock('../youtrack/youtrack.helper');
jest.mock('../../../features/evolution_request/evolution_requests/evolution_request.model');
jest.mock('../../../features/user_log/user_logs/user_log.helper');
jest.mock('../../../features/error_log/error_logs/error_log.helper');

const { CreateJiraIssue } = require('../jira/jira.helper');
const { CreateYouTrackIssue } = require('../youtrack/youtrack.helper');
const EvolutionRequestModel = require('../../../features/evolution_request/evolution_requests/evolution_request.model');
const { AppendUserLog } = require('../../../features/user_log/user_logs/user_log.helper');
const { AppendErrorLog } = require('../../../features/error_log/error_logs/error_log.helper');

const { SyncEvolutionRequestOnApproval } = require('../evolution_request_sync.helper');

const MOCK_CONFIG = {
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
};

function mockRequest(overrides = {}) {
  return {
    _id: 'mongo-id-123',
    request_id: 'req-uuid-1',
    application_reference: 'test-app',
    type: 'Evolution',
    title: 'Dark mode',
    submitted_by: 'alice',
    priority: 1,
    status: 'Approved',
    jira_sync_state: 'PENDING',
    youtrack_sync_state: 'PENDING',
    jira_issue_key: null,
    jira_issue_url: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  AppendUserLog.mockResolvedValue(undefined);
  AppendErrorLog.mockResolvedValue(undefined);
});

describe('SyncEvolutionRequestOnApproval (US-078)', () => {
  it('sets status=Approved and calls JIRA then YouTrack on success', async () => {
    const pending = mockRequest({ status: 'Reviewed', jira_sync_state: null });
    const afterApprove = mockRequest();
    const afterJira = mockRequest({ jira_sync_state: 'SUCCEEDED', jira_issue_key: 'SAT-1', jira_issue_url: 'https://jira.example.com/browse/SAT-1' });
    const afterYt = mockRequest({ ...afterJira, youtrack_sync_state: 'SUCCEEDED', youtrack_issue_id: 'YT-1' });

    EvolutionRequestModel.findByIdAndUpdate = jest.fn()
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterApprove) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterJira) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterYt) });

    CreateJiraIssue.mockResolvedValue({ issue_key: 'SAT-1', issue_url: 'https://jira.example.com/browse/SAT-1' });
    CreateYouTrackIssue.mockResolvedValue({ issue_id: 'YT-1', issue_url: 'https://youtrack.example.com/issue/YT-1' });

    const result = await SyncEvolutionRequestOnApproval('mongo-id-123', MOCK_CONFIG);

    expect(EvolutionRequestModel.findByIdAndUpdate).toHaveBeenNthCalledWith(
      1,
      'mongo-id-123',
      { $set: { status: 'Approved', jira_sync_state: 'PENDING', youtrack_sync_state: 'PENDING' } },
      { new: true }
    );
    expect(CreateJiraIssue).toHaveBeenCalledTimes(1);
    expect(CreateYouTrackIssue).toHaveBeenCalledTimes(1);
    expect(result.youtrack_sync_state).toBe('SUCCEEDED');
  });

  it('JIRA failure sets jira_sync_state=FAILED but still attempts YouTrack (US-078, US-194)', async () => {
    const afterApprove = mockRequest();
    const afterJiraFail = mockRequest({ jira_sync_state: 'FAILED' });
    const afterYt = mockRequest({ jira_sync_state: 'FAILED', youtrack_sync_state: 'SUCCEEDED' });

    EvolutionRequestModel.findByIdAndUpdate = jest.fn()
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterApprove) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterJiraFail) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterYt) });

    CreateJiraIssue.mockRejectedValue(new Error('JIRA is down'));
    CreateYouTrackIssue.mockResolvedValue({ issue_id: 'YT-1', issue_url: 'https://yt/YT-1' });

    const result = await SyncEvolutionRequestOnApproval('mongo-id-123', MOCK_CONFIG);

    expect(result.jira_sync_state).toBe('FAILED');
    expect(CreateYouTrackIssue).toHaveBeenCalledTimes(1);
  });

  it('YouTrack failure sets youtrack_sync_state=FAILED — request remains valid (US-078)', async () => {
    const afterApprove = mockRequest();
    const afterJira = mockRequest({ jira_sync_state: 'SUCCEEDED', jira_issue_key: 'SAT-1' });
    const afterYtFail = mockRequest({ jira_sync_state: 'SUCCEEDED', youtrack_sync_state: 'FAILED' });

    EvolutionRequestModel.findByIdAndUpdate = jest.fn()
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterApprove) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterJira) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterYtFail) });

    CreateJiraIssue.mockResolvedValue({ issue_key: 'SAT-1', issue_url: 'https://jira.example.com/browse/SAT-1' });
    CreateYouTrackIssue.mockResolvedValue({ ok: false, error: 'YT down' });

    const result = await SyncEvolutionRequestOnApproval('mongo-id-123', MOCK_CONFIG);

    expect(result.youtrack_sync_state).toBe('FAILED');
    expect(result.jira_sync_state).toBe('SUCCEEDED');
  });

  it('appends user_log with APPROVE_EVOLUTION_REQUEST action', async () => {
    const afterApprove = mockRequest();
    const afterJira = mockRequest({ jira_sync_state: 'SUCCEEDED', jira_issue_key: 'SAT-1' });
    const afterYt = mockRequest({ jira_sync_state: 'SUCCEEDED', youtrack_sync_state: 'SUCCEEDED' });

    EvolutionRequestModel.findByIdAndUpdate = jest.fn()
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterApprove) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterJira) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterYt) });

    CreateJiraIssue.mockResolvedValue({ issue_key: 'SAT-1', issue_url: '' });
    CreateYouTrackIssue.mockResolvedValue({ issue_id: 'YT-1', issue_url: '' });

    await SyncEvolutionRequestOnApproval('mongo-id-123', MOCK_CONFIG, 'admin-id-1');

    expect(AppendUserLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'APPROVE_EVOLUTION_REQUEST', actor_id: 'admin-id-1' })
    );
  });

  it('never throws even when both integrations fail', async () => {
    const afterApprove = mockRequest();
    const afterJiraFail = mockRequest({ jira_sync_state: 'FAILED' });
    const afterYtFail = mockRequest({ jira_sync_state: 'FAILED', youtrack_sync_state: 'FAILED' });

    EvolutionRequestModel.findByIdAndUpdate = jest.fn()
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterApprove) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterJiraFail) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterYtFail) });

    CreateJiraIssue.mockRejectedValue(new Error('JIRA down'));
    CreateYouTrackIssue.mockRejectedValue(new Error('YT down'));

    await expect(SyncEvolutionRequestOnApproval('mongo-id-123', MOCK_CONFIG)).resolves.toBeDefined();
  });

  it('calls AppendErrorLog when JIRA fails (US-193)', async () => {
    const afterApprove = mockRequest();
    const afterJiraFail = mockRequest({ jira_sync_state: 'FAILED' });
    const afterYt = mockRequest({ jira_sync_state: 'FAILED', youtrack_sync_state: 'SUCCEEDED' });

    EvolutionRequestModel.findByIdAndUpdate = jest.fn()
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterApprove) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterJiraFail) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(afterYt) });

    CreateJiraIssue.mockRejectedValue(new Error('JIRA error'));
    CreateYouTrackIssue.mockResolvedValue({ issue_id: 'YT-1', issue_url: '' });

    await SyncEvolutionRequestOnApproval('mongo-id-123', MOCK_CONFIG);

    expect(AppendErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'JIRA', entity_type: 'EvolutionRequest' })
    );
  });
});
