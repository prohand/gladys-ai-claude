import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, modelName, normalizeConfig } from '../src/config.js';

test('an empty configuration gets the defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('values typed in a form are normalized', () => {
  const config = normalizeConfig({
    api_key: '  sk-ant-abc \n',
    model: 'claude-sonnet-5-5',
    fast_model: 'claude-opus-5-5',
    effort: 'high',
    max_tokens: '8000',
  });
  assert.equal(config.api_key, 'sk-ant-abc');
  assert.equal(config.model, 'claude-sonnet-5-5');
  assert.equal(config.fast_model, 'claude-opus-5-5');
  assert.equal(config.effort, 'high');
  assert.equal(config.max_tokens, 8000);
});

test('unknown models and efforts fall back to the defaults, max_tokens is clamped', () => {
  const config = normalizeConfig({
    api_key: null,
    model: 'gpt-4o',
    fast_model: 'claude-3-haiku',
    effort: 'extreme',
    max_tokens: 999999,
  });
  assert.equal(config.api_key, '');
  assert.equal(config.model, DEFAULT_CONFIG.model);
  assert.equal(config.fast_model, DEFAULT_CONFIG.fast_model);
  assert.equal(config.effort, DEFAULT_CONFIG.effort);
  assert.equal(config.max_tokens, 32000);
  assert.equal(normalizeConfig({ max_tokens: 10 }).max_tokens, 1024);
  assert.equal(normalizeConfig({ max_tokens: 'abc' }).max_tokens, DEFAULT_CONFIG.max_tokens);
});

test('model names are readable', () => {
  assert.equal(modelName('claude-opus-5-5'), 'Claude Opus 5.5');
  assert.equal(modelName('unknown'), 'unknown');
});
