// -----------------------------------------------------------------------------
// Entry point of the Gladys external integration "Claude AI".
//
// An AI provider (manifest `type: "ai"`): once an administrator selects it in
// the Artificial Intelligence settings of Gladys, every AI request of the
// instance — the chat and its tool calls, the intent router, the scene
// `ai.ask` action, the weekly digest — is answered by Claude through the
// Anthropic API.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { registerHandlers } from './src/app.js';

const gladys = new GladysIntegration();

// Every handler is registered BEFORE connect() (see src/app.js).
registerHandlers(gladys);

// --- Graceful shutdown -------------------------------------------------------
// The SDK disconnects cleanly and exits with code 0 when the supervisor stops
// the container (SIGTERM/SIGINT). Nothing to flush: the integration keeps no
// state on disk.
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the Claude AI integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
