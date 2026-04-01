// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const { expressMiddleware } = require('@apollo/server/express4');

// *************** IMPORT MODULE ***************
const config = require('./core/config');
const { ConnectDB, GetDBStatus } = require('./core/db');
const { BuildApolloServer, BuildApolloContext } = require('./core/apollo');
const { ApiKeyMiddleware } = require('./middlewares/api_key.middleware');
const webhookRouter = require('./routes/webhook.route');

// *************** VARIABLES ***************
const app = express();

// *************** FUNCTIONS ***************
/**
 * Bootstraps the Express + Apollo Server 4 application.
 * - Connects to MongoDB
 * - Starts Apollo Server
 * - Registers middleware and routes
 * - Binds HTTP server to configured port
 *
 * @returns {Promise<void>}
 */
async function Bootstrap() {
  // Connect to MongoDB first
  await ConnectDB();

  // Build and start Apollo Server
  const apolloServer = BuildApolloServer();
  await apolloServer.start();

  // --- Global Express middleware ---
  app.use(
    helmet({
      // Allow Apollo Sandbox in non-production environments
      contentSecurityPolicy: config.isProduction ? undefined : false,
      crossOriginEmbedderPolicy: config.isProduction,
    })
  );

  app.use(
    cors({
      origin: config.isProduction ? [] : '*',
      credentials: true,
    })
  );

  app.use(morgan(config.isProduction ? 'combined' : 'dev'));

  // --- Webhook routes (mounted before bodyParser so they can use express.raw) ---
  app.use('/webhooks', webhookRouter);

  // Parse body BEFORE middleware so api_key can be read from body
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // API key enrichment middleware (additive — does NOT block requests).
  // JWT resolution is handled inside BuildApolloContext per-request.
  app.use(ApiKeyMiddleware);

  // --- Health route ---
  app.get('/health', async (req, res) => {
    const dbStatus = GetDBStatus();
    res.json({
      status: dbStatus.isConnected ? 'ok' : 'degraded',
      dependencies: {
        mongodb: {
          connected: dbStatus.isConnected,
          state: dbStatus.state,
        },
      },
      timestamp: new Date().toISOString(),
    });
  });

  // --- Apollo GraphQL route ---
  app.use(
    '/graphql',
    expressMiddleware(apolloServer, {
      context: BuildApolloContext,
    })
  );

  // --- 404 fallback ---
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // --- Global error handler ---
  app.use((err, req, res, next) => {
    console.error('[Express] Unhandled error:', err);
    res.status(500).json({
      error: config.isProduction ? 'Internal server error' : err.message,
    });
  });

  // --- Start HTTP server ---
  const httpServer = http.createServer(app);
  httpServer.listen(config.port, () => {
    console.log(`[Server] Running at http://localhost:${config.port}`);
    console.log(`[Server] GraphQL endpoint: http://localhost:${config.port}/graphql`);
    console.log(`[Server] Environment: ${config.env}`);
  });
}

Bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal error:', err);
  process.exit(1);
});

// *************** EXPORT MODULE ***************
module.exports = app;
