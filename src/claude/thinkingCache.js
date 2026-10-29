// -----------------------------------------------------------------------------
// The assistant turns of the tool rounds in progress, as Claude wrote them.
//
// Claude thinks before it calls a tool, and it should get that reasoning back
// when the tool results come in: the next request of the round carries the
// assistant turn again, and the Messages API wants its `thinking` blocks
// unchanged (their signature binds them to the conversation). The Gladys core
// cannot carry them: it keeps OpenAI messages, and reads only `content` and
// `tool_calls` from a completion.
//
// So the integration remembers each assistant turn that ended on tool calls,
// keyed by the ids of those calls — ids Claude generated, which come back in
// the next request — and replays the original blocks when it sees them again.
// A miss (a restart, an old conversation) only costs that reasoning: the turn
// is rebuilt from the OpenAI message, without thinking, which the API accepts.
//
// In memory only: the rootfs is read-only, and a tool round lasts seconds.
// -----------------------------------------------------------------------------

/** How long a turn is kept: a tool round never takes that long. */
export const TTL_MS = 30 * 60 * 1000;

/** At most this many turns: the core runs at most 4 requests at a time. */
export const MAX_ENTRIES = 200;

export function createThinkingCache({ now = Date.now, ttl = TTL_MS, max = MAX_ENTRIES } = {}) {
  /** key (sorted tool use ids) -> { content, expires } */
  const entries = new Map();

  const keyOf = (ids) => [...ids].sort().join(',');

  function prune() {
    const time = now();
    for (const [key, entry] of entries) {
      if (entry.expires <= time) {
        entries.delete(key);
      }
    }
    // Oldest first: a Map iterates in insertion order.
    while (entries.size > max) {
      entries.delete(entries.keys().next().value);
    }
  }

  return {
    /**
     * Remember an assistant turn when it ends on tool calls and carries
     * thinking worth replaying.
     * @param {Array<object>} content the `content` of a Messages API response
     */
    remember(content) {
      if (!Array.isArray(content)) {
        return;
      }
      const ids = content.filter((block) => block.type === 'tool_use').map((block) => block.id);
      const thinks = content.some(
        (block) => block.type === 'thinking' || block.type === 'redacted_thinking',
      );
      if (ids.length === 0 || !thinks) {
        return;
      }
      entries.set(keyOf(ids), { content, expires: now() + ttl });
      prune();
    },

    /**
     * The original turn whose tool calls carry exactly these ids.
     * @param {string[]} ids
     * @returns {Array<object>|undefined}
     */
    replay(ids) {
      prune();
      return entries.get(keyOf(ids))?.content;
    },

    get size() {
      return entries.size;
    },

    clear() {
      entries.clear();
    },
  };
}
