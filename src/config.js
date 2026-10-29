// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the administrator in Gladys, from the
// `config_schema` declared in `gladys-assistant-integration.json`. The SDK
// fetches it (`gladys.getConfig()`) and notifies every change through
// `gladys.onConfigUpdated()`.
//
// This module only provides the defaults and normalizes the received object,
// so the rest of the code never deals with `undefined`, a number typed as a
// string, or a model id the select no longer offers.
// -----------------------------------------------------------------------------

/**
 * The Claude models offered in the Configuration screen, strongest first. The
 * ids are the exact Anthropic API model ids (no date suffix): they are stored
 * by users, so an id leaves this list only when Anthropic retires the model.
 */
export const MODELS = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-fable-5-1': 'Claude Fable 5.1',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
  'claude-haiku-5-5': 'Claude Haiku 5.5',
};

/** Effort levels offered for the chat (`output_config.effort`). */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh'];

/** Bounds of the `max_tokens` field, mirrored by the manifest. */
export const MAX_TOKENS_MIN = 1024;
export const MAX_TOKENS_MAX = 32000;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // The Anthropic API key. A `secret` field: no default, never logged.
  api_key: '',
  // The model of the chat, the scene `ai.ask` action and the weekly digest.
  model: 'claude-opus-5-5',
  // The model of the intent router, which runs before every chat turn and must
  // answer within 20 s: a fast, cheap model is the right one there.
  fast_model: 'claude-haiku-5-5',
  // How hard the chat model thinks. Claude Opus 5.5 defaults to medium.
  effort: 'medium',
  // Output budget of one answer (thinking included).
  max_tokens: 16000,
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const config = { ...DEFAULT_CONFIG, ...raw };
  return {
    ...config,
    api_key: String(config.api_key ?? '').trim(),
    model: config.model in MODELS ? config.model : DEFAULT_CONFIG.model,
    fast_model: config.fast_model in MODELS ? config.fast_model : DEFAULT_CONFIG.fast_model,
    effort: EFFORTS.includes(config.effort) ? config.effort : DEFAULT_CONFIG.effort,
    max_tokens: clampInteger(config.max_tokens, MAX_TOKENS_MIN, MAX_TOKENS_MAX),
  };
}

/** The display name of a model id. */
export function modelName(id) {
  return MODELS[id] ?? id;
}

function clampInteger(value, min, max) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) {
    return DEFAULT_CONFIG.max_tokens;
  }
  return Math.min(max, Math.max(min, number));
}
