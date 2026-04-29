// Phase D4 — coopSnapshotBroadcaster tests.

import { createSnapshotBroadcaster } from '../src/net/coopSnapshotBroadcaster.js';
import { createSnapshotSequencer, isNewerSnapshot } from '../src/net/coopSnapshot.js';

let passed = 0, failed = 0;
const pendingAsync = [];
function test(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      pendingAsync.push(r.then(() => { console.log('  ✓ ' + name); passed++; })
        .catch((err) => { console.error('  ✗ ' + name + ' — ' + err.message); failed++; }));
    } else {
      console.log('  ✓ ' + name); passed++;
    }
  } catch (err) {
    console.error('  ✗ ' + name + ' — ' + err.message); failed++;
  }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }
function assertEq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function assertThrows(fn, pattern) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; if (pattern && !pattern.test(e.message)) throw new Error('wrong error: ' + e.message); }
  if (!threw) throw new Error('expected throw');
}

function makeMinimalState() {
  return {
    slots: [{ id: 0, x: 100, y: 100 }],
    bullets: [],
    enemies: [],
    room: { index: 0, phase: 'intro', clearTimer: 0, spawnQueueLen: 0 },
    score: 0,
    elapsedMs: 0,
    lastProcessedInputSeq: { 0: 0, 1: null },
  };
}

console.log('D4 — coopSnapshotBroadcaster');

// ── Construction ──────────────────────────────────────────────────────────────
test('constructor: rejects missing required deps', () => {
  const baseOk = {
    sendGameplay: () => {},
    sequencer: createSnapshotSequencer(),
    runId: 'r1',
    getState: () => makeMinimalState(),
  };
  assertThrows(() => createSnapshotBroadcaster({}), /sendGameplay/);
  assertThrows(() => createSnapshotBroadcaster({ ...baseOk, sequencer: null }), /sequencer/);
  assertThrows(() => createSnapshotBroadcaster({ ...baseOk, runId: '' }), /runId/);
  assertThrows(() => createSnapshotBroadcaster({ ...baseOk, runId: 123 }), /runId/);
  assertThrows(() => createSnapshotBroadcaster({ ...baseOk, getState: 'nope' }), /getState/);
  assertThrows(() => createSnapshotBroadcaster({ ...baseOk, ticksPerSnapshot: 0 }), /ticksPerSnapshot/);
  assertThrows(() => createSnapshotBroadcaster({ ...baseOk, ticksPerSnapshot: -1 }), /ticksPerSnapshot/);
});

// ── Cadence ──────────────────────────────────────────────────────────────────
test('cadence: emits on first tick, then every N ticks', () => {
  const sent = [];
  const bc = createSnapshotBroadcaster({
    sendGameplay: (msg) => sent.push(msg),
    sequencer: createSnapshotSequencer(),
    runId: 'r1',
    ticksPerSnapshot: 6,
    getState: () => makeMinimalState(),
  });
  // Tick 0: first call → emit
  assertEq(bc.tick(0), true);
  // Ticks 1..5: below threshold → skip
  for (let t = 1; t <= 5; t++) assertEq(bc.tick(t), false);
  assertEq(sent.length, 1);
  // Tick 6: cadence reached → emit
  assertEq(bc.tick(6), true);
  assertEq(sent.length, 2);
  // Ticks 7..11 skip, 12 emits
  for (let t = 7; t <= 11; t++) bc.tick(t);
  assertEq(sent.length, 2);
  bc.tick(12);
  assertEq(sent.length, 3);
});

test('cadence: large simTick gap still emits exactly once (no burst replay)', () => {
  const sent = [];
  const bc = createSnapshotBroadcaster({
    sendGameplay: (msg) => sent.push(msg),
    sequencer: createSnapshotSequencer(),
    runId: 'r1',
    ticksPerSnapshot: 6,
    getState: () => makeMinimalState(),
  });
  bc.tick(0);
  bc.tick(500); // simulating tab unfreeze: huge jump
  assertEq(sent.length, 2, 'one initial + one after gap, NOT 84 catch-up sends');
});

test('cadence: ticksPerSnapshot is floored', () => {
  const sent = [];
  const bc = createSnapshotBroadcaster({
    sendGameplay: (msg) => sent.push(msg),
    sequencer: createSnapshotSequencer(),
    runId: 'r1',
    ticksPerSnapshot: 6.9,
    getState: () => makeMinimalState(),
  });
  bc.tick(0); bc.tick(5);
  assertEq(sent.length, 1);
  bc.tick(6);
  assertEq(sent.length, 2, 'fires at tick 6 since 6.9 floored to 6');
});

test('cadence: non-finite simTick is ignored, increments skipped', () => {
  const sent = [];
  const bc = createSnapshotBroadcaster({
    sendGameplay: (msg) => sent.push(msg),
    sequencer: createSnapshotSequencer(),
    runId: 'r1',
    ticksPerSnapshot: 6,
    getState: () => makeMinimalState(),
  });
  bc.tick(NaN);
  bc.tick(undefined);
  bc.tick(Infinity);
  assertEq(sent.length, 0);
  assert(bc.getStats().skipped >= 3);
});

// ── Wire shape ────────────────────────────────────────────────────────────────
test('output: snapshot has correct envelope (kind/runId/seq/simTick)', () => {
  const sent = [];
  const seq = createSnapshotSequencer();
  const bc = createSnapshotBroadcaster({
    sendGameplay: (msg) => sent.push(msg),
    sequencer: seq,
    runId: 'run-abc',
    ticksPerSnapshot: 1,
    getState: () => makeMinimalState(),
  });
  bc.tick(0);
  bc.tick(1);
  assertEq(sent.length, 2);
  assertEq(sent[0].kind, 'snapshot');
  assertEq(sent[0].runId, 'run-abc');
  assertEq(sent[0].snapshotSeq, 0);
  assertEq(sent[0].snapshotSimTick, 0);
  assertEq(sent[1].snapshotSeq, 1);
  assertEq(sent[1].snapshotSimTick, 1);
  // Sequencer state advanced past the broadcaster's last seq.
  assertEq(seq.peek(), 2);
  // Newest-wins agrees with isNewerSnapshot.
  assert(isNewerSnapshot(sent[1].snapshotSeq, sent[0].snapshotSeq));
});

test('output: getState may mutate-or-return-new; broadcaster does not blow up either way', () => {
  const sent = [];
  // shared object reused: broadcaster injects runId/seq/tick onto it
  const shared = makeMinimalState();
  const bc = createSnapshotBroadcaster({
    sendGameplay: (msg) => sent.push(msg),
    sequencer: createSnapshotSequencer(),
    runId: 'r1',
    ticksPerSnapshot: 1,
    getState: () => shared,
  });
  bc.tick(0); bc.tick(1);
  assertEq(sent.length, 2);
  // The shared object got runId/seq stamped onto it (last value wins). That's
  // fine because each call re-stamps; just confirms no throw.
  assertEq(shared.runId, 'r1');
});

// ── Error isolation ───────────────────────────────────────────────────────────
test('error: sendGameplay sync throw → counted as failure, not propagated', () => {
  const bc = createSnapshotBroadcaster({
    sendGameplay: () => { throw new Error('transport down'); },
    sequencer: createSnapshotSequencer(),
    runId: 'r1',
    ticksPerSnapshot: 1,
    getState: () => makeMinimalState(),
  });
  bc.tick(0);
  bc.tick(1);
  assertEq(bc.getStats().failed, 2);
  assertEq(bc.getStats().sent, 0);
});

test('error: sendGameplay async rejection → no unhandled rejection', async () => {
  let unhandled = null;
  const onUnhandled = (err) => { unhandled = err; };
  process.on('unhandledRejection', onUnhandled);
  try {
    const bc = createSnapshotBroadcaster({
      sendGameplay: async () => { throw new Error('async fail'); },
      sequencer: createSnapshotSequencer(),
      runId: 'r1',
      ticksPerSnapshot: 1,
      getState: () => makeMinimalState(),
    });
    bc.tick(0);
    await Promise.resolve(); await Promise.resolve();
    assertEq(bc.getStats().failed, 1);
    assertEq(bc.getStats().sent, 0);
    assert(unhandled === null);
  } finally {
    process.removeListener('unhandledRejection', onUnhandled);
  }
});

test('error: getState throw → counted as failure, no send attempted', () => {
  const sent = [];
  const bc = createSnapshotBroadcaster({
    sendGameplay: (msg) => sent.push(msg),
    sequencer: createSnapshotSequencer(),
    runId: 'r1',
    ticksPerSnapshot: 1,
    getState: () => { throw new Error('state read crash'); },
  });
  bc.tick(0);
  assertEq(sent.length, 0);
  assertEq(bc.getStats().failed, 1);
});

test('error: encode failure (missing required field) is caught', () => {
  const sent = [];
  const bc = createSnapshotBroadcaster({
    sendGameplay: (msg) => sent.push(msg),
    sequencer: createSnapshotSequencer(),
    runId: 'r1',
    ticksPerSnapshot: 1,
    // Returns state with NaN x → encode throws.
    getState: () => ({ slots: [{ id: 0, x: NaN, y: 0 }] }),
  });
  bc.tick(0);
  assertEq(sent.length, 0);
  assertEq(bc.getStats().failed, 1);
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────
test('lifecycle: dispose stops further sends', () => {
  const sent = [];
  const bc = createSnapshotBroadcaster({
    sendGameplay: (msg) => sent.push(msg),
    sequencer: createSnapshotSequencer(),
    runId: 'r1',
    ticksPerSnapshot: 1,
    getState: () => makeMinimalState(),
  });
  bc.tick(0); bc.tick(1);
  assertEq(sent.length, 2);
  bc.dispose();
  assert(bc.isDisposed());
  bc.tick(2); bc.tick(3);
  assertEq(sent.length, 2, 'no sends after dispose');
});

test('lifecycle: dispose mid-async-send → late resolve does not increment sent', async () => {
  const sent = [];
  let resolveSend;
  const bc = createSnapshotBroadcaster({
    sendGameplay: (msg) => { sent.push(msg); return new Promise((res) => { resolveSend = res; }); },
    sequencer: createSnapshotSequencer(),
    runId: 'r1',
    ticksPerSnapshot: 1,
    getState: () => makeMinimalState(),
  });
  bc.tick(0);
  // Now dispose BEFORE the async resolve fires.
  bc.dispose();
  resolveSend();
  await Promise.resolve(); await Promise.resolve();
  assertEq(bc.getStats().sent, 0, 'late resolve after dispose must not count');
});

// ── Stats ─────────────────────────────────────────────────────────────────────
test('stats: tracks sent/failed/skipped counters and last fields', () => {
  const sent = [];
  const bc = createSnapshotBroadcaster({
    sendGameplay: (msg) => sent.push(msg),
    sequencer: createSnapshotSequencer({ start: 100 }),
    runId: 'run-stats',
    ticksPerSnapshot: 6,
    getState: () => makeMinimalState(),
  });
  bc.tick(0);   // emit
  bc.tick(1);   // skip
  bc.tick(6);   // emit
  bc.tick(12);  // emit
  const s = bc.getStats();
  assertEq(s.skipped, 1);
  assertEq(s.lastSimTick, 12);
  assertEq(s.lastSeq, 102, 'sequencer started at 100, three emits → 100,101,102');
  assert(s.lastBytes > 0, 'JSON byte size measured');
  assertEq(s.runId, 'run-stats');
  assertEq(s.ticksPerSnapshot, 6);
});

await Promise.all(pendingAsync);
console.log();
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
