import { test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { validateAiCompletion } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from '../src/config.js';
import {
  BETAS,
  CHAT_TIMEOUT_MS,
  ROUTER_TIMEOUT_MS,
  buildClaudeRequest,
  createChatHandler,
  describeError,
} from '../src/claude/chat.js';
import { createThinkingCache } from '../src/claude/thinkingCache.js';
import { apiError, claudeResponse, createFakeAnthropic } from './helpers/fakeAnthropic.js';

const config = normalizeConfig({ api_key: 'sk-ant-test' });

function handler(fake, overrides = {}) {
  return createChatHandler({
    getConfig: () => ({ ...config, ...overrides }),
    clientFactory: fake.factory,
  });
}

test('the chat runs on the chat model, the router on the fast model at low effort', () => {
  const chat = buildClaudeRequest(
    { messages: [{ role: 'user', content: 'Hi' }], purpose: 'chat' },
    config,
  );
  assert.equal(chat.model, 'claude-opus-5-5');
  assert.deepEqual(chat.output_config, { effort: 'medium' });

  const router = buildClaudeRequest(
    { messages: [{ role: 'user', content: 'Hi' }], purpose: 'intent-classification' },
    config,
  );
  assert.equal(router.model, 'claude-haiku-5-5');
  assert.deepEqual(router.output_config, { effort: 'low' });
});

test('every request: adaptive thinking, drop_block, caching, fallbacks, no sampling parameter', () => {
  const body = buildClaudeRequest(
    { messages: [{ role: 'user', content: 'Hi' }], temperature: 0.2, model: 'gpt-4o' },
    config,
  );
  assert.deepEqual(body.thinking, {
    type: 'adaptive',
    block_binding: { prefix_mismatch_behavior: 'drop_block' },
  });
  assert.deepEqual(body.cache_control, { type: 'ephemeral' });
  assert.equal(body.fallbacks, 'default');
  assert.deepEqual(body.betas, BETAS);
  // Sampling parameters are refused by the current models, and the `model`
  // of the request is Gladys Plus vocabulary.
  assert.equal(body.temperature, undefined);
  assert.equal(body.model, 'claude-opus-5-5');
});

test('max_tokens: the configured budget is a floor, the request may ask for more', () => {
  const small = buildClaudeRequest({ messages: [], max_tokens: 200 }, config);
  assert.equal(small.max_tokens, 16000);
  const big = buildClaudeRequest({ messages: [], max_tokens: 40000 }, config);
  assert.equal(big.max_tokens, 40000);
  const huge = buildClaudeRequest({ messages: [], max_tokens: 10_000_000 }, config);
  assert.equal(huge.max_tokens, 64000);
});

test('tools are passed with tool_choice, never a tool_choice without tools', () => {
  const withTools = buildClaudeRequest(
    {
      messages: [{ role: 'user', content: 'Hi' }],
      tools: [{ type: 'function', function: { name: 'x', parameters: { type: 'object' } } }],
      tool_choice: 'required',
    },
    config,
  );
  assert.equal(withTools.tools.length, 1);
  assert.deepEqual(withTools.tool_choice, { type: 'auto' });

  const without = buildClaudeRequest(
    { messages: [{ role: 'user', content: 'Hi' }], tool_choice: 'auto' },
    config,
  );
  assert.equal(without.tools, undefined);
  assert.equal(without.tool_choice, undefined);
});

test('the handler answers with a valid completion, under the delays of the core', async () => {
  const fake = createFakeAnthropic();
  const onAiChat = handler(fake);

  const completion = await onAiChat({
    messages: [{ role: 'user', content: 'Hi' }],
    purpose: 'chat',
  });
  assert.deepEqual(validateAiCompletion(completion), []);
  assert.equal(completion.choices[0].message.content, 'Hello!');
  assert.equal(fake.calls.messages[0].options.timeout, CHAT_TIMEOUT_MS);
  assert.equal(fake.calls.messages[0].options.maxRetries, 1);

  await onAiChat({ messages: [{ role: 'user', content: 'Hi' }], purpose: 'intent-classification' });
  assert.equal(fake.calls.messages[1].options.timeout, ROUTER_TIMEOUT_MS);
  assert.equal(fake.calls.messages[1].options.maxRetries, 0);
  assert.deepEqual(fake.calls.keys, ['sk-ant-test'], 'one client per API key');
});

test('without an API key, the handler fails with a message that says so', async () => {
  const fake = createFakeAnthropic();
  await assert.rejects(handler(fake, { api_key: '' })({ messages: [] }), /No Anthropic API key/);
  assert.equal(fake.calls.messages.length, 0);
});

test('the thinking of a tool round goes back to Claude with the tool results', async () => {
  const fake = createFakeAnthropic();
  const toolTurn = [
    { type: 'thinking', thinking: '', signature: 'sig-1' },
    { type: 'tool_use', id: 'toolu_1', name: 'device_get', input: { id: 'kitchen' } },
  ];
  fake.queue(claudeResponse({ stop_reason: 'tool_use', content: toolTurn }));
  const onAiChat = handler(fake);

  const first = await onAiChat({ messages: [{ role: 'user', content: 'Is the kitchen on?' }] });
  const call = first.choices[0].message.tool_calls[0];

  // The core runs the tool, then sends the round back as OpenAI messages.
  await onAiChat({
    messages: [
      { role: 'user', content: 'Is the kitchen on?' },
      { role: 'assistant', content: null, tool_calls: [call] },
      { role: 'tool', tool_call_id: call.id, content: '{"state":1}' },
    ],
  });
  const replayed = fake.calls.messages[1].body.messages[1];
  assert.deepEqual(replayed, { role: 'assistant', content: toolTurn });
});

test('a refusal still answers, with a text the user can read', async () => {
  const fake = createFakeAnthropic();
  fake.queue(
    claudeResponse({
      stop_reason: 'refusal',
      stop_details: { type: 'refusal', category: 'cyber' },
      content: [],
    }),
  );
  const completion = await handler(fake)({ messages: [{ role: 'user', content: 'Hi' }] });
  assert.deepEqual(validateAiCompletion(completion), []);
  assert.equal(completion.choices[0].finish_reason, 'content_filter');
  assert.match(completion.choices[0].message.content, /cannot help/);
});

test('API errors are named, and never carry the API key', async () => {
  const cases = [
    [apiError(401), /refused the API key/],
    [apiError(404), /claude-opus-5-5 is not available/],
    [apiError(429), /rate limit/],
    [apiError(400, 'messages: bad'), /refused the request \(400\): .*messages: bad/],
    [apiError(529, 'Overloaded'), /Anthropic API error 529/],
    [new Anthropic.APIConnectionError({ message: 'down' }), /Cannot reach api\.anthropic\.com/],
    [new Anthropic.APIConnectionTimeoutError(), /did not answer in time/],
    [new Anthropic.APIUserAbortError(), /did not answer in time/],
  ];
  for (const [error, expected] of cases) {
    const fake = createFakeAnthropic();
    fake.queue(error);
    await assert.rejects(handler(fake)({ messages: [] }), (err) => {
      assert.match(err.message, expected);
      assert.doesNotMatch(err.message, /sk-ant-test/);
      return true;
    });
  }
  const plain = new Error('boom');
  assert.equal(describeError(plain, 'm'), plain);
});

test('the thinking cache keeps only tool rounds with thinking, and forgets them', () => {
  let time = 0;
  const cache = createThinkingCache({ now: () => time, ttl: 1000, max: 2 });
  cache.remember([{ type: 'text', text: 'no tool' }]);
  cache.remember([{ type: 'tool_use', id: 'a', name: 'x', input: {} }]);
  assert.equal(cache.size, 0, 'nothing to replay without a tool call and thinking');

  const turn = (id) => [
    { type: 'thinking', thinking: '', signature: 's' },
    { type: 'tool_use', id, name: 'x', input: {} },
  ];
  cache.remember(turn('a'));
  cache.remember(turn('b'));
  cache.remember(turn('c'));
  assert.equal(cache.size, 2, 'bounded');
  assert.equal(cache.replay(['a']), undefined, 'oldest dropped first');
  assert.deepEqual(cache.replay(['c']), turn('c'));

  time = 2000;
  assert.equal(cache.replay(['c']), undefined, 'expired');
});

test('the thinking cache matches a turn by all its tool call ids, in any order', () => {
  const cache = createThinkingCache();
  const turn = [
    { type: 'redacted_thinking', data: 'x' },
    { type: 'tool_use', id: 'a', name: 'x', input: {} },
    { type: 'tool_use', id: 'b', name: 'y', input: {} },
  ];
  cache.remember(turn);
  assert.deepEqual(cache.replay(['b', 'a']), turn);
  assert.equal(cache.replay(['a']), undefined);
});
