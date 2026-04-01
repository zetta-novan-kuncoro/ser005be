// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { v4: uuidv4 } = require('uuid');

// *************** IMPORT MODULE ***************
const ChangelogModel = require('./changelog.model');
const { ValidateCreateChangelog, ValidateUpdateChangelog } = require('./changelog.validator');
const { ThrowFormattedError } = require('../../../core/error');
const { NormalizePagination, BuildPaginatedResponse } = require('../../../shared/pagination.helper');
const { GenerateSha256 } = require('../../../utils/hash.util');
const { UploadBuffer } = require('../../../shared/s3.service');
const { SerializeDates } = require('../../../utils/date.util');
const EvolutionRequestModel = require('../../evolution_request/evolution_requests/evolution_request.model');
const { AddJiraComment } = require('../../../shared/integrations/jira/jira.helper');
const { AppendUserLog } = require('../../user_log/user_logs/user_log.helper');
const config = require('../../../core/config');

// *************** VARIABLES ***************
const ALLOWED_SORT_FIELDS = ['release_date', 'created_at', 'updated_at', 'title', 'version'];

// *************** FUNCTIONS ***************
/**
 * Links released evolution requests to a Published changelog entry.
 * For each request_id:
 *  - Verifies it exists and belongs to the same application_reference
 *  - Verifies it has a jira_issue_key
 *  - Sets released_in_entry_id = entry_id (changelog's entry_id string, NOT _id)
 *  - Sets released_at = now ISO string
 *  - Adds a JIRA comment (best-effort)
 *  - Adds the JIRA issue to changelog tickets[] if not already present
 *  - Appends user_logs for each linkage
 *
 * @param {string} entry_id - Changelog entry_id string
 * @param {string} application_reference
 * @param {string[]} released_request_ids
 * @returns {Promise<{ jiraTicketsToAdd: Array<Object> }>}
 */
async function LinkReleasedRequests(entry_id, application_reference, released_request_ids) {
  const jiraTicketsToAdd = [];
  const releasedAt = new Date().toISOString();

  for (const request_id of released_request_ids) {
    const req = await EvolutionRequestModel.findOne({ request_id }).lean();

    if (!req) {
      // silently skip missing requests
      continue;
    }

    if (req.application_reference !== application_reference) {
      // cross-application linkage forbidden
      continue;
    }

    if (!req.jira_issue_key) {
      // must already have JIRA reference
      continue;
    }

    // Update the evolution request with release linkage
    await EvolutionRequestModel.findOneAndUpdate(
      { request_id },
      {
        $set: {
          released_in_entry_id: entry_id,
          released_at: releasedAt,
          status: 'Release',
        },
      }
    );

    // Collect JIRA ticket for changelog dedup
    jiraTicketsToAdd.push({
      ticket_id: req.jira_issue_key,
      ticket_ref: req.jira_issue_key,
      ticket_name: req.title || '',
      ticket_url: req.jira_issue_url || '',
    });

    // JIRA comment (best-effort)
    if (config.jira.baseUrl) {
      const commentText = [
        '[Service Update] Evolution request released in changelog.',
        `This evolution request has been released in changelog entry ${entry_id} on ${releasedAt}`,
        `Request ID: ${request_id}`,
        `Changelog Entry: ${entry_id}`,
      ].join('\n');

      const commentResult = await AddJiraComment(req.jira_issue_key, commentText, config.jira);

      if (!commentResult.ok) {
        const errorEntry = {
          target: 'jira_comment',
          message: `Failed to add JIRA comment on release linkage to changelog entry '${entry_id}'`,
          failed_at: releasedAt,
        };

        try {
          await EvolutionRequestModel.findOneAndUpdate(
            { request_id },
            { $push: { integration_errors: errorEntry } }
          );
        } catch (_) {
          // ignore
        }
      }
    }

    // Append user_log for release linkage
    try {
      await AppendUserLog({
        application_reference,
        actor_type: 'System',
        actor_id: null,
        actor_label: 'System',
        action: 'LINK_EVOLUTION_REQUEST_TO_CHANGELOG',
        entity_type: 'EvolutionRequest',
        entity_id: request_id,
        before_state: { released_in_entry_id: req.released_in_entry_id || null },
        after_state: { released_in_entry_id: entry_id, released_at: releasedAt },
        metadata: { changelog_entry_id: entry_id },
      });
    } catch (_) {
      // ignore
    }
  }

  return { jiraTicketsToAdd };
}

// *************** FUNCTIONS ***************
/**
 * Returns true when the provided value is a non-empty string.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function HasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Normalizes a single changelog ticket to the structured object shape.
 *
 * @param {string|Object|null|undefined} ticket
 * @returns {{ ticket_id: string, ticket_ref: string, ticket_name: string, ticket_url: string }|null}
 */
function NormalizeChangelogTicket(ticket) {
  if (typeof ticket === 'string') {
    const normalizedValue = ticket.trim();

    if (!normalizedValue) {
      return null;
    }

    return {
      ticket_id: normalizedValue,
      ticket_ref: normalizedValue,
      ticket_name: '',
      ticket_url: '',
    };
  }

  if (!ticket || typeof ticket !== 'object') {
    return null;
  }

  const normalizedTicket = {
    ticket_id: HasText(ticket.ticket_id) ? ticket.ticket_id.trim() : '',
    ticket_ref: HasText(ticket.ticket_ref) ? ticket.ticket_ref.trim() : '',
    ticket_name: HasText(ticket.ticket_name) ? ticket.ticket_name.trim() : '',
    ticket_url: HasText(ticket.ticket_url) ? ticket.ticket_url.trim() : '',
  };

  if (!Object.values(normalizedTicket).some(HasText)) {
    return null;
  }

  return normalizedTicket;
}

/**
 * Normalizes a changelog ticket array while preserving legacy string entries.
 *
 * @param {Array<string|Object>} tickets
 * @returns {Array<Object>}
 */
function NormalizeChangelogTickets(tickets = []) {
  if (!Array.isArray(tickets)) {
    return [];
  }

  return tickets
    .map((ticket) => NormalizeChangelogTicket(ticket))
    .filter(Boolean);
}

/**
 * Applies response normalization for changelog documents.
 *
 * @param {Object|null} entry
 * @returns {Object|null}
 */
function SerializeChangelogEntry(entry) {
  if (!entry) {
    return entry;
  }

  return SerializeDates({
    ...entry,
    entry_group_id: entry.entry_group_id || entry.entry_id,
    revision_number: Number.isInteger(entry.revision_number) && entry.revision_number > 0 ? entry.revision_number : 1,
    previous_entry_id: entry.previous_entry_id || null,
    published_at: entry.published_at || (entry.status === 'Published' ? entry.created_at || null : null),
    tickets: NormalizeChangelogTickets(entry.tickets),
  });
}

/**
 * Returns the canonical entry group identifier for a changelog record.
 *
 * @param {Object} entry
 * @returns {string}
 */
function GetEntryGroupId(entry) {
  return entry.entry_group_id || entry.entry_id;
}

/**
 * Returns the canonical revision number for a changelog record.
 *
 * @param {Object} entry
 * @returns {number}
 */
function GetRevisionNumber(entry) {
  return Number.isInteger(entry.revision_number) && entry.revision_number > 0 ? entry.revision_number : 1;
}

/**
 * Returns the canonical published timestamp for a changelog record.
 *
 * @param {Object} entry
 * @returns {string|null}
 */
function GetPublishedAt(entry) {
  return entry.published_at || (entry.status === 'Published' ? entry.created_at || null : null);
}

/**
 * Returns paginated admin changelog list with optional filters.
 *
 * @param {Object} [filter={}]
 * @param {Object} [pagination={}]
 * @param {Object} [sort={}]
 * @returns {Promise<Object>}
 */
async function GetAdminChangelogs(filter = {}, pagination = {}, sort = {}) {
  const { page, limit, skip } = NormalizePagination(pagination);
  const query = {};

  if (filter.application_reference) query.application_reference = filter.application_reference;
  if (filter.status) query.status = filter.status;
  if (filter.visibility) query.visibility = filter.visibility;
  if (filter.change_type) query.change_type = filter.change_type;
  if (filter.impact_scope) query.impact_scope = filter.impact_scope;
  if (filter.search) {
    query.$or = [
      { title: { $regex: filter.search, $options: 'i' } },
      { summary: { $regex: filter.search, $options: 'i' } },
      { version: { $regex: filter.search, $options: 'i' } },
    ];
  }

  const sortField = ALLOWED_SORT_FIELDS.includes(sort.field) ? sort.field : 'created_at';
  const sortOrder = sort.order === 'asc' ? 1 : -1;

  const [data, total] = await Promise.all([
    ChangelogModel.find(query).sort({ [sortField]: sortOrder }).skip(skip).limit(limit).lean(),
    ChangelogModel.countDocuments(query),
  ]);

  return BuildPaginatedResponse(data.map((entry) => SerializeChangelogEntry(entry)), total, page, limit);
}

/**
 * Returns a single changelog entry by entry_id.
 *
 * @param {string} entry_id
 * @returns {Promise<Object>}
 */
async function GetChangelog(entry_id) {
  const entry = await ChangelogModel.findOne({ entry_id }).lean();
  if (!entry) ThrowFormattedError('NOT_FOUND', `Changelog '${entry_id}' not found.`);
  return SerializeChangelogEntry(entry);
}

/**
 * Returns paginated public changelog entries (Published + PublicToCustomers only).
 *
 * @param {string} application_reference
 * @param {Object} [pagination={}]
 * @returns {Promise<Object>}
 */
async function GetPublicChangelogs(application_reference, pagination = {}) {
  const { page, limit, skip } = NormalizePagination(pagination);
  const query = { application_reference, status: 'Published', visibility: 'PublicToCustomers' };
  const publishedEntries = await ChangelogModel.find(query).sort({ release_date: -1 }).lean();
  const latestByGroup = new Map();

  for (const rawEntry of publishedEntries) {
    const entry = SerializeChangelogEntry(rawEntry);
    const groupId = GetEntryGroupId(entry);
    const current = latestByGroup.get(groupId);

    if (!current) {
      latestByGroup.set(groupId, entry);
      continue;
    }

    const currentPublishedAt = GetPublishedAt(current) || '';
    const candidatePublishedAt = GetPublishedAt(entry) || '';
    const currentRevision = GetRevisionNumber(current);
    const candidateRevision = GetRevisionNumber(entry);

    if (
      candidatePublishedAt > currentPublishedAt
      || (candidatePublishedAt === currentPublishedAt && candidateRevision > currentRevision)
    ) {
      latestByGroup.set(groupId, entry);
    }
  }

  const latestEntries = Array.from(latestByGroup.values()).sort((left, right) => {
    if ((right.release_date || '') !== (left.release_date || '')) {
      return (right.release_date || '').localeCompare(left.release_date || '');
    }

    return (GetPublishedAt(right) || '').localeCompare(GetPublishedAt(left) || '');
  });

  const pagedEntries = latestEntries.slice(skip, skip + limit);
  return BuildPaginatedResponse(pagedEntries, latestEntries.length, page, limit);
}

/**
 * Finalizes publish-time immutable fields and release linkage for a changelog entry.
 *
 * @param {Object} existing
 * @param {string|null} updated_by
 * @param {string[]} [released_request_ids=[]]
 * @returns {Promise<Object>}
 */
async function FinalizePublishedChangelog(existing, updated_by = null, released_request_ids = []) {
  if (!existing) {
    ThrowFormattedError('NOT_FOUND', 'Changelog not found.');
  }

  const serializedExisting = SerializeChangelogEntry(existing);
  const sha256 = GenerateSha256(serializedExisting);
  const s3Key = `changelogs/snapshots/${existing.entry_id}.json`;
  const buffer = Buffer.from(JSON.stringify(serializedExisting, null, 2), 'utf8');
  const publishedAt = new Date().toISOString();

  await UploadBuffer(s3Key, buffer, 'application/json');

  let published = await ChangelogModel.findOneAndUpdate(
    { entry_id: existing.entry_id },
    {
      $set: {
        status: 'Published',
        immutable_sha256: sha256,
        immutable_s3_key: s3Key,
        published_at: publishedAt,
        updated_by,
      },
    },
    { new: true }
  ).lean();

  if (Array.isArray(released_request_ids) && released_request_ids.length > 0) {
    const { jiraTicketsToAdd } = await LinkReleasedRequests(
      existing.entry_id,
      existing.application_reference,
      released_request_ids
    );

    if (jiraTicketsToAdd.length > 0) {
      const existingTickets = Array.isArray(published.tickets) ? published.tickets : [];
      const existingRefs = new Set(existingTickets.map((t) => t.ticket_ref).filter(Boolean));
      const newTickets = jiraTicketsToAdd.filter((t) => !existingRefs.has(t.ticket_ref));

      if (newTickets.length > 0) {
        published = await ChangelogModel.findOneAndUpdate(
          { entry_id: existing.entry_id },
          { $push: { tickets: { $each: newTickets } } },
          { new: true }
        ).lean();
      }
    }
  }

  return SerializeChangelogEntry(published);
}

/**
 * Creates a new changelog entry with a generated UUID entry_id.
 * If status is Published and released_request_ids is provided, links those
 * evolution requests to this changelog entry and backfills tickets[].
 *
 * @param {Object} input
 * @param {string|null} [created_by=null]
 * @returns {Promise<Object>}
 */
async function CreateChangelog(input, created_by = null) {
  const { released_request_ids, ...restInput } = input;

  const normalizedInput = {
    ...restInput,
    tickets: NormalizeChangelogTickets(restInput.tickets),
  };

  const { error, value } = ValidateCreateChangelog(normalizedInput);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });

  const entryId = uuidv4();
  const initialStatus = value.status || 'Draft';

  const entry = await ChangelogModel.create({
    ...value,
    release_date: value.release_date.toISOString(),
    entry_id: entryId,
    entry_group_id: entryId,
    revision_number: 1,
    previous_entry_id: null,
    status: initialStatus === 'Published' ? 'Draft' : initialStatus,
    created_by,
    updated_by: created_by,
  });

  let result = entry.toObject();

  if (initialStatus === 'Published') {
    return FinalizePublishedChangelog(result, created_by, released_request_ids);
  }

  return SerializeChangelogEntry(result);
}

/**
 * Updates an existing changelog entry. Publishing is done via PublishChangelog.
 *
 * @param {string} entry_id
 * @param {Object} input
 * @param {string|null} [updated_by=null]
 * @returns {Promise<Object>}
 */
async function UpdateChangelog(entry_id, input, updated_by = null) {
  const normalizedInput = {
    ...input,
    ...(Object.prototype.hasOwnProperty.call(input, 'tickets')
      ? { tickets: NormalizeChangelogTickets(input.tickets) }
      : {}),
  };

  const { error, value } = ValidateUpdateChangelog(normalizedInput);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });
  if (value.status === 'Published') {
    ThrowFormattedError('VALIDATION_ERROR', 'Use PublishChangelog to publish a draft entry.');
  }

  const existing = await ChangelogModel.findOne({ entry_id }).lean();
  if (!existing) ThrowFormattedError('NOT_FOUND', `Changelog '${entry_id}' not found.`);
  if (existing.status === 'Published') {
    ThrowFormattedError('CONFLICT', 'Published changelogs cannot be edited directly. Create a revision instead.');
  }

  const updateValue = {
    ...value,
    updated_by,
  };

  if (value.release_date) {
    updateValue.release_date = value.release_date.toISOString();
  }

  const entry = await ChangelogModel.findOneAndUpdate(
    { entry_id },
    { $set: updateValue },
    { new: true, runValidators: true }
  ).lean();

  if (!entry) ThrowFormattedError('NOT_FOUND', `Changelog '${entry_id}' not found.`);
  return SerializeChangelogEntry(entry);
}

/**
 * Creates a new draft revision from a published changelog entry.
 *
 * @param {string} entry_id
 * @param {Object} input
 * @param {string|null} [created_by=null]
 * @returns {Promise<Object>}
 */
async function CreateChangelogRevision(entry_id, input, created_by = null) {
  const source = await ChangelogModel.findOne({ entry_id }).lean();
  if (!source) ThrowFormattedError('NOT_FOUND', `Changelog '${entry_id}' not found.`);
  if (source.status !== 'Published') {
    ThrowFormattedError('VALIDATION_ERROR', 'Only published changelogs can be revised.');
  }

  const normalizedInput = {
    ...input,
    ...(Object.prototype.hasOwnProperty.call(input, 'tickets')
      ? { tickets: NormalizeChangelogTickets(input.tickets) }
      : {}),
  };
  const { error, value } = ValidateUpdateChangelog(normalizedInput);
  if (error) ThrowFormattedError('VALIDATION_ERROR', error.message, { details: error.details });
  if (value.status === 'Published') {
    ThrowFormattedError('VALIDATION_ERROR', 'New revisions are created as drafts and published separately.');
  }

  const baseEntry = SerializeChangelogEntry(source);
  const revisionEntryId = uuidv4();
  const revisionPayload = {
    application_reference: baseEntry.application_reference,
    version: baseEntry.version,
    title: baseEntry.title,
    summary: baseEntry.summary || '',
    details_md: baseEntry.details_md || '',
    change_type: baseEntry.change_type,
    impact_scope: baseEntry.impact_scope,
    release_date: baseEntry.release_date,
    visibility: baseEntry.visibility,
    tags: Array.isArray(baseEntry.tags) ? baseEntry.tags : [],
    tickets: NormalizeChangelogTickets(baseEntry.tickets),
    attachments: Array.isArray(baseEntry.attachments) ? baseEntry.attachments : [],
    entry_id: revisionEntryId,
    entry_group_id: GetEntryGroupId(baseEntry),
    revision_number: GetRevisionNumber(baseEntry) + 1,
    previous_entry_id: baseEntry.entry_id,
    status: value.status || 'Draft',
    created_by,
    updated_by: created_by,
  };

  if (Object.prototype.hasOwnProperty.call(value, 'version')) revisionPayload.version = value.version;
  if (Object.prototype.hasOwnProperty.call(value, 'title')) revisionPayload.title = value.title;
  if (Object.prototype.hasOwnProperty.call(value, 'summary')) revisionPayload.summary = value.summary;
  if (Object.prototype.hasOwnProperty.call(value, 'details_md')) revisionPayload.details_md = value.details_md;
  if (Object.prototype.hasOwnProperty.call(value, 'change_type')) revisionPayload.change_type = value.change_type;
  if (Object.prototype.hasOwnProperty.call(value, 'impact_scope')) revisionPayload.impact_scope = value.impact_scope;
  if (Object.prototype.hasOwnProperty.call(value, 'visibility')) revisionPayload.visibility = value.visibility;
  if (Object.prototype.hasOwnProperty.call(value, 'tags')) revisionPayload.tags = value.tags;
  if (Object.prototype.hasOwnProperty.call(value, 'tickets')) revisionPayload.tickets = value.tickets;
  if (Object.prototype.hasOwnProperty.call(value, 'attachments')) revisionPayload.attachments = value.attachments;
  if (Object.prototype.hasOwnProperty.call(value, 'release_date')) {
    revisionPayload.release_date = value.release_date.toISOString();
  }

  const created = await ChangelogModel.create(revisionPayload);
  return SerializeChangelogEntry(created.toObject());
}

/**
 * Publishes a changelog entry:
 *  1. Verifies it exists and is not already published
 *  2. Computes SHA-256 of the full document
 *  3. Uploads a JSON snapshot to S3
 *  4. Updates status=Published, immutable_sha256, immutable_s3_key
 *  5. If released_request_ids provided, links evolution requests and backfills tickets[]
 *
 * @param {string} entry_id
 * @param {string|null} [updated_by=null]
 * @param {string[]} [released_request_ids=[]]
 * @returns {Promise<Object>} Published changelog document
 */
async function PublishChangelog(entry_id, updated_by = null, released_request_ids = []) {
  const existing = await ChangelogModel.findOne({ entry_id }).lean();
  if (!existing) ThrowFormattedError('NOT_FOUND', `Changelog '${entry_id}' not found.`);
  if (existing.status === 'Published') {
    ThrowFormattedError('CONFLICT', 'Changelog is already published.');
  }
  return FinalizePublishedChangelog(existing, updated_by, released_request_ids);
}

// *************** EXPORT MODULE ***************
module.exports = {
  GetAdminChangelogs,
  GetChangelog,
  GetPublicChangelogs,
  CreateChangelog,
  CreateChangelogRevision,
  UpdateChangelog,
  PublishChangelog,
};
