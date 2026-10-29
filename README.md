# Claude AI — Gladys Assistant integration

External integration that makes **Claude**, the AI of Anthropic, the AI
provider of [Gladys Assistant](https://gladysassistant.com): once an
administrator selects it, the chat (and the devices it controls), the intent
router, the scene `ai.ask` action and the weekly digest are answered by Claude
through the Anthropic API, with your own API key.

Built on the official
[JavaScript integration template](https://github.com/GladysAssistant/integration-template-js),
the SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
and the official Anthropic SDK
[`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript).
Requires **Gladys 5.3.0 or later**. Community integration, not affiliated with
Anthropic.

User documentation: [English](./docs/en.md) · [Français](./docs/fr.md) ·
[Deutsch](./docs/de.md) · [Español](./docs/es.md).

## How it works

| Gladys asks                             | Claude model (default)   | Effort          | Answered within |
| --------------------------------------- | ------------------------ | --------------- | --------------- |
| Chat, scene `ai.ask`, weekly digest     | Chat model (Opus 5.5)    | from the config | 110 s           |
| Intent router (`intent-classification`) | Router model (Haiku 5.5) | low             | 18 s            |

The core relays one OpenAI-compatible chat completion; the integration
translates it to the Messages API (`src/claude/convert.js`), calls Claude, and
translates the answer back: text, and tool calls the core then runs. It also:

- gives Claude its own reasoning (thinking blocks) back between the tool calls
  of a round, from memory (`src/claude/thinkingCache.js`);
- caches the system prompt and the tool schemas (prompt caching);
- opts into Anthropic's default server-side fallback when a model declines;
- reports the connection status (API key and models checked) and offers a
  **Test the connection** action.

Manifest: `type: "ai"`, category `assistants`, transport `cloud`.

## Project structure

```
.
├─ index.js                          # SDK bootstrap (no logic)
├─ src/
│  ├─ app.js                         # handlers: onAiChat, action, config, status
│  ├─ claude/
│  │  ├─ chat.js                     # the AI provider handler
│  │  ├─ convert.js                  # OpenAI <-> Anthropic Messages API
│  │  └─ thinkingCache.js            # tool rounds in progress (memory only)
│  ├─ connection.js                  # status + "Test the connection"
│  ├─ config.js                      # defaults, models, normalization
│  └─ i18n.js                        # en, fr, de, es
├─ docs/                             # user documentation (en, fr, de, es)
├─ test/                             # node --test, no network
├─ gladys-assistant-integration.json # manifest
├─ Dockerfile                        # Node 24 Alpine, read-only rootfs ready
├─ CHANGELOG.md                      # Keep a Changelog, rolled by the Release workflow
├─ CLAUDE.md                         # project rules for coding assistants & contributors
├─ SECURITY.md                       # how to report a vulnerability privately
├─ .github/workflows/ci.yml          # format, lint, tests (Node 22 + 24), store checks, Docker build
├─ .github/workflows/release.yml     # UI-driven release: bump + changelog + tag + build
├─ .github/workflows/build.yml       # multi-arch build (git tag or called by release)
├─ .github/workflows/github-release.yml # GitHub Release of every version tag
├─ .github/scripts/changelog-release.mjs # rolls the changelog at release time
├─ .github/dependabot.yml            # npm weekly, Actions and Docker monthly
└─ cover.png                         # catalog cover, 800×534 px
```

## Run it locally

```bash
npm install
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="gladys-ai-claude" \
LOG_LEVEL=debug \
npm start
```

The three `GLADYS_*` variables are injected by the Gladys supervisor when the
integration runs in its container. The API key comes from the Gladys
configuration, never from the environment.

## Quality checks

```bash
npm run format:check   # Prettier
npm run lint           # ESLint
npm test               # node --test — the Anthropic client is faked, no network
npx github:GladysAssistant/integration-store --skip-image-check .   # store rules
```

The CI runs them on every push to `main` and every pull request, on Node 22
and 24, and pull requests also build the Docker image.

## Publish

1. Add the GitHub topic `gladys-assistant-integration` to the repository, and
   turn on **Private vulnerability reporting** (see [`SECURITY.md`](SECURITY.md)).
2. Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md).
3. **Actions → Release → Run workflow**, pick `patch`, `minor` or `major`
   (`major` for the first release: 0.1.0 → 1.0.0). The workflow bumps the
   version everywhere, rolls the changelog, tags `vX.Y.Z`, builds the
   `linux/amd64` + `linux/arm64` image to `ghcr.io/prohand/gladys-ai-claude`,
   publishes the GitHub Release and runs the store checks with the image.
4. Make the ghcr.io package **public** after the first build, so Gladys can
   pull it.
5. The store indexer picks up the new manifest version; Gladys offers the
   install / update.

## License

Apache-2.0
