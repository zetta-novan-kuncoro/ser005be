'use strict';

// US-190, US-191, US-192

jest.mock('../../../../utils/http.util');

const { Post } = require('../../../../utils/http.util');
const { CreateYouTrackIssue } = require('../youtrack.helper');

const YT_CFG = {
  baseUrl: 'https://youtrack.example.com',
  apiToken: 'yt-secret',
  projectId: '0-1',
};

const SAMPLE_REQUEST = {
  request_id: 'req-uuid-1',
  title: 'Add dark mode',
  type: 'Evolution',
  priority: 2,
  submitted_by: 'alice@example.com',
  expected_date: null,
  jira_issue_url: 'https://jira.example.com/browse/SAT-1',
};

const JIRA_KEY = 'SAT-1';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CreateYouTrackIssue (US-190)', () => {
  it('sends POST to /api/issues with correct payload', async () => {
    Post.mockResolvedValue({
      ok: true,
      status: 200,
      data: { idReadable: 'YT-42', url: 'https://youtrack.example.com/issue/YT-42' },
    });

    const result = await CreateYouTrackIssue(SAMPLE_REQUEST, JIRA_KEY, YT_CFG);

    expect(Post).toHaveBeenCalledWith(
      'https://youtrack.example.com/api/issues?fields=id,idReadable,url',
      expect.objectContaining({ Authorization: 'Bearer yt-secret' }),
      expect.objectContaining({
        summary: '[SAT-1] Add dark mode',
        project: { id: '0-1' },
      })
    );
    expect(result).toEqual({
      issue_id: 'YT-42',
      issue_url: 'https://youtrack.example.com/issue/YT-42',
    });
  });

  it('includes JIRA link in description (US-192)', async () => {
    Post.mockResolvedValue({ ok: true, status: 200, data: { idReadable: 'YT-1', url: '' } });
    await CreateYouTrackIssue(SAMPLE_REQUEST, JIRA_KEY, YT_CFG);

    const payload = Post.mock.calls[0][2];
    expect(payload.description).toContain('JIRA: https://jira.example.com/browse/SAT-1');
  });

  it('description includes Request ID, Type, Priority, Submitted by (US-192)', async () => {
    Post.mockResolvedValue({ ok: true, status: 200, data: { idReadable: 'YT-1', url: '' } });
    await CreateYouTrackIssue(SAMPLE_REQUEST, JIRA_KEY, YT_CFG);

    const payload = Post.mock.calls[0][2];
    expect(payload.description).toContain('Request ID: req-uuid-1');
    expect(payload.description).toContain('Type: Evolution');
    expect(payload.description).toContain('Priority: 2');
    expect(payload.description).toContain('Submitted by: alice@example.com');
  });

  it('returns { ok: false, error } on HTTP error — never throws (US-190)', async () => {
    Post.mockResolvedValue({ ok: false, status: 400, data: { error: 'bad request' } });
    const result = await CreateYouTrackIssue(SAMPLE_REQUEST, JIRA_KEY, YT_CFG);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('400');
  });

  it('returns { ok: false, error } when Post throws — never throws (US-190)', async () => {
    Post.mockRejectedValue(new Error('network error'));
    const result = await CreateYouTrackIssue(SAMPLE_REQUEST, JIRA_KEY, YT_CFG);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('network error');
  });

  it('throws INTEGRATION_NOT_CONFIGURED when cfg is missing (US-191)', async () => {
    await expect(CreateYouTrackIssue(SAMPLE_REQUEST, JIRA_KEY, {})).rejects.toMatchObject({
      extensions: { code: 'INTEGRATION_NOT_CONFIGURED' },
    });
  });

  it('throws INTEGRATION_NOT_CONFIGURED when apiToken is missing (US-191)', async () => {
    const badCfg = { ...YT_CFG, apiToken: undefined };
    await expect(CreateYouTrackIssue(SAMPLE_REQUEST, JIRA_KEY, badCfg)).rejects.toMatchObject({
      extensions: { code: 'INTEGRATION_NOT_CONFIGURED' },
    });
  });

  it('adds Due Date custom field when expected_date is provided', async () => {
    Post.mockResolvedValue({ ok: true, status: 200, data: { idReadable: 'YT-2', url: '' } });
    const reqWithDate = { ...SAMPLE_REQUEST, expected_date: '2025-12-31T00:00:00.000Z' };

    await CreateYouTrackIssue(reqWithDate, JIRA_KEY, YT_CFG);

    const payload = Post.mock.calls[0][2];
    expect(payload.customFields).toContainEqual(
      expect.objectContaining({ name: 'Due Date' })
    );
  });

  it('customFields is empty when expected_date is null', async () => {
    Post.mockResolvedValue({ ok: true, status: 200, data: { idReadable: 'YT-3', url: '' } });
    await CreateYouTrackIssue(SAMPLE_REQUEST, JIRA_KEY, YT_CFG);

    const payload = Post.mock.calls[0][2];
    expect(payload.customFields).toHaveLength(0);
  });
});
