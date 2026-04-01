// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { AssertAdmin, AssertAuthenticated } = require('./auth.middleware');
const { ApiKeyMiddleware, AssertApiKey } = require('./api_key.middleware');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************

// *************** EXPORT MODULE ***************
module.exports = {
  AssertAdmin,
  AssertAuthenticated,
  ApiKeyMiddleware,
  AssertApiKey,
};
