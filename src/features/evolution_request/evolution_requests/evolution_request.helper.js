// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const EvolutionRequestModel = require('./evolution_request.model');
const {
  ValidateSubmitEvolutionRequest,
  ValidateEvolutionRequestStatus,
  ValidateAdminEvolutionRequestUpdate,
} = require('./evolution_request.validator');
const { ThrowFormattedError } = require('../../../core/error');
const { NormalizePagination, BuildPaginatedResponse } = require('../../../shared/pagination.helper');
const { SerializeDates } = require('../../../utils/date.util');
const { SyncEvolutionRequestOnApproval } = require('../../../shared/integrations/evolution_request_sync.helper');
const { CreateJiraIssue, AddJiraComment, GetJiraIssueStatus, TransitionJiraIssue } = require('../../../shared/integrations/jira/jira.helper');
const { CreateYouTrackIssue } = require('../../../shared/integrations/youtrack/youtrack.helper');
const { AppendUserLog } = require('../../user_log/user_logs/user_log.helper');
const config = require('../../../core/config');

// *************** VARIABLES ***************
const ALLOWED_SORT_FIELDS = ['submitted_at', 'priority', 'status', 'created_at', 'updated_at', 'title'];
const ALLOWED_FILTER_STATUSES = [
  'Pending',
  'Reviewed',
  'Approved',
  'Ready for Development',
  'In Development',
  'Testing & UAT',
  'Release',
  'Rejected',
];
const EDITABLE_REQUEST_STATUSES = ['Pending', 'Reviewed'];
const PUBLIC_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const PUBLIC_RATE_LIMIT_MAX_REQUESTS = 5;
const PUBLIC_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Returns a trimmed string value.
 *
 * @param {unknown} value
 * @returns {string}
 */
function NormalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Builds a normalized duplicate-detection fingerprint.
 *
 * @param {Object} input
 * @returns {{ type: string, title: string, description: string, submitted_by: string }}
 */
function BuildDuplicateFingerprint(input) {
  return {
    type: NormalizeText(input.type).toLowerCase(),
    title: NormalizeText(input.title).toLowerCase(),
    description: NormalizeText(input.description).toLowerCase(),
    submitted_by: NormalizeText(input.submitted_by).toLowerCase(),
  };
}

/**
 * Enforces the public submit anti-abuse rules.
 *
 * @param {Object} input
 * @param {{ ip?: string|null }} requestMeta
 * @returns {Promise<void>}
 */
async function AssertPublicSubmitAllowed(input, requestMeta = {}) {
  if (NormalizeText(input.website)) {
    ThrowFormattedError('FORBIDDEN_ACTION', 'Submission blocked by anti-abuse validation.');
  }

  const clientIp = NormalizeText(requestMeta.ip) || 'unknown';
  const now = Date.now();
  const rateLimitWindowStart = new Date(now - PUBLIC_RATE_LIMIT_WINDOW_MS);
  const duplicateWindowStart = new Date(now - PUBLIC_DUPLICATE_WINDOW_MS);
  const fingerprint = BuildDuplicateFingerprint(input);

  const rateLimitedCount = await EvolutionRequestModel.countDocuments({
    application_reference: input.application_reference,
    submitted_from_ip: clientIp,
    submitted_at: { $gte: rateLimitWindowStart },
  });

  if (rateLimitedCount >= PUBLIC_RATE_LIMIT_MAX_REQUESTS) {
    ThrowFormattedError('RATE_LIMITED', 'Too many evolution requests were submitted from this source.');
  }

  const duplicate = await EvolutionRequestModel.findOne({
    application_reference: input.application_reference,
    submitted_at: { $gte: duplicateWindowStart },
    type: new RegExp(`^${fingerprint.type}$`, 'i'),
    title: new RegExp(`^${fingerprint.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    description: new RegExp(`^${fingerprint.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    submitted_by: new RegExp(`^${fingerprint.submitted_by.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  }).lean();

  if (duplicate) {
    ThrowFormattedError('DUPLICATE_REQUEST', 'A similar evolution request was already submitted recently.');
  }
}

/**
 * Projects an evolution request into the public-safe response shape.
 *
 * @param {Object} record
 * @returns {Object}
 */
function SerializePublicEvolutionRequest(record) {
  const serialized = SerializeDates(record);

  return {
    _id: serialized._id,
    request_id: serialized.request_id,
    application_reference: serialized.application_reference,
    type: serialized.type,
    title: serialized.title,
    description: serialized.description,
    submitted_by_display_name: serialized.submitted_by || null,
    priority: serialized.priority,
    expected_date: serialized.expected_date,
    status: serialized.status,
    phase_id: serialized.phase_id,
    submitted_at: serialized.submitted_at,
    created_at: serialized.created_at,
    updated_at: serialized.updated_at,
    jira_issue_key: serialized.jira_issue_key,
    jira_issue_url: serialized.jira_issue_url,
    released_in_entry_id: serialized.released_in_entry_id,
    released_at: serialized.released_at,
    rejection_reason: serialized.rejection_reason,
  };
}

/**
 * Normalizes admin update input into persisted field values.
 *
 * @param {Object} input
 * @returns {Object}
 */
function NormalizeAdminEvolutionRequestUpdate(input) {
  const normalized = {};

  if (Object.prototype.hasOwnProperty.call(input, 'title')) normalized.title = input.title;
  if (Object.prototype.hasOwnProperty.call(input, 'description')) normalized.description = input.description;
  if (Object.prototype.hasOwnProperty.call(input, 'priority')) normalized.priority = input.priority;
  if (Object.prototype.hasOwnProperty.call(input, 'type')) normalized.type = input.type;
  if (Object.prototype.hasOwnProperty.call(input, 'expected_date')) {
    normalized.expected_date = input.expected_date ? input.expected_date.toISOString() : null;
  }

  return normalized;
}

/**
 * Returns only the fields whose values actually changed.
 *
 * @param {Object} before
 * @param {Object} nextValues
 * @returns {Object}
 */
function GetChangedFields(before, nextValues) {
  return Object.entries(nextValues).reduce((acc, [key, value]) => {
    if (before[key] !== value) {
      acc[key] = value;
    }

    return acc;
  }, {});
}

// *************** FUNCTIONS ***************
/**
 * Returns paginated admin list of evolution requests with optional filters.
 *
 * @param {Object} [filter={}]
 * @param {Object} [pagination={}]
 * @param {Object} [sort={}]
 * @returns {Promise<Object>}
 */
async function GetAdminEvolutionRequests(filter = {}, pagination = {}, sort = {}) {
  const { page, limit, skip } = NormalizePagination(pagination);
  const query = {};

  if (filter.application_reference) query.application_reference = filter.application_reference;
  if (filter.type) query.type = filter.type;
  if (filter.status && ALLOWED_FILTER_STATUSES.includes(filter.status)) query.status = filter.status;
  if (filter.priority) query.priority = filter.priority;
  if (filter.phase_id) query.phase_id = filter.phase_id;
  if (filter.search) {
    query.$or = [
      { title: { $regex: filter.search, $options: 'i' } },
      { description: { $regex: filter.search, $options: 'i' } },
    ];
  }

  const sortField = ALLOWED_SORT_FIELDS.includes(sort.field) ? sort.field : 'submitted_at';
  const sortOrder = sort.order === 'asc' ? 1 : -1;

  const [data, total] = await Promise.all([
    EvolutionRequestModel.find(query).sort({ [sortField]: sortOrder }).skip(skip).limit(limit).lean(),
    EvolutionRequestModel.countDocuments(query),
  ]);

  return BuildPaginatedResponse(data, total, page, limit);
}

/**
 * Returns a single evolution request by request_id.
 *
 * @param {string} request_id
 * @returns {Promise<Object>}
 */
async function GetEvolutionRequest(request_id) {
  const req = await EvolutionRequestModel.findOne({ request_id }).lean();
  if (!req) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);
  return SerializeDates(req);
}

/**
 * Returns public evolution requests for a given application (API key scoped).
 *
 * @param {string} application_reference
 * @param {Object} [filter={}]
 * @param {Object} [pagination={}]
 * @returns {Promise<Object>}
 */
async function GetPublicEvolutionRequests(application_reference, filter = {}, pagination = {}, sort = {}) {
  const { page, limit, skip } = NormalizePagination(pagination);
  const query = { application_reference };

  if (filter.type) query.type = filter.type;
  if (filter.status) query.status = filter.status;
  if (filter.priority) query.priority = filter.priority;

  const sortField = ALLOWED_SORT_FIELDS.includes(sort.field) ? sort.field : 'submitted_at';
  const sortOrder = sort.order === 'asc' ? 1 : -1;

  const [data, total] = await Promise.all([
    EvolutionRequestModel.find(query).sort({ [sortField]: sortOrder }).skip(skip).limit(limit).lean(),
    EvolutionRequestModel.countDocuments(query),
  ]);

  return BuildPaginatedResponse(
    data.map((record) => SerializePublicEvolutionRequest(record)),
    total,
    page,
    limit
  );
}

/**
 * Creates a new evolution request via API key (public embed). Always sets status=Pending.
 * Flow: validate -> create local record -> append user_log -> return public-safe fields.
 * No external JIRA/YouTrack calls at submit time.
 *
 * @param {Object} input
 * @param {{ ip?: string|null, userAgent?: string|null }} [requestMeta={}]
 * @returns {Promise<Object>}
 */
async function SubmitEvolutionRequest(input, requestMeta = {}) {
  // Step 1: Validate
  const { error, value } = ValidateSubmitEvolutionRequest(input);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });
  await AssertPublicSubmitAllowed(value, requestMeta);

  // Step 2: Create local record with status=Pending
  const { v4: uuidv4 } = require('uuid');
  const docData = {
    ...value,
    request_id: uuidv4(),
    status: 'Pending',
    expected_date: value.expected_date ? value.expected_date.toISOString() : null,
    submitted_at: new Date(),
    submitted_from_ip: NormalizeText(requestMeta.ip) || 'unknown',
    submitted_user_agent: NormalizeText(requestMeta.userAgent) || null,
    integration_errors: [],
  };

  const created = await EvolutionRequestModel.create(docData);
  const record = SerializeDates(created.toObject());

  // Step 3: Append user_log
  try {
    await AppendUserLog({
      application_reference: record.application_reference,
      actor_type: 'PublicEmbedConsumer',
      actor_id: null,
      actor_label: record.submitted_by || null,
      action: 'SUBMIT_EVOLUTION_REQUEST',
      entity_type: 'EvolutionRequest',
      entity_id: record.request_id,
      before_state: null,
      after_state: { status: record.status },
      metadata: { request_id: record.request_id },
    });
  } catch (_logErr) {
    // user_log failure must not block the submit response
  }

  // Step 4: Return only public/embed-safe fields
  return SerializePublicEvolutionRequest(record);
}

/**
 * Updates editable evolution request fields while the request is still in governance.
 *
 * @param {string} request_id
 * @param {Object} input
 * @param {{ id?: string|null, label?: string|null }} [actor={}]
 * @returns {Promise<Object>}
 */
async function AdminUpdateEvolutionRequest(request_id, input, actor = {}) {
  const { error, value } = ValidateAdminEvolutionRequestUpdate(input);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });

  const before = await EvolutionRequestModel.findOne({ request_id }).lean();
  if (!before) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);

  if (!EDITABLE_REQUEST_STATUSES.includes(before.status)) {
    ThrowFormattedError('FORBIDDEN_ACTION', 'Evolution request cannot be edited in its current status.');
  }

  const normalizedValues = NormalizeAdminEvolutionRequestUpdate(value);
  const changedFields = GetChangedFields(before, normalizedValues);

  if (Object.keys(changedFields).length === 0) {
    return SerializeDates(before);
  }

  const updated = await EvolutionRequestModel.findOneAndUpdate(
    { request_id },
    { $set: changedFields },
    { new: true }
  ).lean();

  if (!updated) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);

  try {
    await AppendUserLog({
      application_reference: updated.application_reference,
      actor_type: 'Admin',
      actor_id: actor.id || null,
      actor_label: actor.label || 'Admin',
      action: 'ADMIN_UPDATE_EVOLUTION_REQUEST',
      entity_type: 'EvolutionRequest',
      entity_id: request_id,
      before_state: Object.keys(changedFields).reduce((acc, key) => {
        acc[key] = before[key];
        return acc;
      }, {}),
      after_state: changedFields,
      metadata: { status_at_edit: before.status },
    });
  } catch (_logErr) {
    // user_log failure must not block the response
  }

  return SerializeDates(updated);
}

// Maps service delivery-gate statuses to JIRA status names.
// Must stay in sync with JIRA_TO_SERVICE_STATUS in webhook.route.js.
const SERVICE_TO_JIRA_STATUS = {
  'Ready for Development': 'PRET A DEVELOPER',
  'In Development':        'EN COURS DE DEVELOPPEMENT',
  'Testing & UAT':         'TEST ET RECETTES',
  // 'Release' is not mapped — JIRA is already at LANCEMENT/TERMINE when this status is set; no transition needed
};

// Delivery gate transition matrix (governance transitions handled by dedicated mutations)
const DELIVERY_TRANSITIONS = {
  Approved: ['Ready for Development'],
  'Ready for Development': ['In Development'],
  'In Development': ['Testing & UAT'],
  'Testing & UAT': ['Ready for Development', 'Release'],
};

/**
 * Updates the status of an evolution request (admin only).
 * Enforces a strict delivery gate transition matrix.
 * Governance transitions (Pending→Reviewed, Reviewed→Approved/Rejected) are not allowed here.
 * After updating service state: appends user_log, then adds JIRA comment (best-effort).
 * JIRA comment failure does not roll back the status update.
 *
 * @param {string} request_id
 * @param {string} status
 * @param {string|null} [actor_id=null]
 * @param {Object} [options={}]
 * @param {boolean} [options.skipJiraGate=false] - When true, bypasses the JIRA sync gate (used by webhook auto-advance)
 * @returns {Promise<Object>}
 */
async function UpdateEvolutionRequestStatus(request_id, status, actor_id = null, { skipJiraGate = false } = {}) {
  const { error } = ValidateEvolutionRequestStatus({ status });
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message);

  // Fetch before state for audit and transition validation
  const before = await EvolutionRequestModel.findOne({ request_id }).lean();
  if (!before) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);

  // Validate transition via delivery gate matrix
  const allowed = DELIVERY_TRANSITIONS[before.status];
  if (!allowed || !allowed.includes(status)) {
    ThrowFormattedError('VALIDATION_ERROR', `Invalid transition from '${before.status}' to '${status}'.`, {
      code: 'INVALID_TRANSITION',
    });
  }

  // Special gate: Approved → Ready for Development requires jira_sync_state === 'SUCCEEDED'
  if (!skipJiraGate && before.status === 'Approved' && status === 'Ready for Development') {
    if (before.jira_sync_state !== 'SUCCEEDED') {
      ThrowFormattedError(
        'VALIDATION_ERROR',
        "Cannot move to 'Ready for Development' until JIRA sync has succeeded.",
        { code: 'JIRA_REQUIRED' }
      );
    }
  }

  // Step 1: Update service-owned state first
  const entry = await EvolutionRequestModel.findOneAndUpdate(
    { request_id },
    { $set: { status } },
    { new: true }
  ).lean();

  if (!entry) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);

  const serialized = SerializeDates(entry);
  const timestamp = new Date().toISOString();

  // Step 2: Append user_log
  try {
    await AppendUserLog({
      application_reference: entry.application_reference,
      actor_type: 'Admin',
      actor_id: actor_id || null,
      actor_label: 'Admin',
      action: 'UPDATE_EVOLUTION_REQUEST_STATUS',
      entity_type: 'EvolutionRequest',
      entity_id: request_id,
      before_state: { status: before.status },
      after_state: { status },
      metadata: { request_id },
    });
  } catch (_logErr) {
    // user_log failure must not block the response
  }

  // Step 3: JIRA transition + comment (both best-effort)
  if (entry.jira_issue_key && config.jira.baseUrl) {
    const jiraStatus = SERVICE_TO_JIRA_STATUS[status];

    // 3a. Transition the JIRA issue to the matching status (if a mapping exists)
    if (jiraStatus) {
      const transitionResult = await TransitionJiraIssue(entry.jira_issue_key, jiraStatus, config.jira);

      if (!transitionResult.ok) {
        const errorEntry = {
          target: 'jira_transition',
          message: `Failed to transition JIRA issue to '${jiraStatus}': ${transitionResult.error || 'unknown'}`,
          failed_at: timestamp,
        };

        try {
          await EvolutionRequestModel.findOneAndUpdate(
            { request_id },
            { $push: { integration_errors: errorEntry } }
          );
        } catch (_) { /* ignore secondary DB error */ }

        try {
          await AppendUserLog({
            application_reference: entry.application_reference,
            actor_type: 'System',
            actor_id: null,
            actor_label: 'System',
            action: 'JIRA_TRANSITION_FAILED',
            entity_type: 'EvolutionRequest',
            entity_id: request_id,
            before_state: null,
            after_state: null,
            metadata: errorEntry,
          });
        } catch (_) { /* ignore */ }
      }
    }

    // 3b. Comment (existing behaviour, kept as audit trail regardless of transition result)
    const commentText = [
      '[Service Update] Evolution request status changed.',
      `Request ID: ${request_id}`,
      `Old status: ${before.status}`,
      `New status: ${status}`,
      `Timestamp: ${timestamp}`,
    ].join('\n');

    const commentResult = await AddJiraComment(entry.jira_issue_key, commentText, config.jira);

    if (!commentResult.ok) {
      const errorEntry = {
        target: 'jira_comment',
        message: `Failed to add JIRA comment on status update to '${status}'`,
        failed_at: timestamp,
      };

      try {
        await EvolutionRequestModel.findOneAndUpdate(
          { request_id },
          { $push: { integration_errors: errorEntry } }
        );
      } catch (_) { /* ignore secondary DB error */ }

      try {
        await AppendUserLog({
          application_reference: entry.application_reference,
          actor_type: 'System',
          actor_id: null,
          actor_label: 'System',
          action: 'JIRA_COMMENT_FAILED',
          entity_type: 'EvolutionRequest',
          entity_id: request_id,
          before_state: null,
          after_state: null,
          metadata: errorEntry,
        });
      } catch (_) { /* ignore */ }
    }
  }

  return serialized;
}

/**
 * Assigns a roadmap phase to an evolution request.
 *
 * @param {string} request_id
 * @param {string} phase_id
 * @returns {Promise<Object>}
 */
async function AssignEvolutionRequestPhase(request_id, phase_id) {
  const entry = await EvolutionRequestModel.findOneAndUpdate(
    { request_id },
    { $set: { phase_id } },
    { new: true }
  ).lean();

  if (!entry) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);
  return SerializeDates(entry);
}

/**
 * Removes the phase assignment from an evolution request.
 *
 * @param {string} request_id
 * @returns {Promise<Object>}
 */
async function UnassignEvolutionRequestPhase(request_id) {
  const entry = await EvolutionRequestModel.findOneAndUpdate(
    { request_id },
    { $set: { phase_id: null } },
    { new: true }
  ).lean();

  if (!entry) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);
  return SerializeDates(entry);
}

/**
 * Moves an evolution request from Pending to Reviewed.
 *
 * @param {string} request_id
 * @param {string|null} [actor_id=null]
 * @returns {Promise<Object>}
 */
async function ReviewEvolutionRequest(request_id, actor_id = null) {
  const before = await EvolutionRequestModel.findOne({ request_id }).lean();
  if (!before) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);

  if (before.status !== 'Pending') {
    ThrowFormattedError('VALIDATION_ERROR', `Invalid transition from '${before.status}' to 'Reviewed'.`, {
      code: 'INVALID_TRANSITION',
    });
  }

  const entry = await EvolutionRequestModel.findOneAndUpdate(
    { request_id },
    { $set: { status: 'Reviewed' } },
    { new: true }
  ).lean();

  if (!entry) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);

  try {
    await AppendUserLog({
      application_reference: entry.application_reference,
      actor_type: 'Admin',
      actor_id: actor_id || null,
      actor_label: 'Admin',
      action: 'REVIEW_EVOLUTION_REQUEST',
      entity_type: 'EvolutionRequest',
      entity_id: request_id,
      before_state: { status: 'Pending' },
      after_state: { status: 'Reviewed' },
      metadata: { request_id },
    });
  } catch (_logErr) {
    // user_log failure must not block the response
  }

  return SerializeDates(entry);
}

/**
 * Moves an evolution request from Reviewed to Approved and fires JIRA/YouTrack sync.
 *
 * @param {string} request_id
 * @param {string|null} [actor_id=null]
 * @returns {Promise<Object>}
 */
async function ApproveEvolutionRequest(request_id, actor_id = null) {
  const before = await EvolutionRequestModel.findOne({ request_id }).lean();
  if (!before) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);

  if (before.status === 'Approved') {
    return SerializeDates(before);
  }

  if (before.status !== 'Reviewed') {
    ThrowFormattedError('VALIDATION_ERROR', `Invalid transition from '${before.status}' to 'Approved'.`, {
      code: 'INVALID_TRANSITION',
    });
  }

  return SyncEvolutionRequestOnApproval(before._id, config, actor_id);
}

/**
 * Moves an evolution request from Reviewed to Rejected.
 *
 * @param {string} request_id
 * @param {string|null} [rejection_reason=null]
 * @param {string|null} [actor_id=null]
 * @returns {Promise<Object>}
 */
async function RejectEvolutionRequest(request_id, rejection_reason = null, actor_id = null) {
  const before = await EvolutionRequestModel.findOne({ request_id }).lean();
  if (!before) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);

  if (before.status !== 'Reviewed') {
    ThrowFormattedError('VALIDATION_ERROR', `Invalid transition from '${before.status}' to 'Rejected'.`, {
      code: 'INVALID_TRANSITION',
    });
  }

  const entry = await EvolutionRequestModel.findOneAndUpdate(
    { request_id },
    { $set: { status: 'Rejected', rejection_reason: rejection_reason || null } },
    { new: true }
  ).lean();

  if (!entry) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);

  try {
    await AppendUserLog({
      application_reference: entry.application_reference,
      actor_type: 'Admin',
      actor_id: actor_id || null,
      actor_label: 'Admin',
      action: 'REJECT_EVOLUTION_REQUEST',
      entity_type: 'EvolutionRequest',
      entity_id: request_id,
      before_state: { status: 'Reviewed' },
      after_state: { status: 'Rejected' },
      metadata: { request_id },
    });
  } catch (_logErr) {
    // user_log failure must not block the response
  }

  return SerializeDates(entry);
}

/**
 * Retries JIRA and/or YouTrack integration for an already-Approved evolution request.
 * Skips JIRA if jira_sync_state is already SUCCEEDED. Deduplicates by checking jira_issue_key.
 * Skips YouTrack if youtrack_sync_state is already SUCCEEDED.
 *
 * @param {string} request_id
 * @param {string|null} [actor_id=null]
 * @returns {Promise<Object>}
 */
async function RetryEvolutionRequestIntegrations(request_id, actor_id = null) {
  const record = await EvolutionRequestModel.findOne({ request_id }).lean();
  if (!record) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);

  if (record.status !== 'Approved') {
    ThrowFormattedError(
      'VALIDATION_ERROR',
      `Retry is only allowed for 'Approved' requests. Current status: '${record.status}'.`,
      { code: 'INVALID_TRANSITION' }
    );
  }

  const now = new Date().toISOString();
  let updated = record;

  // Retry JIRA if not yet succeeded
  if (record.jira_sync_state !== 'SUCCEEDED') {
    if (record.jira_issue_key) {
      // Dedup: key already exists, mark as SUCCEEDED without re-creating
      updated = await EvolutionRequestModel.findOneAndUpdate(
        { request_id },
        { $set: { jira_sync_state: 'SUCCEEDED', jira_last_attempt_at: now } },
        { new: true }
      ).lean();
    } else {
      let jiraUpdate = {};
      try {
        const jiraResult = await CreateJiraIssue(record, config.jira);
        jiraUpdate = {
          jira_sync_state: 'SUCCEEDED',
          jira_issue_key: jiraResult.issue_key,
          jira_issue_url: jiraResult.issue_url,
          jira_last_attempt_at: now,
        };
      } catch (err) {
        jiraUpdate = {
          jira_sync_state: 'FAILED',
          jira_last_error_code: err.code || 'JIRA_ERROR',
          jira_last_error_message: err.message || 'Unknown JIRA error',
          jira_last_attempt_at: now,
        };
      }
      updated = await EvolutionRequestModel.findOneAndUpdate(
        { request_id },
        { $set: jiraUpdate },
        { new: true }
      ).lean();
    }
  }

  // Retry YouTrack if not yet succeeded
  if (record.youtrack_sync_state !== 'SUCCEEDED') {
    let ytUpdate = {};
    try {
      const ytResult = await CreateYouTrackIssue(
        {
          ...updated,
          jira_issue_url: updated.jira_issue_url,
        },
        updated.jira_issue_key,
        config.youtrack
      );

      if (ytResult.issue_id) {
        ytUpdate = {
          youtrack_sync_state: 'SUCCEEDED',
          youtrack_issue_id: ytResult.issue_id,
          youtrack_issue_url: ytResult.issue_url,
          youtrack_last_attempt_at: now,
        };
      } else {
        ytUpdate = {
          youtrack_sync_state: 'FAILED',
          youtrack_last_error_code: 'YOUTRACK_ERROR',
          youtrack_last_error_message: ytResult.error || 'Unknown YouTrack error',
          youtrack_last_attempt_at: now,
        };
      }
    } catch (err) {
      ytUpdate = {
        youtrack_sync_state: 'FAILED',
        youtrack_last_error_code: err.code || 'YOUTRACK_ERROR',
        youtrack_last_error_message: err.message || 'Unknown YouTrack error',
        youtrack_last_attempt_at: now,
      };
    }
    updated = await EvolutionRequestModel.findOneAndUpdate(
      { request_id },
      { $set: ytUpdate },
      { new: true }
    ).lean();
  }

  // Append user_log
  try {
    await AppendUserLog({
      application_reference: updated.application_reference,
      actor_type: 'Admin',
      actor_id: actor_id || null,
      actor_label: 'Admin',
      action: 'RETRY_EVOLUTION_REQUEST_INTEGRATIONS',
      entity_type: 'EvolutionRequest',
      entity_id: request_id,
      before_state: {
        jira_sync_state: record.jira_sync_state,
        youtrack_sync_state: record.youtrack_sync_state,
      },
      after_state: {
        jira_sync_state: updated.jira_sync_state,
        youtrack_sync_state: updated.youtrack_sync_state,
      },
      metadata: { request_id },
    });
  } catch (_logErr) {
    // user_log failure must not block the response
  }

  return SerializeDates(updated);
}

/**
 * Admin-triggered on-demand refresh of the JIRA status mirror for an evolution request.
 * Performs a GET to JIRA for the current issue status and updates jira_status_mirror.
 * Does not modify canonical status.
 *
 * @param {string} request_id
 * @param {string|null} [actor_id=null]
 * @returns {Promise<Object>}
 */
async function RefreshEvolutionRequestExternalStatus(request_id, actor_id = null) {
  const record = await EvolutionRequestModel.findOne({ request_id }).lean();
  if (!record) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);

  if (!record.jira_issue_key) {
    ThrowFormattedError('VALIDATION_ERROR', `Evolution request '${request_id}' has no JIRA issue key.`, {
      code: 'NO_JIRA_ISSUE',
    });
  }

  const jiraResult = await GetJiraIssueStatus(record.jira_issue_key, config.jira);

  if (!jiraResult.ok) {
    ThrowFormattedError('INTEGRATION_ERROR', `Failed to fetch JIRA status: ${jiraResult.error}`, {
      code: 'JIRA_FETCH_FAILED',
    });
  }

  const now = new Date().toISOString();
  const entry = await EvolutionRequestModel.findOneAndUpdate(
    { request_id },
    {
      $set: {
        jira_status_mirror: jiraResult.status_name,
        jira_status_mirrored_at: now,
      },
    },
    { new: true }
  ).lean();

  if (!entry) ThrowFormattedError('NOT_FOUND', `Evolution request '${request_id}' not found.`);

  try {
    await AppendUserLog({
      application_reference: entry.application_reference,
      actor_type: 'Admin',
      actor_id: actor_id || null,
      actor_label: 'Admin',
      action: 'REFRESH_EXTERNAL_STATUS',
      entity_type: 'EvolutionRequest',
      entity_id: request_id,
      before_state: { jira_status_mirror: record.jira_status_mirror },
      after_state: { jira_status_mirror: jiraResult.status_name },
      metadata: { request_id, jira_issue_key: record.jira_issue_key },
    });
  } catch (_logErr) {
    // user_log failure must not block the response
  }

  return SerializeDates(entry);
}

// *************** EXPORT MODULE ***************
module.exports = {
  GetAdminEvolutionRequests,
  GetEvolutionRequest,
  GetPublicEvolutionRequests,
  SubmitEvolutionRequest,
  AdminUpdateEvolutionRequest,
  UpdateEvolutionRequestStatus,
  ReviewEvolutionRequest,
  ApproveEvolutionRequest,
  RejectEvolutionRequest,
  RetryEvolutionRequestIntegrations,
  AssignEvolutionRequestPhase,
  UnassignEvolutionRequestPhase,
  RefreshEvolutionRequestExternalStatus,
};
