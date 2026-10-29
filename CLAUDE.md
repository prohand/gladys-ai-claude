# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** of manifest `type: "ai"` (Node 22+,
ESM, no build step): an AI provider that answers every AI request of a Gladys
instance — the chat tool-calling loop, the intent router, the scene `ai.ask`
action, the weekly digest — with **Claude**, through the Anthropic Messages API.
Requires Gladys 5.3+. Two runtime dependencies:
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
and the official Anthropic SDK `@anthropic-ai/sdk`. Started from the official
[JavaScript template](https://github.com/GladysAssistant/integration-template-js).

The contract: one OpenAI-compatible chat completion in (`onAiChat`), one
OpenAI-compatible completion out. The agentic loop stays in the Gladys core;
this integration is a thin adapter — it runs no tool and renders nothing.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/convert.test.js          # one file
node --test --test-name-pattern "router"  # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store --skip-image-check .   # store checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24; pull requests also run the store checks and build the Docker
image. Run the three commands before pushing.

## Architecture

```
index.js                     SDK bootstrap only: registerHandlers, shutdown, connect
src/app.js                   every handler: onAiChat, the test action, config, status
src/claude/chat.js           the onAiChat handler: request building, call, errors
src/claude/convert.js        OpenAI <-> Messages API translation (pure, no network)
src/claude/thinkingCache.js  assistant turns of the tool rounds in progress (memory)
src/connection.js            connection status + "Test the connection"
src/config.js                DEFAULT_CONFIG (mirrors the manifest) + normalization, models
src/i18n.js                  LANGUAGES (en, fr, de, es), localize / pick
gladys-assistant-integration.json  manifest
docs/{en,fr,de,es}.md        user documentation, re-hosted by Gladys (en + fr mandatory)
test/                        node --test, fake Gladys of the SDK + test/helpers/fakeAnthropic.js
.github/scripts/changelog-release.mjs  rolls CHANGELOG.md at release time
```

### Invariants worth knowing

- **Ack delays of the core**: 120 s for a chat request, **20 s** for
  `purpose: "intent-classification"` (the router). `chat.js` stays under them
  (110 s / 18 s, no retry for the router). At most 4 requests in flight.
- **What the core reads back**: only `choices[0].message` — `content` (string
  ≤ 50,000 characters, or null) and at most **20** `tool_calls` whose
  `arguments` is a JSON **string**. Anything else is dropped; a malformed
  completion fails the whole request. Tests assert
  `validateAiCompletion(completion)` is `[]`.
- **The `model` of the request is stripped by the core** (Gladys Plus
  vocabulary): the model comes from the configuration, `fast_model` for the
  router.
- **Current Claude models refuse** sampling parameters (`temperature`…),
  `thinking: { type: "disabled" }`, assistant prefill and forced tool use
  (`tool_choice` `any`/`tool`): never send them. `required` / a named function
  becomes `auto`. Thinking is adaptive, depth set by `output_config.effort`.
- **Every `tool_use` needs its `tool_result`** in the next user message:
  `convert.js` repairs a history that breaks this instead of failing.
- **Thinking blocks**: Claude gets its own turn back, unchanged, within a tool
  round (`thinkingCache.js`, keyed by the tool call ids). The core may rebuild
  the system prompt between requests, so every request sets
  `thinking.block_binding.prefix_mismatch_behavior: "drop_block"` (beta
  `thinking-binding-controls-2026-08-01`): a stale block is dropped, never a 400. The cache is cleared when the API key changes.
- **Refusals**: `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`)
  lets Anthropic retry on its default fallback model; a final refusal still
  answers with a text, never an empty completion.
- **Throwing acks the request as failed**: Gladys names the provider as
  unavailable — there is no silent fallback to Gladys Plus. Error messages go
  through `describeError` and never carry the API key.
- **Never log the API key**, nor message contents at `info` level. The rootfs
  is read-only: nothing is written outside memory.
- Model ids are the exact Anthropic ids, no date suffix. Config keys, model
  values and the action key are stored by users: never rename them.

## Rules

- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section.
- **Manifest.** Texts are multi-language objects `{ en, fr, de, es }`, never a
  plain string; the catalog `description` holds 10 to 100 characters per
  language. `type: "ai"` and `keywords` need `gladys_version >=5.3.0`.
  `transports` is `["cloud"]`: Claude is only reached through the Anthropic
  API. `test/manifest.test.js` ties the manifest to the code.
- **User-facing text** is in English, French, German and Spanish: action
  messages, connection status, manifest texts, and `docs/*.md`, kept in sync.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network: the Anthropic client is injected
  (`clientFactory`) and faked.
