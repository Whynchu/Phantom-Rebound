// Phase C3a-core-2 — Co-op input sync module.
//
// Batches local input frames and emits them over the coop gameplay channel.
// Also provides a remote-input ingestion path that fans out to listeners and
// populates a ring buffer.
//
// Supabase realtime hard cap: 20 events/s. Sim runs at 60 Hz. Default
// batchSize=4 (D12) → ~15 messages/s. Combined with the 15 Hz host snapshot
// broadcaster (D12) that's 15 msg/s on each peer's outbound, well under the
// 20 msg/s budget. Pre-D12 default of batchSize=8 produced ~133 ms input
// latency which made slot 1 feel sluggish on the host's screen; halving to
// 4 brings input lag to ~67 ms.
//
// Quantization note:
//   dx/dy: Math.round(v * 127)  →  int8 range [-127, 127]
//   t    : Math.round(v * 255)  →  uint8 range [0, 255]
//   Round-trip error ≤ 1/127 ≈ 0.79% per axis — acceptable for movement.

import { createRemoteInputBuffer } from './remoteInputBuffer.js';

function createCoopInputSync({
  sendGameplay,
  localAdapter,
  localSlotIndex,
  localPositionProvider = null,
  batchSize = 4,
  logger = null,
} = {}) {
  if (typeof sendGameplay !== 'function') throw new Error('createCoopInputSync: sendGameplay required');
  if (!localAdapter || typeof localAdapter.moveVector !== 'function') throw new Error('createCoopInputSync: localAdapter required');
  if (typeof localSlotIndex !== 'number') throw new Error('createCoopInputSync: localSlotIndex required');

  const pendingBatch = [];
  const remoteListeners = new Set();
  const ringBuffer = createRemoteInputBuffer();

  let sentCount = 0;
  let receivedCount = 0;

  function quantizeFrame(tick, vec) {
    const frame = {
      tick: tick >>> 0,
      dx: Math.max(-127, Math.min(127, Math.round(vec.dx * 127))),
      dy: Math.max(-127, Math.min(127, Math.round(vec.dy * 127))),
      t: Math.max(0, Math.min(255, Math.round(vec.t * 255))),
      still: vec.active ? 0 : 1,
    };
    if (typeof localPositionProvider === 'function') {
      const pos = localPositionProvider();
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        frame.x = Math.round(pos.x * 10) / 10;
        frame.y = Math.round(pos.y * 10) / 10;
      }
    }
    return frame;
  }

  function doFlush(frames) {
    if (frames.length === 0) return;
    const msg = { kind: 'input', slot: localSlotIndex, frames };
    // sendGameplay is async; sync try/catch only handles synchronous throws.
    // Wrap the result in Promise.resolve to also catch async rejections.
    let result;
    try {
      result = sendGameplay(msg);
    } catch (err) {
      logger?.('coopInputSync: sendGameplay sync error', err);
      return;
    }
    Promise.resolve(result)
      .then(() => { sentCount++; })
      .catch((err) => { logger?.('coopInputSync: sendGameplay async error', err); });
  }

  function sampleFrame(tick) {
    const vec = localAdapter.moveVector();
    const frame = quantizeFrame(tick, vec);
    pendingBatch.push(frame);
    if (pendingBatch.length >= batchSize) {
      const batch = pendingBatch.splice(0, pendingBatch.length);
      doFlush(batch);
    }
    return frame;
  }

  function flush() {
    if (pendingBatch.length === 0) return;
    const batch = pendingBatch.splice(0, pendingBatch.length);
    doFlush(batch);
  }

  function onRemoteFrame(fn) {
    if (typeof fn !== 'function') throw new Error('coopInputSync: onRemoteFrame requires a function');
    remoteListeners.add(fn);
    return () => remoteListeners.delete(fn);
  }

  function ingest(payload) {
    if (!payload || typeof payload !== 'object') return;
    if (payload.kind !== 'input') return;
    if (!Array.isArray(payload.frames)) return;
    const slot = payload.slot;
    const frames = payload.frames;

    // Push each frame into the ring buffer
    for (const frame of frames) {
      if (frame && typeof frame.tick === 'number') {
        ringBuffer.push(frame);
        receivedCount++;
      }
    }

    // Fan out to listeners
    for (const fn of remoteListeners) {
      try { fn({ slot, frames }); } catch (err) { logger?.('coopInputSync: onRemoteFrame listener error', err); }
    }
  }

  function getStats() {
    return {
      sent: sentCount,
      received: receivedCount,
      pendingLocal: pendingBatch.length,
      pendingRemote: ringBuffer.size(),
    };
  }

  function getRemoteRingBuffer() {
    return ringBuffer;
  }

  function dispose() {
    pendingBatch.length = 0;
    remoteListeners.clear();
  }

  return { sampleFrame, flush, onRemoteFrame, ingest, getStats, getRemoteRingBuffer, dispose };
}

export { createCoopInputSync };
