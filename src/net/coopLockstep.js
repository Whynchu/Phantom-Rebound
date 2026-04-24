// Phase C3a-core-3 — Co-op lockstep execution gate.
//
// Two-counter gate that tells the sim when it's safe to advance a tick.
// Local input is sampled ahead (sendTick), but the sim only advances
// (executeTick) once *both* slots' quantized frames for that tick are
// buffered locally. This enforces lockstep determinism across peers
// even when network latency is non-zero.
//
// Why the local ring buffer?
//   Quantization is lossy. If peer A's sim reads its own raw adapter
//   while peer B's sim reads the dequantized-from-wire version, their
//   floats differ and the sim diverges. To fix, peer A reads its own
//   input THROUGH the same quantize→dequantize pipe: sampleFrame
//   returns the quantized frame, lockstep mirrors it into a local
//   ring buffer, and the sim consumes via a remote-style adapter.
//   Both peers now process bit-identical floats for both slots.
//
// Invariants:
//   - executeTick <= sendTick always
//   - executeTick increases monotonically by exactly 1 per consumeTick
//   - sampleLocalThrough(T) is idempotent if sendTick > T
//   - In expectRemote=false (solo/COOP_DEBUG), gate depends only on
//     local availability → byte-identical to non-lockstep flow.

import { createRemoteInputBuffer } from './remoteInputBuffer.js';

function createCoopLockstep({
  localSlotIndex,
  inputSync,
  expectRemote = true,
  logger = null,
} = {}) {
  if (typeof localSlotIndex !== 'number') throw new Error('createCoopLockstep: localSlotIndex required');
  if (!inputSync || typeof inputSync.sampleFrame !== 'function') throw new Error('createCoopLockstep: inputSync required');
  if (typeof inputSync.getRemoteRingBuffer !== 'function') throw new Error('createCoopLockstep: inputSync.getRemoteRingBuffer required');

  const localRing = createRemoteInputBuffer();
  const remoteRing = inputSync.getRemoteRingBuffer();

  let sendTick = 0;
  let executeTick = 0;
  let lastStallReason = null;

  function sampleLocalThrough(tick) {
    if (!Number.isFinite(tick) || tick < 0) return 0;
    let sampled = 0;
    while (sendTick <= tick) {
      const frame = inputSync.sampleFrame(sendTick);
      if (frame) localRing.push(frame);
      sendTick++;
      sampled++;
    }
    return sampled;
  }

  function canExecuteTick(tick) {
    if (tick !== executeTick) {
      // Only the next tick is executable; anything else is a caller bug.
      lastStallReason = 'nonMonotonic';
      return false;
    }
    if (!localRing.hasFrameFor(tick)) {
      lastStallReason = 'localMissing';
      return false;
    }
    if (expectRemote && !remoteRing.hasFrameFor(tick)) {
      lastStallReason = 'remoteMissing';
      return false;
    }
    lastStallReason = null;
    return true;
  }

  function consumeTick(tick) {
    if (tick !== executeTick) {
      throw new Error(`coopLockstep.consumeTick: expected tick ${executeTick}, got ${tick}`);
    }
    localRing.consumeUpTo(tick);
    if (expectRemote) remoteRing.consumeUpTo(tick);
    executeTick++;
  }

  function getLocalRingBuffer() {
    return localRing;
  }

  function getDiagnostics() {
    return {
      sendTick,
      executeTick,
      expectRemote,
      localSlotIndex,
      localSize: localRing.size(),
      remoteSize: remoteRing.size(),
      stallReason: lastStallReason,
      localStats: localRing.stats(),
      remoteStats: remoteRing.stats(),
    };
  }

  function dispose() {
    sendTick = 0;
    executeTick = 0;
    lastStallReason = null;
  }

  return {
    sampleLocalThrough,
    canExecuteTick,
    consumeTick,
    getLocalRingBuffer,
    getDiagnostics,
    dispose,
    get sendTick() { return sendTick; },
    get executeTick() { return executeTick; },
  };
}

export { createCoopLockstep };
