// C3a-core-3 contract tests for src/net/coopLockstep.js.

import { createCoopLockstep } from '../src/net/coopLockstep.js';
import { createCoopInputSync } from '../src/net/coopInputSync.js';

let pass = 0, fail = 0;
function assert(name, cond, detail = '') {
  if (cond) { console.log(`PASS ${name}`); pass++; }
  else { console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}

// Fake input adapter returning configurable state.
function createFakeAdapter(state = { dx: 0, dy: 0, t: 0, active: false }) {
  return {
    moveVector() { return { ...state }; },
    isStill() { return !state.active; },
    _set(next) { Object.assign(state, next); },
  };
}

// Helper: build a lockstep with input sync wired to a fake sendGameplay.
function makePair({ slot = 0, expectRemote = true, batchSize = 4 } = {}) {
  const sent = [];
  const adapter = createFakeAdapter();
  const inputSync = createCoopInputSync({
    sendGameplay: (msg) => { sent.push(msg); },
    localAdapter: adapter,
    localSlotIndex: slot,
    batchSize,
  });
  const lockstep = createCoopLockstep({
    localSlotIndex: slot,
    inputSync,
    expectRemote,
  });
  return { lockstep, inputSync, adapter, sent };
}

// ── Construction & validation ────────────────────────────────────────────────
{
  let threw = false;
  try { createCoopLockstep({ inputSync: {} }); } catch { threw = true; }
  assert('missing localSlotIndex throws', threw);
}
{
  let threw = false;
  try { createCoopLockstep({ localSlotIndex: 0 }); } catch { threw = true; }
  assert('missing inputSync throws', threw);
}
{
  let threw = false;
  try { createCoopLockstep({ localSlotIndex: 0, inputSync: { sampleFrame: () => {} } }); } catch { threw = true; }
  assert('inputSync without getRemoteRingBuffer throws', threw);
}

// ── sampleLocalThrough ──────────────────────────────────────────────────────
{
  const { lockstep } = makePair();
  assert('initial sendTick=0', lockstep.sendTick === 0);
  assert('initial executeTick=0', lockstep.executeTick === 0);

  const sampled = lockstep.sampleLocalThrough(0);
  assert('sampleLocalThrough(0) samples 1 frame', sampled === 1);
  assert('sendTick=1 after sampling tick 0', lockstep.sendTick === 1);
}

{
  const { lockstep } = makePair();
  const sampled = lockstep.sampleLocalThrough(3);
  assert('sampleLocalThrough(3) samples 4 frames (0..3)', sampled === 4);
  assert('sendTick=4 after sampling through 3', lockstep.sendTick === 4);
}

{
  const { lockstep } = makePair();
  lockstep.sampleLocalThrough(5);
  const sampled2 = lockstep.sampleLocalThrough(3); // already past
  assert('idempotent: re-sampling old tick is no-op', sampled2 === 0);
  assert('sendTick unchanged by stale sampleLocalThrough', lockstep.sendTick === 6);
}

{
  const { lockstep } = makePair();
  assert('negative tick rejected', lockstep.sampleLocalThrough(-1) === 0);
  assert('NaN tick rejected', lockstep.sampleLocalThrough(NaN) === 0);
}

// ── canExecuteTick gating ───────────────────────────────────────────────────
{
  const { lockstep } = makePair({ expectRemote: true });
  assert('online: canExecuteTick(0) false with no samples', lockstep.canExecuteTick(0) === false);
  const diag1 = lockstep.getDiagnostics();
  assert('stallReason=localMissing initially', diag1.stallReason === 'localMissing');

  lockstep.sampleLocalThrough(0);
  assert('online: canExecuteTick(0) still false without remote', lockstep.canExecuteTick(0) === false);
  assert('stallReason=remoteMissing after local sample', lockstep.getDiagnostics().stallReason === 'remoteMissing');

  // Remote peer pushes frame 0 into the ring buffer via ingest.
  lockstep.getLocalRingBuffer(); // warm
  const remoteFrame = { tick: 0, dx: 0, dy: 0, t: 0, still: 1 };
  const { inputSync } = makePair.call(null, { slot: 0, expectRemote: true }); // throwaway to get to ringBuffer pattern
  // Actually: ingest on OUR inputSync:
}

// Re-do with direct ingest:
{
  const { lockstep, inputSync } = makePair({ expectRemote: true });
  lockstep.sampleLocalThrough(0);
  inputSync.ingest({ kind: 'input', slot: 1, frames: [{ tick: 0, dx: 0, dy: 0, t: 0, still: 1 }] });
  assert('online: canExecuteTick(0) true after both local+remote', lockstep.canExecuteTick(0) === true);
  assert('stallReason=null when can execute', lockstep.getDiagnostics().stallReason === null);
}

// ── Non-monotonic guard ─────────────────────────────────────────────────────
{
  const { lockstep, inputSync } = makePair();
  lockstep.sampleLocalThrough(2);
  inputSync.ingest({ kind: 'input', slot: 1, frames: [
    { tick: 0, dx: 0, dy: 0, t: 0, still: 1 },
    { tick: 1, dx: 0, dy: 0, t: 0, still: 1 },
    { tick: 2, dx: 0, dy: 0, t: 0, still: 1 },
  ]});
  assert('canExecuteTick(1) false when executeTick=0', lockstep.canExecuteTick(1) === false);
  assert('stallReason=nonMonotonic for skip-ahead', lockstep.getDiagnostics().stallReason === 'nonMonotonic');
  assert('canExecuteTick(0) true', lockstep.canExecuteTick(0) === true);
}

// ── consumeTick / monotonic advancement ─────────────────────────────────────
{
  const { lockstep, inputSync } = makePair();
  lockstep.sampleLocalThrough(2);
  inputSync.ingest({ kind: 'input', slot: 1, frames: [
    { tick: 0, dx: 0, dy: 0, t: 0, still: 1 },
    { tick: 1, dx: 0, dy: 0, t: 0, still: 1 },
    { tick: 2, dx: 0, dy: 0, t: 0, still: 1 },
  ]});
  lockstep.consumeTick(0);
  assert('consumeTick(0) advances executeTick to 1', lockstep.executeTick === 1);
  lockstep.consumeTick(1);
  lockstep.consumeTick(2);
  assert('executeTick=3 after consuming 0,1,2', lockstep.executeTick === 3);
}

{
  const { lockstep } = makePair();
  let threw = false;
  try { lockstep.consumeTick(5); } catch { threw = true; }
  assert('consumeTick out of order throws', threw);
}

// ── Ring buffer pruning on consume ──────────────────────────────────────────
{
  const { lockstep, inputSync } = makePair();
  lockstep.sampleLocalThrough(3);
  inputSync.ingest({ kind: 'input', slot: 1, frames: [
    { tick: 0, dx: 0, dy: 0, t: 0, still: 1 },
    { tick: 1, dx: 0, dy: 0, t: 0, still: 1 },
    { tick: 2, dx: 0, dy: 0, t: 0, still: 1 },
    { tick: 3, dx: 0, dy: 0, t: 0, still: 1 },
  ]});
  lockstep.consumeTick(0);
  lockstep.consumeTick(1);
  const d = lockstep.getDiagnostics();
  assert('consumeTick prunes local ring buffer', d.localSize === 2);
  assert('consumeTick prunes remote ring buffer', d.remoteSize === 2);
}

// ── Solo/local mode (expectRemote=false) ────────────────────────────────────
{
  const { lockstep } = makePair({ expectRemote: false });
  lockstep.sampleLocalThrough(0);
  assert('solo: canExecuteTick(0) true with only local sample',
    lockstep.canExecuteTick(0) === true);
  lockstep.consumeTick(0);
  lockstep.sampleLocalThrough(1);
  assert('solo: canExecuteTick(1) true without remote',
    lockstep.canExecuteTick(1) === true);
}

// ── Stall → catch-up ────────────────────────────────────────────────────────
{
  const { lockstep, inputSync } = makePair();
  lockstep.sampleLocalThrough(5);
  assert('stalled: canExecuteTick(0) false while awaiting remote',
    lockstep.canExecuteTick(0) === false);
  inputSync.ingest({ kind: 'input', slot: 1, frames: [
    { tick: 0, dx: 0, dy: 0, t: 0, still: 1 },
    { tick: 1, dx: 0, dy: 0, t: 0, still: 1 },
  ]});
  assert('after partial remote: exec(0) true', lockstep.canExecuteTick(0) === true);
  lockstep.consumeTick(0);
  assert('after consume: exec(1) true', lockstep.canExecuteTick(1) === true);
  lockstep.consumeTick(1);
  assert('after consume(1): exec(2) false (remote missing)',
    lockstep.canExecuteTick(2) === false);
}

// ── Local ring buffer deterministic content ────────────────────────────────
{
  const { lockstep, adapter } = makePair();
  adapter._set({ dx: 1, dy: 0, t: 1, active: true });
  lockstep.sampleLocalThrough(0);
  const lr = lockstep.getLocalRingBuffer();
  const frame = lr.peekAt(0);
  assert('local ring buffer holds sampled frame', frame && frame.tick === 0);
  assert('local frame quantized dx=127', frame.dx === 127);
  assert('local frame quantized t=255', frame.t === 255);
  assert('local frame still=0 when active', frame.still === 0);
}

// ── Diagnostics shape ───────────────────────────────────────────────────────
{
  const { lockstep } = makePair();
  const d = lockstep.getDiagnostics();
  assert('diagnostics has sendTick/executeTick/stallReason',
    typeof d.sendTick === 'number'
    && typeof d.executeTick === 'number'
    && 'stallReason' in d);
  assert('diagnostics includes localStats and remoteStats',
    !!d.localStats && !!d.remoteStats);
}

// ── Dispose resets ──────────────────────────────────────────────────────────
{
  const { lockstep } = makePair();
  lockstep.sampleLocalThrough(5);
  lockstep.dispose();
  assert('dispose resets sendTick', lockstep.sendTick === 0);
  assert('dispose resets executeTick', lockstep.executeTick === 0);
}

// ── executeTick never exceeds sendTick ──────────────────────────────────────
{
  const { lockstep, inputSync } = makePair();
  lockstep.sampleLocalThrough(0);
  inputSync.ingest({ kind: 'input', slot: 1, frames: [{ tick: 0, dx: 0, dy: 0, t: 0, still: 1 }] });
  lockstep.consumeTick(0);
  assert('invariant: executeTick <= sendTick always',
    lockstep.executeTick <= lockstep.sendTick);
}

console.log(`Coop-lockstep suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
