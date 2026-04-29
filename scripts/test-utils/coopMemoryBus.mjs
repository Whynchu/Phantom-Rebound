// In-memory fake transport for testing the co-op session state machine
// without any network or Supabase dependency. Implements the same
// interface as the real Supabase adapter:
//   transport.subscribe(channelName, { onMessage, onError }) → Channel
//   channel.send(msg) / channel.leave()
//
// Messages sent on a channel are delivered on a microtask to all OTHER
// subscribers of the same channel (sender is not echoed — matches
// Supabase broadcast ack=false, self=false semantics).

function createMemoryBus({ deliveryDelayMs = 0 } = {}) {
  const channels = new Map();
  let nextSubId = 1;

  function subscribe(name, { onMessage, onError }) {
    const id = nextSubId++;
    const sub = { id, onMessage, onError };
    if (!channels.has(name)) channels.set(name, new Set());
    channels.get(name).add(sub);

    return Promise.resolve({
      async send(msg) {
        const subs = channels.get(name);
        if (!subs) return;
        const peers = [...subs].filter((peer) => peer.id !== id);
        const payload = JSON.parse(JSON.stringify(msg));
        const deliver = () => {
          for (const peer of peers) {
            try { peer.onMessage(payload); } catch (err) { peer.onError?.(err); }
          }
        };
        if (deliveryDelayMs > 0) setTimeout(deliver, deliveryDelayMs);
        else queueMicrotask(deliver);
      },
      async leave() {
        channels.get(name)?.delete(sub);
        if (channels.get(name)?.size === 0) channels.delete(name);
      },
    });
  }

  return {
    transport: { subscribe },
    getSubscriberCount(name) { return channels.get(name)?.size || 0; },
    reset() { channels.clear(); },
  };
}

export { createMemoryBus };
