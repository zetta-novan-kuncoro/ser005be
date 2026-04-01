// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const { v4: uuidv4 } = require('uuid');

// *************** IMPORT MODULE ***************
const UserLogModel = require('./user_log.model');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Appends an immutable audit log entry. This function is append-only —
 * no update or delete operations are provided.
 *
 * @param {Object} params
 * @param {string} params.application_reference
 * @param {string} params.actor_type - 'Admin' | 'User' | 'PublicEmbedConsumer' | 'System'
 * @param {string|null} [params.actor_id]
 * @param {string|null} [params.actor_label]
 * @param {string} params.action
 * @param {string} params.entity_type
 * @param {string} params.entity_id
 * @param {*} [params.before_state]
 * @param {*} [params.after_state]
 * @param {*} [params.metadata]
 * @returns {Promise<Object>}
 */
async function AppendUserLog({
  application_reference,
  actor_type,
  actor_id = null,
  actor_label = null,
  action,
  entity_type,
  entity_id,
  before_state = null,
  after_state = null,
  metadata = null,
}) {
  const entry = await UserLogModel.create({
    log_id: uuidv4(),
    application_reference,
    actor_type,
    actor_id,
    actor_label,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state,
    metadata,
    created_at: new Date().toISOString(),
  });

  return entry.toObject();
}

// *************** EXPORT MODULE ***************
module.exports = { AppendUserLog };
