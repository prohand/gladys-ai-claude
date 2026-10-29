# Changelog

All notable changes to this integration are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/), bumped by the Release workflow.

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [0.1.1] - 2026-10-29

### Added

- Claude AI provider (manifest `type: "ai"`, Gladys 5.3.0 or later): the chat
  and its tool calls, the intent router, the scene `ai.ask` action and the
  weekly digest are answered by Claude through the Anthropic API.
- Configuration: Anthropic API key, chat model (Claude Opus 5.5 by default),
  router model (Claude Haiku 5.5 by default), reasoning effort and maximum
  answer length.
- **Test the connection** action: one real answer from each model, with its
  time.
- Connection status: the API key and the models are checked at startup and on
  every configuration change, with the reason when something is wrong.
- Claude gets its own reasoning back between tool calls, prompt caching on the
  system prompt and the tools, and Anthropic's default fallback when a model
  declines a request.
- User documentation in English, French, German and Spanish.
- CI (Prettier, ESLint, tests on Node 22 and 24, store checks, Docker build),
  Release workflow, multi-arch image build, GitHub Releases, Dependabot.
- `SECURITY.md`, `CLAUDE.md`.

[Unreleased]: https://github.com/prohand/gladys-ai-claude/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/prohand/gladys-ai-claude/releases/tag/v0.1.1
