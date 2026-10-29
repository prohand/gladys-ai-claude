// -----------------------------------------------------------------------------
// Connection status and the "Test the connection" action.
//
// The status shown in the Configuration screen says whether Claude can answer:
// an API key is there, Anthropic accepts it, and the chosen models are open to
// it. Reading a model (GET /v1/models/{id}) proves all three for free; only
// the test action spends tokens, on purpose, to show a real answer and its
// time.
// -----------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '@gladysassistant/integration-sdk';
import { modelName } from './config.js';
import { localize, pick } from './i18n.js';
import { BETAS, describeError } from './claude/chat.js';

const logger = createLogger({ name: 'connection' });

const TEST_TIMEOUT_MS = 25_000;

/**
 * Check the configuration against the Anthropic API, without generating text.
 *
 * @param {object} client the Anthropic client (null when there is no key)
 * @param {object} config normalized configuration
 * @returns {Promise<{ ok: boolean, message?: Record<string, string> }>}
 */
export async function checkConnection(client, config) {
  if (!client || !config.api_key) {
    return { ok: false, message: MESSAGES.noKey };
  }
  for (const model of new Set([config.model, config.fast_model])) {
    try {
      await client.models.retrieve(model, { timeout: 15_000, maxRetries: 1 });
    } catch (err) {
      logger.warn(`Connection check failed: ${describeError(err, model).message}`);
      return { ok: false, message: failure(err, model) };
    }
  }
  return { ok: true };
}

/**
 * The "Test the connection" action: one real, tiny answer from each model.
 *
 * @param {object} client the Anthropic client (null when there is no key)
 * @param {object} config normalized configuration
 * @returns {Promise<Record<string, string>>} the message shown under the button
 */
export async function testConnection(client, config) {
  if (!client || !config.api_key) {
    return MESSAGES.noKey;
  }
  const lines = [];
  for (const [role, model] of [
    ['chat', config.model],
    ['router', config.fast_model],
  ]) {
    const started = Date.now();
    try {
      await client.beta.messages.create(
        {
          model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
          thinking: { type: 'adaptive' },
          output_config: { effort: 'low' },
          fallbacks: 'default',
          betas: BETAS,
        },
        { timeout: TEST_TIMEOUT_MS, maxRetries: 0 },
      );
      const seconds = (Date.now() - started) / 1000;
      lines.push((language) => MESSAGES.answered(language, role, modelName(model), seconds));
    } catch (err) {
      logger.warn(`Test of ${model} failed: ${describeError(err, model).message}`);
      const reason = failure(err, model);
      lines.push((language) => `${pick(language, ROLE[role])} — ${reason[language]}`);
    }
  }
  return localize((language) => lines.map((line) => line(language)).join('\n'));
}

/** The localized reason of a failed call. */
function failure(err, model) {
  const name = modelName(model);
  if (err instanceof Anthropic.AuthenticationError) {
    return MESSAGES.badKey;
  }
  if (err instanceof Anthropic.NotFoundError) {
    return localize((language) => MESSAGES.noModel(language, name));
  }
  if (err instanceof Anthropic.RateLimitError) {
    return MESSAGES.rateLimited;
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return MESSAGES.unreachable;
  }
  const detail = describeError(err, model).message;
  return localize((language) => `${pick(language, MESSAGES.apiError)} ${detail}`);
}

const ROLE = {
  chat: { en: 'Chat', fr: 'Discussion', de: 'Chat', es: 'Chat' },
  router: { en: 'Router', fr: 'Routeur', de: 'Router', es: 'Enrutador' },
};

export const MESSAGES = {
  noKey: {
    en: 'No Anthropic API key: create one on console.anthropic.com and paste it in the configuration.',
    fr: "Pas de clé d'API Anthropic : créez-en une sur console.anthropic.com et collez-la dans la configuration.",
    de: 'Kein Anthropic-API-Schlüssel: Erstelle einen auf console.anthropic.com und füge ihn in die Konfiguration ein.',
    es: 'No hay clave de API de Anthropic: cree una en console.anthropic.com y péguela en la configuración.',
  },
  badKey: {
    en: 'Anthropic refused the API key: check it, or create a new one on console.anthropic.com.',
    fr: "Anthropic a refusé la clé d'API : vérifiez-la, ou créez-en une nouvelle sur console.anthropic.com.",
    de: 'Anthropic hat den API-Schlüssel abgelehnt: Prüfe ihn oder erstelle einen neuen auf console.anthropic.com.',
    es: 'Anthropic ha rechazado la clave de API: compruébela o cree una nueva en console.anthropic.com.',
  },
  rateLimited: {
    en: 'Anthropic rate limit reached: try again in a moment.',
    fr: 'Limite de requêtes Anthropic atteinte : réessayez dans un instant.',
    de: 'Anthropic-Anfragelimit erreicht: Versuche es gleich noch einmal.',
    es: 'Se ha alcanzado el límite de solicitudes de Anthropic: inténtelo de nuevo en un momento.',
  },
  unreachable: {
    en: 'Cannot reach api.anthropic.com: check the internet access of Gladys.',
    fr: "Impossible de joindre api.anthropic.com : vérifiez l'accès Internet de Gladys.",
    de: 'api.anthropic.com ist nicht erreichbar: Prüfe den Internetzugang von Gladys.',
    es: 'No se puede acceder a api.anthropic.com: compruebe el acceso a Internet de Gladys.',
  },
  apiError: {
    en: 'Anthropic API error:',
    fr: "Erreur de l'API Anthropic :",
    de: 'Fehler der Anthropic-API:',
    es: 'Error de la API de Anthropic:',
  },
  noModel: (language, name) =>
    pick(language, {
      en: `${name} is not available to this API key.`,
      fr: `${name} n'est pas disponible pour cette clé d'API.`,
      de: `${name} ist für diesen API-Schlüssel nicht verfügbar.`,
      es: `${name} no está disponible para esta clave de API.`,
    }),
  answered: (language, role, name, seconds) => {
    const time = seconds.toLocaleString(language, { maximumFractionDigits: 1 });
    return pick(language, {
      en: `${ROLE[role].en} — ${name} answered in ${time} s.`,
      fr: `${ROLE[role].fr} — ${name} a répondu en ${time} s.`,
      de: `${ROLE[role].de} — ${name} hat in ${time} s geantwortet.`,
      es: `${ROLE[role].es} — ${name} ha respondido en ${time} s.`,
    });
  },
};
