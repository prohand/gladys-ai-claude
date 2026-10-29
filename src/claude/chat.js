// -----------------------------------------------------------------------------
// The AI provider: one OpenAI chat completion in, one out, answered by Claude.
//
// The whole agentic loop (prompts, tools, history) stays in the Gladys core:
// this handler translates the request (convert.js), calls the Messages API,
// and translates the answer back. It renders nothing and runs no tool.
//
// What each `purpose` gets:
//   - `intent-classification` (the router, before every chat turn): the fast
//     model at low effort, one attempt, under the 20 s the core waits;
//   - `chat`, `weekly-digest` and anything else: the main model at the effort
//     of the configuration, under the 120 s the core waits.
// -----------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import { AI_CHAT_PURPOSES, createLogger } from '@gladysassistant/integration-sdk';
import { modelName } from '../config.js';
import {
  toClaudeMessages,
  toClaudeToolChoice,
  toClaudeTools,
  toOpenAiCompletion,
} from './convert.js';
import { createThinkingCache } from './thinkingCache.js';

const logger = createLogger({ name: 'claude' });

/**
 * Beta features every request opts into:
 *   - server-side refusal fallback: when the model declines for policy
 *     reasons, the API re-runs the request on the default fallback model
 *     inside the same call (a model without fallbacks simply runs alone);
 *   - thinking binding controls: a replayed thinking block that no longer
 *     matches the conversation (the core rebuilt the system prompt, a tool
 *     appeared) is dropped instead of failing the request with a 400.
 */
export const BETAS = ['server-side-fallback-2026-07-01', 'thinking-binding-controls-2026-08-01'];

/** How long a request may take, under the ack delays of the core (120 s and 20 s). */
export const CHAT_TIMEOUT_MS = 110_000;
export const ROUTER_TIMEOUT_MS = 18_000;

/** A request can never ask for more output than this. */
const MAX_OUTPUT_TOKENS = 64_000;

/**
 * The Anthropic client of an API key, built once per key.
 * @param {string} apiKey
 */
export function defaultClientFactory(apiKey) {
  return new Anthropic({ apiKey, maxRetries: 1 });
}

/**
 * Build the Messages API request answering one relayed chat completion.
 *
 * @param {object} request the OpenAI-compatible request relayed by the core
 * @param {object} config normalized configuration
 * @param {object} [options]
 * @param {(ids: string[]) => Array<object>|undefined} [options.replay]
 */
export function buildClaudeRequest(request, config, { replay } = {}) {
  const router = request?.purpose === AI_CHAT_PURPOSES.INTENT_CLASSIFICATION;
  const { system, messages } = toClaudeMessages(request?.messages, { replay });
  const tools = toClaudeTools(request?.tools);
  const toolChoice = tools ? toClaudeToolChoice(request?.tool_choice) : undefined;

  return {
    model: router ? config.fast_model : config.model,
    // The caller's `max_tokens` is sized for an answer without reasoning:
    // thinking counts against it too, so the configured budget is a floor.
    max_tokens: Math.min(
      MAX_OUTPUT_TOKENS,
      Math.max(config.max_tokens, Number(request?.max_tokens) || 0),
    ),
    ...(system ? { system } : {}),
    messages,
    ...(tools && tools.length > 0 ? { tools } : {}),
    ...(toolChoice ? { tool_choice: toolChoice } : {}),
    // Thinking is always on with the current models: adaptive lets Claude
    // decide how much, and effort sets the depth.
    thinking: { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
    output_config: { effort: router ? 'low' : config.effort },
    // The system prompt and the tool schemas come back on every turn: cached,
    // they are billed a tenth of the price after the first request.
    cache_control: { type: 'ephemeral' },
    fallbacks: 'default',
    betas: BETAS,
  };
}

/**
 * The `onAiChat` handler.
 *
 * @param {object} options
 * @param {() => object} options.getConfig the current normalized configuration
 * @param {(apiKey: string) => object} [options.clientFactory] builds the Anthropic client
 * @param {object} [options.cache] see thinkingCache.js
 * @returns {(request: object) => Promise<object>}
 */
export function createChatHandler({
  getConfig,
  clientFactory = defaultClientFactory,
  cache = createThinkingCache(),
}) {
  const clients = new Map();
  const clientFor = (apiKey) => {
    if (!clients.has(apiKey)) {
      clients.clear();
      clients.set(apiKey, clientFactory(apiKey));
    }
    return clients.get(apiKey);
  };

  return async function onAiChat(request) {
    const config = getConfig();
    if (!config.api_key) {
      throw new Error('No Anthropic API key: fill it in the Configuration screen.');
    }
    const router = request?.purpose === AI_CHAT_PURPOSES.INTENT_CLASSIFICATION;
    const timeout = router ? ROUTER_TIMEOUT_MS : CHAT_TIMEOUT_MS;
    const body = buildClaudeRequest(request, config, { replay: cache.replay });

    const started = Date.now();
    let response;
    try {
      response = await clientFor(config.api_key).beta.messages.create(body, {
        timeout,
        // The router has 20 s: a retry would only make it fail later.
        maxRetries: router ? 0 : 1,
        signal: AbortSignal.timeout(timeout),
      });
    } catch (err) {
      throw describeError(err, body.model);
    }

    if (response.stop_reason === 'tool_use') {
      cache.remember(response.content);
    }
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    logger.info(
      `${request?.purpose ?? 'chat'}: ${modelName(response.model ?? body.model)} answered in ${seconds} s ` +
        `(stop: ${response.stop_reason}, in: ${response.usage?.input_tokens ?? 0}, ` +
        `cached: ${response.usage?.cache_read_input_tokens ?? 0}, out: ${response.usage?.output_tokens ?? 0})`,
    );

    const completion = toOpenAiCompletion(response);
    if (response.stop_reason === 'refusal') {
      logger.warn(`Claude declined the request (category: ${response.stop_details?.category})`);
      const { message } = completion.choices[0];
      message.content ||= 'I cannot help with that request.';
    } else if (response.stop_reason === 'max_tokens') {
      logger.warn(`The answer hit max_tokens (${body.max_tokens}): raise it in the configuration`);
    }
    return completion;
  };
}

/**
 * An error the logs and the Gladys reply can name, without the API key.
 * Throwing acks the request as failed: Gladys tells the user the provider is
 * unavailable and points at this integration — never a silent fallback.
 */
export function describeError(err, model) {
  if (err instanceof Anthropic.AuthenticationError) {
    return new Error('Anthropic refused the API key (401): check it in the configuration.');
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new Error(`Anthropic denied access (403): ${err.message}`);
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new Error(`The model ${model} is not available to this API key (404).`);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new Error('Anthropic rate limit reached (429): try again in a moment.');
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new Error(`Anthropic refused the request (400): ${err.message}`);
  }
  if (
    err instanceof Anthropic.APIConnectionTimeoutError ||
    // The overall deadline (AbortSignal.timeout) aborts the request.
    err instanceof Anthropic.APIUserAbortError ||
    err?.name === 'TimeoutError'
  ) {
    return new Error('Claude did not answer in time.');
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new Error('Cannot reach api.anthropic.com: check the internet access of Gladys.');
  }
  if (err instanceof Anthropic.APIError) {
    return new Error(`Anthropic API error ${err.status ?? ''}: ${err.message}`.trim());
  }
  return err instanceof Error ? err : new Error(String(err));
}
