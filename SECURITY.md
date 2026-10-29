# Security policy

## Supported versions

Only the latest release of the Claude AI integration receives security fixes.
Update the integration from the Gladys store before reporting an issue.

| Version        | Supported |
| -------------- | --------- |
| latest release | Yes       |
| older releases | No        |

## Reporting a vulnerability

Please do **not** open a public issue, pull request or forum post for a
security problem.

Report it privately through GitHub: open the **Security** tab of
[prohand/gladys-ai-claude](https://github.com/prohand/gladys-ai-claude/security),
then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove API keys, tokens and addresses first).

You should get a first answer within 7 days. A fix is released as a new version
of the integration, and the advisory is published once users can update.

## Scope

In scope: the code of this repository and the Docker image it publishes —
in particular anything that could leak the Anthropic API key, or let a
message, a tool result or a model answer do more than the Gladys core allows.

Out of scope: Gladys Assistant itself (report to
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys/security)),
the Anthropic API and the Claude models (report to
[Anthropic](https://www.anthropic.com/responsible-disclosure-policy)), and the
answers a model gives, which are not a vulnerability of this code.

## How this integration handles your data

- The Anthropic API key is a `secret` field: Gladys never sends it back to the
  browser, and the integration never writes it to the logs nor to disk.
- Requests go to `api.anthropic.com` over HTTPS only. Nothing else is called.
- Nothing is stored on disk. The only state is in memory: the assistant turns
  of the tool rounds in progress (kept at most 30 minutes, cleared when the
  API key changes), so Claude gets its own reasoning back.
- The provider sees every chat message, the history, the tool results (device
  states) and the chat images, and its answers drive the assistant with the
  user's authority. Choose it knowingly.

## Good practices for users

- Create an API key dedicated to Gladys, and revoke it from the Anthropic
  console if you uninstall the integration or suspect a leak.
- Set a spending limit on your Anthropic organization.
- Keep Gladys and the integration up to date.
