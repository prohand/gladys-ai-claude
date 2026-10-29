// -----------------------------------------------------------------------------
// The integration as Gladys sees it: the fake Gladys of the SDK plays the
// core, a fake Anthropic client plays the API.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { ACTIONS, registerHandlers } from '../src/app.js';
import { MESSAGES } from '../src/connection.js';
import { apiError, claudeResponse, createFakeAnthropic } from './helpers/fakeAnthropic.js';

async function start(config = { api_key: 'sk-ant-test' }) {
  const gladys = createFakeGladys({ config });
  const fake = createFakeAnthropic();
  const app = registerHandlers(gladys, { clientFactory: fake.factory });
  await gladys.connect();
  return { gladys, fake, app };
}

test('connected with a valid key: the status is green, both models checked', async () => {
  const { gladys, fake } = await start();
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.deepEqual(
    fake.calls.models.map((call) => call.id),
    ['claude-opus-5-5', 'claude-haiku-5-5'],
  );
});

test('without a key: the status says what to do, and no client is built', async () => {
  const { gladys, fake } = await start({});
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.deepEqual(gladys.fake.connectionStatus.message, MESSAGES.noKey);
  assert.equal(fake.calls.keys.length, 0);
});

test('a refused key turns the status red with its reason', async () => {
  const gladys = createFakeGladys({ config: { api_key: 'sk-ant-bad' } });
  const fake = createFakeAnthropic();
  fake.failModels(apiError(401));
  registerHandlers(gladys, { clientFactory: fake.factory });
  await gladys.connect();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.deepEqual(gladys.fake.connectionStatus.message, MESSAGES.badKey);
});

test('the core relays a chat completion and gets Claude answer back', async () => {
  const { gladys, fake } = await start();
  fake.queue(claudeResponse({ content: [{ type: 'text', text: 'Bonjour !' }] }));
  const ack = await gladys.fake.aiChat({
    messages: [
      { role: 'system', content: 'You are Gladys.' },
      { role: 'user', content: 'Salut' },
    ],
    purpose: 'chat',
  });
  assert.equal(ack.success, true);
  assert.equal(ack.data.choices[0].message.content, 'Bonjour !');
  assert.equal(fake.calls.messages[0].body.system, 'You are Gladys.');
});

test('a failed request acks a failure: Gladys names the provider as unavailable', async () => {
  const { gladys, fake } = await start();
  fake.queue(apiError(401));
  const ack = await gladys.fake.aiChat({ messages: [{ role: 'user', content: 'Hi' }] });
  assert.equal(ack.success, false);
});

test('a configuration update switches the models and re-checks the connection', async () => {
  const { gladys, fake, app } = await start();
  await gladys.fake.configUpdated({
    api_key: 'sk-ant-other',
    model: 'claude-sonnet-5-5',
    effort: 'high',
  });
  assert.equal(app.getConfig().model, 'claude-sonnet-5-5');
  assert.deepEqual(fake.calls.keys, ['sk-ant-test', 'sk-ant-other']);
  assert.equal(fake.calls.models.at(-2).id, 'claude-sonnet-5-5');

  await gladys.fake.aiChat({ messages: [{ role: 'user', content: 'Hi' }] });
  assert.equal(fake.calls.messages[0].body.model, 'claude-sonnet-5-5');
  assert.deepEqual(fake.calls.messages[0].body.output_config, { effort: 'high' });
});

test('"Test the connection" reports both models in every language', async () => {
  const { gladys, fake } = await start();
  const ack = await gladys.fake.action(ACTIONS.TEST_CONNECTION, {});
  assert.equal(ack.success, true);
  assert.equal(fake.calls.messages.length, 2);
  assert.deepEqual(Object.keys(ack.data.message).sort(), ['de', 'en', 'es', 'fr']);
  const text = ack.data.message.en;
  assert.match(text, /Chat — Claude Opus 5\.5 answered in/);
  assert.match(text, /Router — Claude Haiku 5\.5 answered in/);
});

test('"Test the connection" names the failing model', async () => {
  const { gladys, fake } = await start();
  fake.queue(claudeResponse(), apiError(404));
  const ack = await gladys.fake.action(ACTIONS.TEST_CONNECTION, {});
  const text = ack.data.message.fr;
  assert.match(text, /Routeur — Claude Haiku 5\.5 n'est pas disponible/);
});
