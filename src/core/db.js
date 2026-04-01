// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const mongoose = require('mongoose');

// *************** IMPORT MODULE ***************
const config = require('./config');

// *************** VARIABLES ***************
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

// *************** FUNCTIONS ***************
/**
 * Attempts to connect to MongoDB with exponential-linear retry logic.
 *
 * @param {number} [attempt=1] - Current attempt number (used internally for recursion)
 * @returns {Promise<void>}
 */
async function ConnectDB(attempt = 1) {
  try {
    await mongoose.connect(config.mongo.uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[DB] MongoDB connected successfully');
  } catch (err) {
    console.error(`[DB] Connection attempt ${attempt} failed: ${err.message}`);
    if (attempt >= MAX_RETRIES) {
      console.error('[DB] Max retries reached. Exiting process.');
      process.exit(1);
    }
    const delay = RETRY_DELAY_MS * attempt;
    console.log(`[DB] Retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return ConnectDB(attempt + 1);
  }
}

/**
 * Returns the current Mongoose connection state.
 *
 * @returns {{ isConnected: boolean, state: number }}
 */
function GetDBStatus() {
  return {
    isConnected: mongoose.connection.readyState === 1,
    state: mongoose.connection.readyState,
  };
}

// *************** EXPORT MODULE ***************
module.exports = { ConnectDB, GetDBStatus };
