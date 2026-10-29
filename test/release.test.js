import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollChangelog } from '../.github/scripts/changelog-release.mjs';

const CHANGELOG = `# Changelog

Describe each change under \`## [Unreleased]\` as you make it.

## [Unreleased]

### Added

- Something new.

[Unreleased]: https://github.com/prohand/gladys-ai-claude/commits/main
`;

test('the Unreleased section moves under the released version', () => {
  const rolled = rollChangelog(CHANGELOG, '1.0.0', '2026-10-29');
  assert.match(
    rolled,
    /## \[Unreleased\]\n\n## \[1\.0\.0\] - 2026-10-29\n\n### Added\n\n- Something new\./,
  );
  assert.match(
    rolled,
    /\[Unreleased\]: https:\/\/github\.com\/prohand\/gladys-ai-claude\/compare\/v1\.0\.0\.\.\.HEAD/,
  );
  assert.match(
    rolled,
    /\[1\.0\.0\]: https:\/\/github\.com\/prohand\/gladys-ai-claude\/releases\/tag\/v1\.0\.0/,
  );
});

test('a version already in the changelog is not written twice', () => {
  const rolled = rollChangelog(CHANGELOG, '1.0.0', '2026-10-29');
  assert.equal(rollChangelog(rolled, '1.0.0', '2026-10-30'), rolled);
});

test('the changelog of this repository has an Unreleased section to roll', async () => {
  const { readFile } = await import('node:fs/promises');
  const text = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.match(text, /^## \[Unreleased\][ \t]*$/m);
  assert.match(text, /^\[Unreleased\]: https:\/\/github\.com\/prohand\/gladys-ai-claude\//m);
});
