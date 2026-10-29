// -----------------------------------------------------------------------------
// OpenAI chat completion <-> Anthropic Messages API.
//
// The Gladys core speaks OpenAI: it relays one chat completion request
// (`messages`, `tools`, `tool_choice`, `max_tokens`) and reads one completion
// back (`choices[0].message`: `content` and `tool_calls`). Claude speaks the
// Messages API. This module is the translation, both ways, and nothing else:
// no network, no state — the thinking replay lives in thinkingCache.js.
//
// The differences that matter:
//   - system messages are a top-level `system` field, not messages;
//   - a tool call is a `tool_use` block of the assistant message, and its
//     result a `tool_result` block of the NEXT user message — every tool_use
//     needs its result there, or the API answers 400;
//   - the conversation starts with a user message and never ends with an
//     assistant one (no prefill on the current models);
//   - images are `image` blocks (base64 or URL), not `image_url` parts;
//   - the model's arguments are an object (`input`), not a JSON string.
// -----------------------------------------------------------------------------

/** The image types the Messages API accepts. */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** What the Gladys core accepts in one completion (see the SDK contract). */
export const MAX_TOOL_CALLS = 20;

/** Tool use ids the Messages API accepts. */
const TOOL_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Translate the messages of an OpenAI request into Messages API messages.
 *
 * @param {Array<object>} openAiMessages the `messages` of the relayed request
 * @param {object} [options]
 * @param {(toolCallIds: string[]) => Array<object>|undefined} [options.replay] returns the
 *   original Claude content of an assistant turn whose tool calls carry these ids, so its
 *   thinking blocks go back to the model unchanged
 * @returns {{ system: string|undefined, messages: Array<object> }}
 */
export function toClaudeMessages(openAiMessages = [], { replay } = {}) {
  const systemParts = [];
  const messages = [];

  for (const message of openAiMessages) {
    switch (message?.role) {
      case 'system':
      case 'developer': {
        const text = textOf(message.content);
        if (text) {
          systemParts.push(text);
        }
        break;
      }
      case 'user': {
        push(messages, 'user', userBlocks(message.content));
        break;
      }
      case 'assistant': {
        push(messages, 'assistant', assistantBlocks(message, replay));
        break;
      }
      case 'tool': {
        push(messages, 'user', [toolResultBlock(message)]);
        break;
      }
      default:
        // An unknown role (`function`, the pre-tools OpenAI format): its text
        // still reaches the model, as the user's.
        push(messages, 'user', userBlocks(message?.content));
    }
  }

  pairToolResults(messages);

  // The Messages API wants a user message first, and refuses an assistant
  // message last (a prefill) on the current models.
  if (messages.length === 0 || messages[0].role !== 'user') {
    messages.unshift({ role: 'user', content: [{ type: 'text', text: '(conversation start)' }] });
  }
  if (messages.at(-1).role === 'assistant') {
    messages.push({ role: 'user', content: [{ type: 'text', text: 'Continue.' }] });
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages,
  };
}

/**
 * Translate OpenAI tool definitions into Messages API tools.
 * @param {Array<object>|undefined} tools
 */
export function toClaudeTools(tools) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return undefined;
  }
  return tools
    .filter((tool) => tool?.type === 'function' && tool.function?.name)
    .map(({ function: fn }) => ({
      name: fn.name,
      ...(fn.description ? { description: fn.description } : {}),
      input_schema: isObject(fn.parameters) ? fn.parameters : { type: 'object', properties: {} },
    }));
}

/**
 * Translate an OpenAI `tool_choice`. Forcing a tool (`required`, or a named
 * function) is refused with a 400 by Claude Opus 5.5, Fable 5.1 and Sonnet
 * 5.5: it becomes `auto`, and the model still sees the tools.
 * @param {string|object|undefined} toolChoice
 */
export function toClaudeToolChoice(toolChoice) {
  if (toolChoice === 'none') {
    return { type: 'none' };
  }
  return toolChoice === undefined ? undefined : { type: 'auto' };
}

/**
 * Translate a Messages API response into the OpenAI completion the Gladys core
 * reads: `choices[0].message` with `content` (a string, or null next to tool
 * calls) and at most 20 `tool_calls`.
 *
 * @param {object} response the Messages API response
 * @returns {object} an OpenAI-compatible chat completion
 */
export function toOpenAiCompletion(response) {
  const blocks = Array.isArray(response?.content) ? response.content : [];
  const text = blocks
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  // A response cut by max_tokens may end on a tool call whose input is
  // incomplete: never hand Gladys a half-written device command.
  const truncated = response?.stop_reason === 'max_tokens';
  const toolCalls = truncated
    ? []
    : blocks
        .filter((block) => block.type === 'tool_use')
        .slice(0, MAX_TOOL_CALLS)
        .map((block) => ({
          id: block.id,
          type: 'function',
          function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
        }));

  const message = { role: 'assistant', content: text };
  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
    message.content = text || null;
  }

  const usage = response?.usage ?? {};
  const promptTokens =
    (usage.input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0);
  const completionTokens = usage.output_tokens ?? 0;

  return {
    id: response?.id,
    object: 'chat.completion',
    model: response?.model,
    choices: [{ index: 0, message, finish_reason: finishReason(response?.stop_reason, toolCalls) }],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

/** The tool use ids of an OpenAI assistant message, made valid for the Messages API. */
export function toolCallIds(message) {
  return (Array.isArray(message?.tool_calls) ? message.tool_calls : []).map((call) =>
    toolId(call?.id),
  );
}

// --- Messages ----------------------------------------------------------------

function userBlocks(content) {
  if (typeof content === 'string') {
    return content ? [{ type: 'text', text: content }] : [];
  }
  if (!Array.isArray(content)) {
    return [];
  }
  return content.flatMap((part) => {
    if (part?.type === 'text' && part.text) {
      return [{ type: 'text', text: part.text }];
    }
    if (part?.type === 'image_url') {
      const image = imageBlock(part.image_url?.url ?? part.image_url);
      return image ? [image] : [];
    }
    return [];
  });
}

function assistantBlocks(message, replay) {
  const ids = toolCallIds(message);
  if (ids.length > 0 && replay) {
    // The tool round this message opened is still going on: send Claude its
    // own turn back as it wrote it, thinking blocks included, so it keeps its
    // reasoning between the tool calls.
    const original = replay(ids);
    if (original) {
      return original;
    }
  }
  const blocks = [];
  const text = textOf(message.content);
  if (text) {
    blocks.push({ type: 'text', text });
  }
  for (const [index, call] of (message.tool_calls ?? []).entries()) {
    if (call?.type !== undefined && call.type !== 'function') {
      continue;
    }
    blocks.push({
      type: 'tool_use',
      id: ids[index],
      name: call.function?.name,
      input: parseArguments(call.function?.arguments),
    });
  }
  return blocks;
}

function toolResultBlock(message) {
  const text = textOf(message.content);
  return {
    type: 'tool_result',
    tool_use_id: toolId(message.tool_call_id),
    ...(text ? { content: text } : {}),
  };
}

/** Append blocks as a message, merged into the previous one when it has the same role. */
function push(messages, role, blocks) {
  if (blocks.length === 0) {
    return;
  }
  const last = messages.at(-1);
  if (last?.role === role) {
    last.content.push(...blocks);
  } else {
    messages.push({ role, content: [...blocks] });
  }
}

/**
 * Every tool_use needs its tool_result in the very next user message, and a
 * tool_result must answer a tool_use of the message just before: the API
 * refuses the whole request otherwise. A history cut by Gladys (or a tool
 * that never answered) is repaired rather than failing the conversation.
 */
function pairToolResults(messages) {
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== 'user') {
      continue;
    }
    const previous = messages[index - 1];
    const expected = new Set(
      previous?.role === 'assistant'
        ? previous.content.filter((block) => block.type === 'tool_use').map((block) => block.id)
        : [],
    );
    const results = [];
    const others = [];
    const answered = new Set();
    for (const block of message.content) {
      if (block.type !== 'tool_result') {
        others.push(block);
      } else if (expected.has(block.tool_use_id) && !answered.has(block.tool_use_id)) {
        answered.add(block.tool_use_id);
        results.push(block);
      } else if (textOf(block.content)) {
        // An orphan result: keep what it says, as text.
        others.push({ type: 'text', text: textOf(block.content) });
      }
    }
    for (const id of expected) {
      if (!answered.has(id)) {
        results.push({
          type: 'tool_result',
          tool_use_id: id,
          content: 'No result.',
          is_error: true,
        });
      }
    }
    // The tool results come first in the user message, then anything else.
    message.content = [...results, ...others];
    if (message.content.length === 0) {
      message.content = [{ type: 'text', text: '(empty)' }];
    }
  }
  // An assistant tool call at the very end has no user message after it yet.
  const last = messages.at(-1);
  if (last?.role === 'assistant') {
    const pending = last.content.filter((block) => block.type === 'tool_use');
    if (pending.length > 0) {
      messages.push({
        role: 'user',
        content: pending.map((block) => ({
          type: 'tool_result',
          tool_use_id: block.id,
          content: 'No result.',
          is_error: true,
        })),
      });
    }
  }
}

// --- Helpers -----------------------------------------------------------------

function imageBlock(url) {
  if (typeof url !== 'string') {
    return null;
  }
  const data = /^data:([^;,]+);base64,(.+)$/s.exec(url);
  if (data) {
    const mediaType = data[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : data[1].toLowerCase();
    if (!IMAGE_TYPES.includes(mediaType)) {
      return null;
    }
    return { type: 'image', source: { type: 'base64', media_type: mediaType, data: data[2] } };
  }
  if (/^https?:\/\//.test(url)) {
    return { type: 'image', source: { type: 'url', url } };
  }
  return null;
}

/** The text of an OpenAI content: a string, or the text parts of an array. */
function textOf(content) {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.type === 'text' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function parseArguments(args) {
  if (isObject(args)) {
    return args;
  }
  try {
    const parsed = JSON.parse(args || '{}');
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toolId(id) {
  const value = String(id ?? '');
  if (TOOL_ID_PATTERN.test(value)) {
    return value;
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, '_') || 'tool_call';
}

function finishReason(stopReason, toolCalls) {
  if (toolCalls.length > 0) {
    return 'tool_calls';
  }
  switch (stopReason) {
    case 'max_tokens':
      return 'length';
    case 'refusal':
      return 'content_filter';
    default:
      return 'stop';
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
