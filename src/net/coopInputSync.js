// Phase C3a-core-2 — Co-op input sync module.
//
// Batches local input frames and emits them over the coop gameplay channel.
// Also provides a remote-input ingestion path that fans out to listeners and
// populates a ring buffer.
//
// Supabase realtime hard cap: 20 events/s. Sim runs at 60 Hz. Default
// batchSize=4 → ~15 messages/s, well within the cap.
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
    return {
      tick: tick >>> 0,
      dx: Math.max(-127, Math.min(127, Math.round(vec.dx * 127))),
      dy: Math.max(-127, Math.min(127, Math.round(vec.dy * 127))),
      t: Math.max(0, Math.min(255, Math.round(vec.t * 255))),
      still: vec.active ? 0 : 1,
    };
  }

  function doFlush(frames) {
    if (frames.length === 0) return;
    const msg = { kind: 'input', slot: localSlotIndex, frames };
    try {
      sendGameplay(msg);
      sentCount++;
    } catch (err) {
      logger?.('coopInputSync: sendGameplay error', err);
    }
  }

  function sampleFrame(tick) {
    const vec = localAdapter.moveVector();
    const frame = quantizeFrame(tick, vec);
    pendingBatch.push(frame);
    if (pendingBatch.length >= batchSize) {
      const batch = pendingBatch.splice(0, pendingBatch.length);
      doFlush(batch);
    }
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
