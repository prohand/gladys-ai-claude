# Claude AI

This integration makes **Claude**, the AI of Anthropic, the brain of the Gladys
assistant. Once selected, it answers every AI request of your Gladys: the chat
(and the devices it controls for you), the routing of your messages, the
**Ask the AI** scene action and the weekly digest.

It is a community integration: it is not made nor supported by Anthropic.

## Before you start

- **Gladys 5.3 or later.**
- **An Anthropic API key.** Create an account on
  [console.anthropic.com](https://console.anthropic.com), add credit or a
  payment method, then create a key under **Settings → API keys**. It starts
  with `sk-ant-`.
- Usage is **billed by Anthropic**, per token, at the price of the model you
  choose. Gladys Plus is not needed.

Claude runs in the cloud (`api.anthropic.com`): Gladys needs internet access.

## Configuration

1. Install the integration from the catalog, then open its **Configuration**
   tab.
2. Paste your **Anthropic API key** and save.
3. Click **Test the connection**: each model answers a one-word question and
   the time it took is shown under the button.
4. Go to **Settings → Artificial Intelligence** and select **Claude AI** as the
   AI provider.

The status at the top of the Configuration screen turns green when the key is
accepted and the chosen models are open to it. When it is red, it says why.

## The settings

| Setting                        | What it does                                                                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic API key              | Your key. It stays in Gladys, is never shown again and never written to the logs.                                                                                                  |
| Chat model                     | Answers the chat, creates the scenes, writes the weekly digest. **Claude Opus 5.5** by default. Sonnet 5.5 is faster and cheaper, Fable 5.1 the strongest and the most expensive.  |
| Router model                   | Sorts each message before the answer. Gladys waits **20 seconds** at most for it: keep a fast model, **Claude Haiku 5.5** by default.                                              |
| Reasoning effort               | How much the chat model thinks before it answers: low, medium (default), high, very high. More effort helps on hard requests (creating a scene) but answers slower and costs more. |
| Maximum answer length (tokens) | The output budget of one answer, reasoning included. 16,000 by default. Raise it if the logs say an answer hit `max_tokens`.                                                       |

## What Claude sees

Choosing an AI provider is a privacy decision. The provider receives:

- every chat message and the conversation history;
- the description of the tools Gladys offers it, and their results — the
  state of the devices it reads;
- the images you send in the chat.

Its answers drive the control of your devices and the creation of your
scenes. Read the [Anthropic privacy policy](https://www.anthropic.com/legal/privacy)
before you choose it.

## Costs and speed

- The system prompt and the tool list come back on every message: the
  integration asks Anthropic to **cache** them, which bills them at a fraction
  of the price after the first message.
- The router always runs at low effort on the router model: it is the request
  sent the most often.
- To spend less, pick **Claude Sonnet 5.5** for the chat or lower the effort.
- When Claude declines a request for safety reasons, Anthropic retries it on
  its default fallback model inside the same call; if every model declines,
  the assistant says it cannot help.

## Troubleshooting

- **"Anthropic refused the API key"** — the key is wrong, revoked or belongs
  to an organization without credit. Create a new one and paste it again.
- **"… is not available to this API key"** — your Anthropic organization has
  no access to that model: choose another one.
- **"Rate limit reached"** — too many requests for your Anthropic usage tier:
  wait a moment, or raise your tier in the Anthropic console.
- **"Cannot reach api.anthropic.com"** — Gladys has no internet access, or a
  firewall blocks that address.
- **The assistant says the AI provider is unavailable** — open the **Logs**
  tab of the integration: every request writes one line (model, time, tokens)
  and every failure its reason.
