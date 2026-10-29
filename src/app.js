// -----------------------------------------------------------------------------
// SDK wiring: every handler of the integration, registered on the Gladys
// client given. Kept out of index.js so the tests run it against the fake
// Gladys of the SDK (`createFakeGladys`) with a fake Anthropic client.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { modelName, normalizeConfig } from './config.js';
import { createChatHandler, defaultClientFactory } from './claude/chat.js';
import { createThinkingCache } from './claude/thinkingCache.js';
import { checkConnection, testConnection } from './connection.js';

const logger = createLogger({ name: 'app' });

/** Keys of the manifest `actions`. */
export const ACTIONS = { TEST_CONNECTION: 'test_connection' };

/**
 * Register the handlers on a Gladys client, before `connect()`.
 *
 * @param {object} gladys a `GladysIntegration` (or the fake one of the SDK)
 * @param {object} [options]
 * @param {(apiKey: string) => object} [options.clientFactory] builds the Anthropic client
 */
export function registerHandlers(gladys, { clientFactory = defaultClientFactory } = {}) {
  let config = normalizeConfig();
  const cache = createThinkingCache();

  // One client per API key: rebuilt only when the key changes.
  let client = null;
  let clientKey = null;
  const currentClient = () => {
    if (!config.api_key) {
      return null;
    }
    if (clientKey !== config.api_key) {
      client = clientFactory(config.api_key);
      clientKey = config.api_key;
    }
    return client;
  };

  // --- AI provider: every AI request of the instance arrives here ------------
  gladys.onAiChat(createChatHandler({ getConfig: () => config, clientFactory, cache }));

  // --- Manifest action: "Test the connection" ---------------------------------
  gladys.onAction(ACTIONS.TEST_CONNECTION, async () => {
    logger.info('Action test_connection');
    return testConnection(currentClient(), config);
  });

  // --- Configuration --------------------------------------------------------
  async function applyConfig(raw) {
    const previousKey = config.api_key;
    config = normalizeConfig(raw);
    if (config.api_key !== previousKey) {
      // Thinking blocks are bound to the account that produced them.
      cache.clear();
    }
    logger.info(
      `Configuration: chat ${modelName(config.model)} (effort ${config.effort}), ` +
        `router ${modelName(config.fast_model)}, max_tokens ${config.max_tokens}, ` +
        `API key ${config.api_key ? 'set' : 'missing'}`,
    );
    await reportStatus();
  }

  async function reportStatus() {
    const { ok, message } = await checkConnection(currentClient(), config);
    await gladys.setConnectionStatus(ok, ok ? undefined : message);
  }

  gladys.onConfigUpdated(async (newConfig) => {
    await applyConfig(newConfig);
  });

  // The SDK logs the WebSocket lifecycle itself: this only re-reads the
  // configuration, which may have changed while the integration was away.
  gladys.on('connected', async () => {
    try {
      await applyConfig(await gladys.getConfig());
    } catch (err) {
      logger.error('Post-connection initialization failed', err);
      await gladys
        .setConnectionStatus(false, {
          en: 'Initialization failed, check the integration logs.',
          fr: "L'initialisation a échoué, consultez les journaux de l'intégration.",
          de: 'Die Initialisierung ist fehlgeschlagen, prüfe die Protokolle der Integration.',
          es: 'La inicialización ha fallado, consulte los registros de la integración.',
        })
        .catch(() => {});
    }
  });

  return { getConfig: () => config, cache };
}
