// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code registers or which defaults it applies — these tests
// keep both sides in sync, and catch the store rules that are easy to miss.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG, EFFORTS, MAX_TOKENS_MAX, MAX_TOKENS_MIN, MODELS } from '../src/config.js';
import { ACTIONS } from '../src/app.js';
import { LANGUAGES } from '../src/i18n.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('gladys-assistant-integration.json'));
const pkg = JSON.parse(await read('package.json'));
const appSource = await read('src/app.js');

const field = (key) => manifest.config_schema.find((entry) => entry.key === key);

test('an AI provider, on the assistants shelf, on Gladys 5.3 or later', () => {
  assert.equal(manifest.type, 'ai');
  assert.deepEqual(manifest.categories, ['assistants']);
  // `type: "ai"` and `keywords` are unknown to the cores before 5.3.0.
  assert.equal(manifest.gladys_version, '>=5.3.0');
});

test('Claude is reached in the cloud only', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
});

test('the version is the one of package.json, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/prohand/gladys-ai-claude:${pkg.version}`);
});

test('the name and the description fit what the store allows', () => {
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
  for (const language of LANGUAGES) {
    const { length } = manifest.description[language];
    assert.ok(length >= 10 && length <= 100, `description.${language}: ${length} characters`);
  }
});

test('the search keywords follow the store rules', () => {
  const { keywords } = manifest;
  assert.ok(Array.isArray(keywords) && keywords.length >= 1 && keywords.length <= 10);
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.equal(new Set(normalized).size, keywords.length, 'keywords must be unique');
  for (const keyword of normalized) {
    assert.ok(keyword.length >= 2 && keyword.length <= 30, `keyword "${keyword}"`);
  }
});

test('every manifest action is registered', () => {
  assert.deepEqual(
    manifest.actions.map((action) => action.key),
    Object.values(ACTIONS),
  );
  for (const key of Object.keys(ACTIONS)) {
    assert.match(appSource, new RegExp(`onAction\\(ACTIONS\\.${key}`));
  }
  assert.match(appSource, /onAiChat\(/, 'an AI provider answers onAiChat');
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  for (const entry of manifest.config_schema) {
    if (entry.type === 'section') {
      assert.ok(!(entry.key in DEFAULT_CONFIG), `section "${entry.key}" stores no value`);
      continue;
    }
    assert.ok(entry.key in DEFAULT_CONFIG, `config key "${entry.key}" unknown to the code`);
    if (entry.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[entry.key], entry.default, `default of "${entry.key}"`);
    }
  }
});

test('the API key is a secret field without a default', () => {
  const apiKey = field('api_key');
  assert.equal(apiKey.type, 'secret');
  assert.equal(apiKey.required, true);
  assert.equal(apiKey.default, undefined);
});

test('the model selects offer exactly the models the code knows', () => {
  for (const key of ['model', 'fast_model']) {
    assert.deepEqual(
      field(key)
        .options.map((option) => option.value)
        .sort(),
      Object.keys(MODELS).sort(),
      key,
    );
  }
  assert.deepEqual(
    field('effort').options.map((option) => option.value),
    EFFORTS,
  );
  assert.equal(field('max_tokens').min, MAX_TOKENS_MIN);
  assert.equal(field('max_tokens').max, MAX_TOKENS_MAX);
});

test('every field uses a type the store accepts, placeholders are multi-language', () => {
  const types = ['string', 'number', 'boolean', 'select', 'multi_select', 'secret', 'section'];
  for (const entry of manifest.config_schema) {
    assert.ok(types.includes(entry.type), `field "${entry.key}": type ${entry.type}`);
    assert.match(entry.key, /^[a-z0-9_]+$/);
    if (entry.placeholder !== undefined) {
      assert.equal(typeof entry.placeholder, 'object');
      assert.ok(['string', 'number', 'secret'].includes(entry.type));
    }
    for (const link of entry.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

/** Every multi-language object of the manifest, with where it sits. */
function multiLanguageTexts(node, path = 'manifest') {
  if (Array.isArray(node)) {
    return node.flatMap((child, index) => multiLanguageTexts(child, `${path}[${index}]`));
  }
  if (node === null || typeof node !== 'object') {
    return [];
  }
  const keys = Object.keys(node);
  if (keys.includes('en') && keys.every((key) => /^[a-z]{2}$/.test(key))) {
    return [{ path, text: node }];
  }
  return keys.flatMap((key) => multiLanguageTexts(node[key], `${path}.${key}`));
}

test('every text of the manifest carries en, fr, de and es', () => {
  // Gladys shows the reader's language and falls back to English: a missing
  // language shows up in English in the middle of a translated screen.
  const texts = multiLanguageTexts(manifest);
  assert.ok(texts.length > 20, `only ${texts.length} texts found`);
  for (const { path, text } of texts) {
    assert.deepEqual(Object.keys(text).sort(), [...LANGUAGES].sort(), `${path}: languages`);
    for (const language of LANGUAGES) {
      assert.ok(text[language].trim().length > 0, `${path}.${language} is empty`);
    }
  }
  const intro = field('intro').description;
  for (const language of LANGUAGES) {
    assert.ok(intro[language].length <= 1000, `intro.${language} too long`);
  }
});

test('the user documentation exists in every language, long enough for the store', async () => {
  for (const language of LANGUAGES) {
    const text = await read(`docs/${language}.md`);
    assert.ok(text.length >= 300, `docs/${language}.md: ${text.length} characters`);
  }
});
