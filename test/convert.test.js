import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAiCompletion } from '@gladysassistant/integration-sdk';
import {
  toClaudeMessages,
  toClaudeToolChoice,
  toClaudeTools,
  toOpenAiCompletion,
} from '../src/claude/convert.js';
import { claudeResponse } from './helpers/fakeAnthropic.js';

test('system and developer messages become the top-level system prompt', () => {
  const { system, messages } = toClaudeMessages([
    { role: 'system', content: 'You are Gladys.' },
    { role: 'developer', content: [{ type: 'text', text: 'Be brief.' }] },
    { role: 'user', content: 'Hi' },
  ]);
  assert.equal(system, 'You are Gladys.\n\nBe brief.');
  assert.deepEqual(messages, [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }]);
});

test('a tool round becomes tool_use blocks answered by tool_result blocks', () => {
  const { messages } = toClaudeMessages([
    { role: 'user', content: 'Turn on the kitchen light' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'device_set', arguments: '{"device":"kitchen","value":1}' },
        },
        { id: 'call_2', type: 'function', function: { name: 'device_get', arguments: '' } },
      ],
    },
    { role: 'tool', tool_call_id: 'call_1', content: '{"ok":true}' },
    { role: 'tool', tool_call_id: 'call_2', content: [{ type: 'text', text: 'off' }] },
  ]);

  assert.deepEqual(messages, [
    { role: 'user', content: [{ type: 'text', text: 'Turn on the kitchen light' }] },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'call_1',
          name: 'device_set',
          input: { device: 'kitchen', value: 1 },
        },
        { type: 'tool_use', id: 'call_2', name: 'device_get', input: {} },
      ],
    },
    {
      // Both results in ONE user message: the API wants them together.
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'call_1', content: '{"ok":true}' },
        { type: 'tool_result', tool_use_id: 'call_2', content: 'off' },
      ],
    },
  ]);
});

test('a tool call left without a result gets an error result, an orphan result becomes text', () => {
  const { messages } = toClaudeMessages([
    { role: 'user', content: 'Hi' },
    {
      role: 'assistant',
      content: 'Let me check.',
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'x', arguments: '{}' } }],
    },
    { role: 'tool', tool_call_id: 'call_9', content: 'stray' },
    { role: 'user', content: 'Well?' },
  ]);
  assert.deepEqual(messages[2], {
    role: 'user',
    content: [
      { type: 'tool_result', tool_use_id: 'call_1', content: 'No result.', is_error: true },
      { type: 'text', text: 'stray' },
      { type: 'text', text: 'Well?' },
    ],
  });
});

test('the conversation starts with a user message and never ends on an assistant one', () => {
  const { messages } = toClaudeMessages([
    { role: 'system', content: 'S' },
    { role: 'assistant', content: 'Hello, how can I help?' },
  ]);
  assert.equal(messages[0].role, 'user');
  assert.equal(messages.at(-1).role, 'user');
  assert.equal(messages[1].role, 'assistant');
});

test('consecutive messages of the same role are merged', () => {
  const { messages } = toClaudeMessages([
    { role: 'user', content: 'One' },
    { role: 'user', content: 'Two' },
  ]);
  assert.equal(messages.length, 1);
  assert.deepEqual(
    messages[0].content.map((block) => block.text),
    ['One', 'Two'],
  );
});

test('image_url parts become image blocks (data URL or https), others are dropped', () => {
  const { messages } = toClaudeMessages([
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is on the camera?' },
        { type: 'image_url', image_url: { url: 'data:image/jpg;base64,AAAA' } },
        { type: 'image_url', image_url: { url: 'https://example.com/a.png' } },
        { type: 'image_url', image_url: { url: 'data:image/bmp;base64,AAAA' } },
        { type: 'image_url', image_url: { url: 'ftp://example.com/a.png' } },
      ],
    },
  ]);
  assert.deepEqual(messages[0].content.slice(1), [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
    { type: 'image', source: { type: 'url', url: 'https://example.com/a.png' } },
  ]);
});

test('tool ids the Messages API would refuse are made valid on both sides', () => {
  const { messages } = toClaudeMessages([
    { role: 'user', content: 'Hi' },
    {
      role: 'assistant',
      tool_calls: [{ id: 'call:1.a', type: 'function', function: { name: 'x', arguments: '{}' } }],
    },
    { role: 'tool', tool_call_id: 'call:1.a', content: 'done' },
  ]);
  assert.equal(messages[1].content[0].id, 'call_1_a');
  assert.equal(messages[2].content[0].tool_use_id, 'call_1_a');
});

test('the replayed turn is used when the tool call ids match', () => {
  const original = [
    { type: 'thinking', thinking: '', signature: 'sig' },
    { type: 'tool_use', id: 'toolu_1', name: 'x', input: {} },
  ];
  const seen = [];
  const { messages } = toClaudeMessages(
    [
      { role: 'user', content: 'Hi' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'toolu_1', type: 'function', function: { name: 'x', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'toolu_1', content: 'ok' },
    ],
    {
      replay: (ids) => {
        seen.push(ids);
        return original;
      },
    },
  );
  assert.deepEqual(seen, [['toolu_1']]);
  assert.deepEqual(messages[1].content, original);
});

test('OpenAI tools become Messages API tools', () => {
  assert.equal(toClaudeTools(undefined), undefined);
  assert.deepEqual(
    toClaudeTools([
      {
        type: 'function',
        function: {
          name: 'device_set',
          description: 'Set a device',
          parameters: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
      { type: 'function', function: { name: 'ping' } },
    ]),
    [
      {
        name: 'device_set',
        description: 'Set a device',
        input_schema: { type: 'object', properties: { id: { type: 'string' } } },
      },
      { name: 'ping', input_schema: { type: 'object', properties: {} } },
    ],
  );
});

test('a forced tool choice becomes auto: the current models refuse forced tool use', () => {
  assert.equal(toClaudeToolChoice(undefined), undefined);
  assert.deepEqual(toClaudeToolChoice('none'), { type: 'none' });
  assert.deepEqual(toClaudeToolChoice('auto'), { type: 'auto' });
  assert.deepEqual(toClaudeToolChoice('required'), { type: 'auto' });
  assert.deepEqual(toClaudeToolChoice({ type: 'function', function: { name: 'x' } }), {
    type: 'auto',
  });
});

test('a text answer becomes a completion the Gladys core accepts as is', () => {
  const completion = toOpenAiCompletion(
    claudeResponse({
      content: [
        { type: 'thinking', thinking: '', signature: 'sig' },
        { type: 'text', text: 'The light ' },
        { type: 'text', text: 'is on.' },
      ],
      usage: { input_tokens: 10, output_tokens: 4, cache_read_input_tokens: 90 },
    }),
  );
  assert.deepEqual(validateAiCompletion(completion), []);
  assert.deepEqual(completion.choices[0].message, {
    role: 'assistant',
    content: 'The light is on.',
  });
  assert.equal(completion.choices[0].finish_reason, 'stop');
  assert.deepEqual(completion.usage, {
    prompt_tokens: 100,
    completion_tokens: 4,
    total_tokens: 104,
  });
});

test('tool_use blocks become tool_calls with JSON string arguments', () => {
  const completion = toOpenAiCompletion(
    claudeResponse({
      stop_reason: 'tool_use',
      content: [
        { type: 'tool_use', id: 'toolu_1', name: 'device_set', input: { value: 1 } },
        { type: 'tool_use', id: 'toolu_2', name: 'device_get', input: {} },
      ],
    }),
  );
  assert.deepEqual(validateAiCompletion(completion), []);
  const { message, finish_reason } = completion.choices[0];
  assert.equal(finish_reason, 'tool_calls');
  assert.equal(message.content, null);
  assert.deepEqual(message.tool_calls, [
    { id: 'toolu_1', type: 'function', function: { name: 'device_set', arguments: '{"value":1}' } },
    { id: 'toolu_2', type: 'function', function: { name: 'device_get', arguments: '{}' } },
  ]);
});

test('never more than the 20 tool calls the core accepts', () => {
  const content = Array.from({ length: 25 }, (_, index) => ({
    type: 'tool_use',
    id: `toolu_${index}`,
    name: 'x',
    input: {},
  }));
  const completion = toOpenAiCompletion(claudeResponse({ stop_reason: 'tool_use', content }));
  assert.equal(completion.choices[0].message.tool_calls.length, 20);
  assert.deepEqual(validateAiCompletion(completion), []);
});

test('a tool call cut by max_tokens is never handed to Gladys', () => {
  const completion = toOpenAiCompletion(
    claudeResponse({
      stop_reason: 'max_tokens',
      content: [
        { type: 'text', text: 'Turning on' },
        { type: 'tool_use', id: 'toolu_1', name: 'device_set', input: {} },
      ],
    }),
  );
  assert.equal(completion.choices[0].message.tool_calls, undefined);
  assert.equal(completion.choices[0].message.content, 'Turning on');
  assert.equal(completion.choices[0].finish_reason, 'length');
});
