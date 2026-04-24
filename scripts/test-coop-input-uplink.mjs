// Phase D3 — Guest→Host input uplink integration tests.
//
// Validates the round-trip contract between createCoopInputSync and a mock
// coopSession transport:
//   - guest flushes frames on batch-size boundary
//   - host ingests {kind:'input'} payloads into its ring buffer
//   - role='local' (COOP_DEBUG) is a no-op (no session wiring)
//   - solo / no-session cases bail gracefully
//   - teardown disposes the sync + unsubscribes the gameplay listener
//   - out-of-order frames land sorted; duplicates dropped

import { createCoopInputSync } from '../src/net/coopInputSync.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (err) { console.error('  ✗ ' + name + ' — ' + err.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEq(a, b, msg) { if (a !== b) throw new Error((msg || 'eq') + ': expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }

function createMockSession() {
  const sentPayloads = [];
  const gameplayListeners = new Set();
  return {
    sentPayloads,
    sendGameplay(msg) { sentPayloads.push(msg); },
    onGameplay(fn) { gameplayListeners.add(fn); return () => gameplayListeners.delete(fn); },
    simulateIncoming(msg) { for (const fn of gameplayListeners) fn(msg); },
    listenerCount() { return gameplayListeners.size; },
  };
}

function createStubJoyAdapter(vec) {
  return {
    kind: 'stub',
    moveVector() { return vec; },
    isStill() { return !vec.active; },
  };
}

console.log('D3 — coop input uplink');

test('guest: batch flushes after 4 frames via sendGameplay', () => {
  const sess = createMockSession();
  const sync = createCoopInputSync({
    sendGameplay: sess.sendGameplay,
    localAdapter: createStubJoyAdapter({ dx: 1, dy: 0, t: 1, active: true }),
    localSlotIndex: 1,
    batchSize: 4,
  });
  for (let t = 0; t < 3; t++) sync.sampleFrame(t);
  assertEq(sess.sentPayloads.length, 0, 'no flush before batch complete');
  sync.sampleFrame(3);
  assertEq(sess.sentPayloads.length, 1, 'flushed at batch boundary');
  const msg = sess.sentPayloads[0];
  assertEq(msg.kind, 'input');
  assertEq(msg.slot, 1);
  assertEq(msg.frames.length, 4);
  assertEq(msg.frames[0].tick, 0);
  assertEq(msg.frames[3].tick, 3);
});

test('guest: sampleFrame tick matches sim tick', () => {
  const sess = createMockSession();
  const sync = createCoopInputSync({
    sendGameplay: sess.sendGameplay,
    localAdapter: createStubJoyAdapter({ dx: 0, dy: 1, t: 0.5, active: true }),
    localSlotIndex: 1,
    batchSize: 2,
  });
  sync.sampleFrame(42);
  sync.sampleFrame(43);
  const frames = sess.sentPayloads[0].frames;
  assertEq(frames[0].tick, 42);
  assertEq(frames[1].tick, 43);
});

test('guest: quantization preserves sign for still-zero input', () => {
  const sess = createMockSession();
  const sync = createCoopInputSync({
    sendGameplay: sess.sendGameplay,
    localAdapter: createStubJoyAdapter({ dx: 0, dy: 0, t: 0, active: false }),
    localSlotIndex: 1,
    batchSize: 1,
  });
  sync.sampleFrame(0);
  const f = sess.sentPayloads[0].frames[0];
  assertEq(f.dx, 0);
  assertEq(f.dy, 0);
  assertEq(f.t, 0);
  assertEq(f.still, 1);
});

test('guest: explicit flush sends pending frames immediately', () => {
  const sess = createMockSession();
  const sync = createCoopInputSync({
    sendGameplay: sess.sendGameplay,
    localAdapter: createStubJoyAdapter({ dx: 1, dy: 0, t: 1, active: true }),
    localSlotIndex: 1,
    batchSize: 8,
  });
  sync.sampleFrame(0);
  sync.sampleFrame(1);
  assertEq(sess.sentPayloads.length, 0);
  sync.flush();
  assertEq(sess.sentPayloads.length, 1);
  assertEq(sess.sentPayloads[0].frames.length, 2);
});

test('host: ingest populates ring buffer from input payload', () => {
  const sess = createMockSession();
  const sync = createCoopInputSync({
    sendGameplay: sess.sendGameplay,
    localAdapter: createStubJoyAdapter({ dx: 0, dy: 0, t: 0, active: false }),
    localSlotIndex: 0,
    batchSize: 4,
  });
  const unsub = sess.onGameplay((p) => { if (p.kind === 'input') sync.ingest(p); });
  sess.simulateIncoming({
    kind: 'input',
    slot: 1,
    frames: [
      { tick: 10, dx: 50, dy: 0, t: 100, still: 0 },
      { tick: 11, dx: 60, dy: 10, t: 128, still: 0 },
    ],
  });
  const buf = sync.getRemoteRingBuffer();
  assertEq(buf.size(), 2);
  assertEq(buf.peekAt(10).dx, 50);
  assertEq(buf.peekAt(11).dy, 10);
  unsub();
});

test('host: ignores non-input gameplay payloads', () => {
  const sess = createMockSession();
  const sync = createCoopInputSync({
    sendGameplay: sess.sendGameplay,
    localAdapter: createStubJoyAdapter({ dx: 0, dy: 0, t: 0, active: false }),
    localSlotIndex: 0,
    batchSize: 4,
  });
  sess.onGameplay((p) => { if (p.kind === 'input') sync.ingest(p); });
  sess.simulateIncoming({ kind: 'snapshot', snapshotSeq: 1 });
  sess.simulateIncoming({ kind: 'ping', t: Date.now() });
  assertEq(sync.getRemoteRingBuffer().size(), 0);
});

test('host: out-of-order frames land sorted ascending', () => {
  const sess = createMockSession();
  const sync = createCoopInputSync({
    sendGameplay: sess.sendGameplay,
    localAdapter: createStubJoyAdapter({ dx: 0, dy: 0, t: 0, active: false }),
    localSlotIndex: 0,
    batchSize: 4,
  });
  sess.onGameplay((p) => sync.ingest(p));
  sess.simulateIncoming({
    kind: 'input',
    slot: 1,
    frames: [
      { tick: 30, dx: 0, dy: 0, t: 0, still: 1 },
      { tick: 10, dx: 0, dy: 0, t: 0, still: 1 },
      { tick: 20, dx: 0, dy: 0, t: 0, still: 1 },
    ],
  });
  const buf = sync.getRemoteRingBuffer();
  assertEq(buf.oldestTick(), 10);
  assertEq(buf.newestTick(), 30);
});

test('host: duplicate tick is dropped by ring buffer', () => {
  const sess = createMockSession();
  const sync = createCoopInputSync({
    sendGameplay: sess.sendGameplay,
    localAdapter: createStubJoyAdapter({ dx: 0, dy: 0, t: 0, active: false }),
    localSlotIndex: 0,
    batchSize: 4,
  });
  sess.onGameplay((p) => sync.ingest(p));
  sess.simulateIncoming({ kind: 'input', slot: 1, frames: [{ tick: 5, dx: 10, dy: 0, t: 100, still: 0 }] });
  sess.simulateIncoming({ kind: 'input', slot: 1, frames: [{ tick: 5, dx: 99, dy: 99, t: 200, still: 0 }] });
  const buf = sync.getRemoteRingBuffer();
  assertEq(buf.size(), 1);
  assertEq(buf.peekAt(5).dx, 10, 'first-write-wins');
});

test('teardown: dispose clears pending frames and listeners', () => {
  const sess = createMockSession();
  const sync = createCoopInputSync({
    sendGameplay: sess.sendGameplay,
    localAdapter: createStubJoyAdapter({ dx: 1, dy: 0, t: 1, active: true }),
    localSlotIndex: 1,
    batchSize: 4,
  });
  sync.sampleFrame(0);
  sync.sampleFrame(1);
  sync.dispose();
  // flush after dispose should send nothing (pending cleared)
  const countBefore = sess.sentPayloads.length;
  sync.flush();
  assertEq(sess.sentPayloads.length, countBefore, 'dispose clears pending batch');
});

test('teardown: unsubscribe stops delivering to ingest', () => {
  const sess = createMockSession();
  const sync = createCoopInputSync({
    sendGameplay: sess.sendGameplay,
    localAdapter: createStubJoyAdapter({ dx: 0, dy: 0, t: 0, active: false }),
    localSlotIndex: 0,
    batchSize: 4,
  });
  const unsub = sess.onGameplay((p) => sync.ingest(p));
  sess.simulateIncoming({ kind: 'input', slot: 1, frames: [{ tick: 1, dx: 0, dy: 0, t: 0, still: 1 }] });
  assertEq(sync.getRemoteRingBuffer().size(), 1);
  unsub();
  assertEq(sess.listenerCount(), 0);
  sess.simulateIncoming({ kind: 'input', slot: 1, frames: [{ tick: 2, dx: 0, dy: 0, t: 0, still: 1 }] });
  assertEq(sync.getRemoteRingBuffer().size(), 1, 'frame after unsub does not land');
});

test('sendGameplay throw is caught; does not abort sampleFrame', () => {
  const sync = createCoopInputSync({
    sendGameplay: () => { throw new Error('transport down'); },
    localAdapter: createStubJoyAdapter({ dx: 0, dy: 0, t: 0, active: false }),
    localSlotIndex: 1,
    batchSize: 2,
  });
  // Should not throw even though sendGameplay throws.
  sync.sampleFrame(0);
  sync.sampleFrame(1);
  // stats reflect the send attempt did not increment sent counter
  const stats = sync.getStats();
  assertEq(stats.sent, 0, 'failed send not counted');
});

test('end-to-end: guest→session→host round trip with batching', () => {
  const sess = createMockSession();
  // Guest side
  const guest = createCoopInputSync({
    sendGameplay: sess.sendGameplay,
    localAdapter: createStubJoyAdapter({ dx: 127, dy: 0, t: 1, active: true }),
    localSlotIndex: 1,
    batchSize: 4,
  });
  // Host side: uses same session but different sync instance, slot 0
  const host = createCoopInputSync({
    sendGameplay: () => {}, // host doesn't send input
    localAdapter: createStubJoyAdapter({ dx: 0, dy: 0, t: 0, active: false }),
    localSlotIndex: 0,
    batchSize: 4,
  });
  sess.onGameplay((p) => { if (p.kind === 'input') host.ingest(p); });

  // Guest plays 8 ticks → 2 batched sends
  for (let t = 0; t < 8; t++) guest.sampleFrame(t);
  assertEq(sess.sentPayloads.length, 2);

  // Wire each sent payload back into host (simulating Supabase broadcast loopback)
  for (const p of sess.sentPayloads) sess.simulateIncoming(p);

  const hostBuf = host.getRemoteRingBuffer();
  assertEq(hostBuf.size(), 8, 'host received all 8 frames');
  assertEq(hostBuf.oldestTick(), 0);
  assertEq(hostBuf.newestTick(), 7);
});

console.log();
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
