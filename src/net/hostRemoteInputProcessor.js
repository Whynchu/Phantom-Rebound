// Phase D4.5 — Host-side remote input processor.
//
// Tracks the highest sim-tick for which the host has actually consumed a
// remote (guest) input frame. This is the value shipped as
// `lastProcessedInputSeq[1]` on broadcast snapshots — and per the D4
// rubber-duck (finding #3) it must be a *consumed* tick, NOT a "newest
// received" tick. D6 reconciliation will use this to trim the guest's
// replay buffer; trimming on a not-yet-simulated tick would cause guests
// to drop input frames before the host had a chance to apply them.
//
// Usage:
//
//   const proc = createHostRemoteInputProcessor({
//     remoteRing: coopInputSync.getRemoteRingBuffer(),
//     retainTicks: 60, // keep ~1s of history for D6 reconciliation replay
//   });
//
//   // each fixed-step tick, AFTER update() has run for `simTick`:
//   proc.tick(simTick);
//
//   // when building the host snapshot:
//   lastProcessedInputSeq[1] = proc.getLastProcessedTick();
//
// `tick()` only advances `lastProcessedTick` when a frame for the given
// sim-tick is actually present in the ring buffer. If a frame is missing
// (transport jitter, disconnect, or a tick the guest hadn't reached yet)
// the value is left unchanged — the slot 1 adapter will have produced an
// inactive vector for that tick, and we don't want to falsely ack input
// that never existed.

function createHostRemoteInputProcessor({
  remoteRing = null,
  retainTicks = 60,
  logger = null,
} = {}) {
  if (!remoteRing || typeof remoteRing.hasFrameFor !== 'function') {
    throw new Error('createHostRemoteInputProcessor: remoteRing with hasFrameFor required');
  }
  if (!Number.isFinite(retainTicks) || retainTicks < 0) {
    throw new Error('createHostRemoteInputProcessor: retainTicks must be non-negative finite');
  }
  retainTicks = Math.floor(retainTicks);

  let lastProcessedTick = null;
  let processedCount = 0;
  let missCount = 0;

  function tick(simTick) {
    if (typeof simTick !== 'number' || !Number.isFinite(simTick) || simTick < 0) return false;
    if (!remoteRing.hasFrameFor(simTick)) {
      missCount++;
      return false;
    }
    lastProcessedTick = simTick;
    processedCount++;
    // Trim consumed history. Frames with tick <= (simTick - retainTicks)
    // are no longer needed: slot-1 adapter peeks at `simTick` and D6 only
    // replays the last `retainTicks` ticks worth of state.
    if (typeof remoteRing.consumeUpTo === 'function') {
      const cutoff = simTick - retainTicks;
      if (cutoff >= 0) {
        try { remoteRing.consumeUpTo(cutoff); }
        catch (err) { if (logger) try { logger('hostRemoteInputProcessor: consumeUpTo error', err); } catch (_) {} }
      }
    }
    return true;
  }

  function getLastProcessedTick() { return lastProcessedTick; }
  function reset() { lastProcessedTick = null; processedCount = 0; missCount = 0; }
  function getStats() {
    return {
      lastProcessedTick,
      processedCount,
      missCount,
      pending: (typeof remoteRing.size === 'function') ? remoteRing.size() : -1,
      retainTicks,
    };
  }

  return { tick, getLastProcessedTick, reset, getStats };
}

export { createHostRemoteInputProcessor };
