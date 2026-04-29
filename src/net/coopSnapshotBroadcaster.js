// Phase D4 — Host-side snapshot broadcaster.
//
// Per rubber-duck on the D4 plan:
//   - Cadence is sim-tick-based, NOT wall-time. Sim runs at fixed 60 Hz; we
//     emit every N ticks. This makes the broadcaster's behavior independent
//     of frame jitter, tab-throttle, GC pauses, and rAF resume bursts.
//   - sendGameplay is async. We use Promise.resolve(result).then().catch()
//     so unhandled rejections cannot leak.
//   - Each broadcaster instance is bound to a runId (epoch). When the host
//     starts a new run, a fresh runId is generated and the previous
//     broadcaster is disposed; any in-flight async send from the old
//     instance is harmless because guests reset their snapshot tracking
//     when runId changes.
//
// Wiring:
//
//   const seq = createSnapshotSequencer();
//   const bc = createSnapshotBroadcaster({
//     sendGameplay: (msg) => session.sendGameplay(msg),
//     sequencer: seq,
//     runId: 'run-abc123',
//     ticksPerSnapshot: 6,        // 60 Hz sim / 6 = 10 Hz snapshots
//     getState: () => ({ slots, bullets, enemies, room, score, ...
//                         lastProcessedInputSeq: { 0: simTick, 1: null } }),
//   });
//   // each fixed-step tick:
//   bc.tick(simTick);
//
//   // on run end / gameover:
//   bc.dispose();
//
// getState() should return a *fresh* loose object on each call. The
// broadcaster injects runId / snapshotSeq / snapshotSimTick onto the
// returned object before passing it to encodeSnapshot. Treat the returned
// object as throw-away.

import { encodeSnapshot } from './coopSnapshot.js';

function nowMs() {
  if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function createSnapshotBroadcaster({
  sendGameplay,
  sequencer,
  runId,
  ticksPerSnapshot = 6,
  getState,
  logger = null,
} = {}) {
  if (typeof sendGameplay !== 'function') throw new Error('createSnapshotBroadcaster: sendGameplay required');
  if (!sequencer || typeof sequencer.next !== 'function') throw new Error('createSnapshotBroadcaster: sequencer required');
  if (typeof runId !== 'string' || runId.length === 0) throw new Error('createSnapshotBroadcaster: runId required (non-empty string)');
  if (typeof getState !== 'function') throw new Error('createSnapshotBroadcaster: getState required');
  if (!Number.isFinite(ticksPerSnapshot) || ticksPerSnapshot < 1) {
    throw new Error('createSnapshotBroadcaster: ticksPerSnapshot must be finite >= 1, got ' + ticksPerSnapshot);
  }
  ticksPerSnapshot = Math.floor(ticksPerSnapshot);

  let disposed = false;
  // First call to tick() will emit immediately if simTick >= ticksPerSnapshot.
  // Use null to signal "never sent yet" so a tick=0 baseline isn't ambiguous.
  let lastSentTick = null;
  const stats = {
    sent: 0,
    failed: 0,
    skipped: 0,
    lastBytes: 0,
    lastEncodeMs: 0,
    lastSimTick: -1,
    lastSeq: -1,
  };

  function shouldEmit(simTick) {
    if (lastSentTick === null) return true;
    return (simTick - lastSentTick) >= ticksPerSnapshot;
  }

  function tick(simTick) {
    if (disposed) return false;
    if (typeof simTick !== 'number' || !Number.isFinite(simTick)) {
      stats.skipped++;
      return false;
    }
    if (!shouldEmit(simTick)) {
      stats.skipped++;
      return false;
    }
    lastSentTick = simTick;

    const t0 = nowMs();
    let snapshot;
    try {
      const raw = getState();
      if (!raw || typeof raw !== 'object') {
        stats.failed++;
        if (logger) try { logger('coopSnapshotBroadcaster: getState returned non-object'); } catch (_) {}
        return false;
      }
      raw.runId = runId;
      raw.snapshotSeq = sequencer.next();
      raw.snapshotSimTick = simTick;
      snapshot = encodeSnapshot(raw);
    } catch (err) {
      stats.failed++;
      if (logger) try { logger('coopSnapshotBroadcaster: encode error', err); } catch (_) {}
      return false;
    }
    stats.lastEncodeMs = nowMs() - t0;
    stats.lastSimTick = simTick;
    stats.lastSeq = snapshot.snapshotSeq;
    try { stats.lastBytes = JSON.stringify(snapshot).length; } catch (_) { stats.lastBytes = 0; }

    // sendGameplay is async; treat the result as a thenable.
    let result;
    try {
      result = sendGameplay(snapshot);
    } catch (err) {
      stats.failed++;
      if (logger) try { logger('coopSnapshotBroadcaster: sync send error', err); } catch (_) {}
      return false;
    }
    Promise.resolve(result)
      .then(() => { if (!disposed) stats.sent++; })
      .catch((err) => {
        if (!disposed) {
          stats.failed++;
          if (logger) try { logger('coopSnapshotBroadcaster: async send error', err); } catch (_) {}
        }
      });
    return true;
  }

  function dispose() { disposed = true; }
  function isDisposed() { return disposed; }
  function getRunId() { return runId; }
  function getStats() { return Object.assign({}, stats, { disposed, ticksPerSnapshot, runId }); }

  return { tick, dispose, isDisposed, getRunId, getStats };
}

export { createSnapshotBroadcaster };
