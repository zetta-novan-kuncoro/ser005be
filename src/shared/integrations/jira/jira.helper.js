// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { Post, Get } = require('../../../utils/http.util');
const { ApolloError } = require('apollo-server-errors');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Builds the Basic Authorization header value for JIRA Cloud.
 *
 * @param {string} userEmail
 * @param {string} apiToken
 * @returns {string}
 */
function BuildJiraAuthHeader(userEmail, apiToken) {
  const credentials = `${userEmail}:${apiToken}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

/**
 * Builds an Atlassian Document Format (ADF) paragraph node from a text string.
 *
 * @param {string} text
 * @returns {Object}
 */
function AdfParagraph(text) {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text: String(text) }],
  };
}

/**
 * Builds an ADF document wrapping an array of paragraph strings.
 *
 * @param {string[]} lines
 * @returns {Object}
 */
function BuildAdfDocument(lines) {
  return {
    version: 1,
    type: 'doc',
    content: lines.map((line) => AdfParagraph(line)),
  };
}

/**
 * Creates a JIRA issue for an evolution request.
 *
 * @param {Object} evolutionRequest - The evolution request data
 * @param {Object} cfg - The jira config slice (config.jira)
 * @returns {Promise<{ issue_key: string, issue_url: string }>}
 * @throws {Error} if creation fails
 */
async function CreateJiraIssue(evolutionRequest, cfg) {
  if (!cfg || !cfg.baseUrl || !cfg.userEmail || !cfg.apiToken || !cfg.projectKey) {
    throw new ApolloError(
      'JIRA integration is not configured. Set JIRA_BASE_URL, JIRA_USER_EMAIL, JIRA_API_TOKEN, and JIRA_PROJECT_KEY.',
      'INTEGRATION_NOT_CONFIGURED'
    );
  }

  const {
    application_reference,
    title,
    type,
    priority,
    submitted_by,
    expected_date,
    description,
    attachments,
  } = evolutionRequest;

  const summary = `[${application_reference}] ${title}`;

  const descriptionLines = [
    `Type: ${type || 'Evolution'}`,
    `Priority: ${priority || ''}`,
    `Submitted by: ${submitted_by || ''}`,
    `Expected date: ${expected_date || 'Not specified'}`,
    `Description: ${description || ''}`,
    `Application: ${application_reference}`,
  ];

  if (Array.isArray(attachments) && attachments.length > 0) {
    descriptionLines.push(`Attachments: ${attachments.join(', ')}`);
  }

  const payload = {
    fields: {
      project: { key: cfg.projectKey },
      issuetype: { name: 'Task' },
      summary,
      description: BuildAdfDocument(descriptionLines),
    },
  };

  const headers = {
    Authorization: BuildJiraAuthHeader(cfg.userEmail, cfg.apiToken),
    Accept: 'application/json',
  };

  const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/rest/api/3/issue`;
  const result = await Post(url, headers, payload);

  if (!result.ok) {
    const detail = result.data && result.data.errorMessages
      ? result.data.errorMessages.join('; ')
      : JSON.stringify(result.data);
    throw new Error(`JIRA issue creation failed (HTTP ${result.status}): ${detail}`);
  }

  const issueKey = result.data.key;
  const issueUrl = `${baseUrl}/browse/${issueKey}`;

  return { issue_key: issueKey, issue_url: issueUrl };
}

/**
 * Adds a comment to an existing JIRA issue. Best-effort — returns { ok } and does not throw.
 *
 * @param {string} issueKey - JIRA issue key (e.g. "SAT-123")
 * @param {string} commentText - Plain text comment body
 * @param {Object} cfg - The jira config slice (config.jira)
 * @returns {Promise<{ ok: boolean }>}
 */
async function AddJiraComment(issueKey, commentText, cfg) {
  try {
    const payload = {
      body: BuildAdfDocument(commentText.split('\n').filter((l) => l.length > 0)),
    };

    const headers = {
      Authorization: BuildJiraAuthHeader(cfg.userEmail, cfg.apiToken),
      Accept: 'application/json',
    };

    const url = `${cfg.baseUrl.replace(/\/+$/, '')}/rest/api/3/issue/${issueKey}/comment`;
    const result = await Post(url, headers, payload);

    return { ok: result.ok };
  } catch (_err) {
    return { ok: false };
  }
}

/**
 * Fetches the current status of a JIRA issue by key.
 *
 * @param {string} issueKey - JIRA issue key (e.g. "SAT-123")
 * @param {Object} cfg - The jira config slice (config.jira)
 * @returns {Promise<{ ok: boolean, status_name?: string, error?: string }>}
 */
async function GetJiraIssueStatus(issueKey, cfg) {
  if (!cfg || !cfg.baseUrl || !cfg.userEmail || !cfg.apiToken) {
    throw new ApolloError(
      'JIRA integration is not configured. Set JIRA_BASE_URL, JIRA_USER_EMAIL, and JIRA_API_TOKEN.',
      'INTEGRATION_NOT_CONFIGURED'
    );
  }

  const headers = {
    Authorization: BuildJiraAuthHeader(cfg.userEmail, cfg.apiToken),
    Accept: 'application/json',
  };

  const url = `${cfg.baseUrl.replace(/\/+$/, '')}/rest/api/3/issue/${issueKey}?fields=status`;
  const result = await Get(url, headers);

  if (!result.ok) {
    return { ok: false, error: `JIRA GET failed (HTTP ${result.status})` };
  }

  const statusName = result.data?.fields?.status?.name || null;
  return { ok: true, status_name: statusName };
}

/**
 * Transitions a JIRA issue to the target status. Best-effort — returns { ok } and does not throw.
 * Looks up available transitions dynamically by matching the target status name (case-insensitive)
 * against each transition's resulting status (`to.name`).
 *
 * @param {string} issueKey - JIRA issue key (e.g. "SAT-123")
 * @param {string} targetStatusName - JIRA status name to transition to (e.g. "PRET A DEVELOPER")
 * @param {Object} cfg - The jira config slice (config.jira)
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function TransitionJiraIssue(issueKey, targetStatusName, cfg) {
  try {
    const headers = {
      Authorization: BuildJiraAuthHeader(cfg.userEmail, cfg.apiToken),
      Accept: 'application/json',
    };
    const baseUrl = cfg.baseUrl.replace(/\/+$/, '');

    // 1. Fetch available transitions for the issue
    const listResult = await Get(`${baseUrl}/rest/api/3/issue/${issueKey}/transitions`, headers);
    if (!listResult.ok) {
      return { ok: false, error: `Could not fetch transitions (HTTP ${listResult.status})` };
    }

    const transitions = listResult.data?.transitions || [];
    const target = transitions.find(
      (t) => t.to?.name?.toUpperCase() === targetStatusName.toUpperCase()
    );

    if (!target) {
      return { ok: false, error: `No transition found leading to status '${targetStatusName}'` };
    }

    // 2. Execute the transition
    const transResult = await Post(
      `${baseUrl}/rest/api/3/issue/${issueKey}/transitions`,
      headers,
      { transition: { id: target.id } }
    );

    if (!transResult.ok) {
      return { ok: false, error: `Transition POST failed (HTTP ${transResult.status})` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// *************** EXPORT MODULE ***************
module.exports = { CreateJiraIssue, AddJiraComment, GetJiraIssueStatus, TransitionJiraIssue };
