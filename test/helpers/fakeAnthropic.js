// -----------------------------------------------------------------------------
// A stand-in for the Anthropic client: records every call, answers what the
// test queued. No network, ever.
// -----------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';

/** A Messages API response, with sensible defaults. */
export function claudeResponse(overrides = {}) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [{ type: 'text', text: 'Hello!' }],
    stop_reason: 'end_turn',
    stop_details: null,
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 },
    ...overrides,
  };
}

/** An API error of the SDK, as the client throws it. */
export function apiError(status, message = 'error') {
  return Anthropic.APIError.generate(
    status,
    { type: 'error', error: { type: 'error', message } },
    message,
    new Headers(),
  );
}

/**
 * @returns a factory for `registerHandlers` / `createChatHandler`, and what it saw
 */
export function createFakeAnthropic() {
  const calls = { messages: [], models: [], keys: [] };
  const queue = [];
  let modelError = null;

  const next = () => {
    const item = queue.length > 0 ? queue.shift() : claudeResponse();
    if (item instanceof Error) {
      throw item;
    }
    return item;
  };

  const factory = (apiKey) => {
    calls.keys.push(apiKey);
    return {
      beta: {
        messages: {
          async create(body, options) {
            calls.messages.push({ body, options });
            return next();
          },
        },
      },
      models: {
        async retrieve(id, options) {
          calls.models.push({ id, options });
          if (modelError) {
            throw modelError;
          }
          return { id, type: 'model' };
        },
      },
    };
  };

  return {
    factory,
    calls,
    /** Queue the next Messages API answers (a response object, or an Error to throw). */
    queue: (...items) => queue.push(...items),
    /** Make GET /v1/models fail with this error (null to succeed again). */
    failModels: (err) => {
      modelError = err;
    },
  };
}
