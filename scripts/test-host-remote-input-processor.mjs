// Phase D4.5 — hostRemoteInputProcessor tests.

import { createHostRemoteInputProcessor } from '../src/net/hostRemoteInputProcessor.js';
import { createRemoteInputBuffer } from '../src/net/remoteInputBuffer.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (err) { console.error('  ✗ ' + name + ' — ' + err.message); failed++; }
}
function assertEq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function assertThrows(fn, pattern) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; if (pattern && !pattern.test(e.message)) throw new Error('wrong error: ' + e.message); }
  if (!threw) throw new Error('expected throw');
}

console.log('D4.5 — hostRemoteInputProcessor');

test('constructor: rejects missing remoteRing', () => {
  assertThrows(() => createHostRemoteInputProcessor(), /remoteRing/);
  assertThrows(() => createHostRemoteInputProcessor({}), /remoteRing/);
  assertThrows(() => createHostRemoteInputProcessor({ remoteRing: {} }), /remoteRing/);
});

test('constructor: rejects bad retainTicks', () => {
  const ring = createRemoteInputBuffer();
  assertThrows(() => createHostRemoteInputProcessor({ remoteRing: ring, retainTicks: -1 }), /retainTicks/);
  assertThrows(() => createHostRemoteInputProcessor({ remoteRing: ring, retainTicks: NaN }), /retainTicks/);
  assertThrows(() => createHostRemoteInputProcessor({ remoteRing: ring, retainTicks: Infinity }), /retainTicks/);
});

test('lastProcessedTick starts null (no-ack sentinel)', () => {
  const ring = createRemoteInputBuffer();
  const proc = createHostRemoteInputProcessor({ remoteRing: ring });
  assertEq(proc.getLastProcessedTick(), null);
});

test('tick: missing frame leaves lastProcessedTick unchanged', () => {
  const ring = createRemoteInputBuffer();
  const proc = createHostRemoteInputProcessor({ remoteRing: ring });
  assertEq(proc.tick(5), false);
  assertEq(proc.getLastProcessedTick(), null);
  assertEq(proc.getStats().missCount, 1);
});

test('tick: frame present advances lastProcessedTick', () => {
  const ring = createRemoteInputBuffer();
  ring.push({ tick: 10, dx: 0, dy: 0, t: 0, still: 1, fire: 0 });
  ring.push({ tick: 11, dx: 0, dy: 0, t: 0, still: 1, fire: 0 });
  const proc = createHostRemoteInputProcessor({ remoteRing: ring, retainTicks: 100 });
  assertEq(proc.tick(10), true);
  assertEq(proc.getLastProcessedTick(), 10);
  assertEq(proc.tick(11), true);
  assertEq(proc.getLastProcessedTick(), 11);
  assertEq(proc.getStats().processedCount, 2);
});

test('tick: monotonic-ish — gaps with missing frames preserve last value', () => {
  const ring = createRemoteInputBuffer();
  ring.push({ tick: 5, dx: 0, dy: 0, t: 0, still: 1, fire: 0 });
  ring.push({ tick: 8, dx: 0, dy: 0, t: 0, still: 1, fire: 0 });
  const proc = createHostRemoteInputProcessor({ remoteRing: ring, retainTicks: 100 });
  proc.tick(5);
  assertEq(proc.getLastProcessedTick(), 5);
  proc.tick(6); // miss
  proc.tick(7); // miss
  assertEq(proc.getLastProcessedTick(), 5, 'misses do not regress nor advance');
  proc.tick(8);
  assertEq(proc.getLastProcessedTick(), 8);
});

test('tick: rejects non-finite / negative simTick', () => {
  const ring = createRemoteInputBuffer();
  ring.push({ tick: 0, dx: 0, dy: 0, t: 0, still: 1, fire: 0 });
  const proc = createHostRemoteInputProcessor({ remoteRing: ring });
  assertEq(proc.tick(NaN), false);
  assertEq(proc.tick(undefined), false);
  assertEq(proc.tick(-1), false);
  assertEq(proc.tick(Infinity), false);
  assertEq(proc.getLastProcessedTick(), null);
});

test('trim: consumes frames older than simTick - retainTicks', () => {
  const ring = createRemoteInputBuffer({ capacity: 200 });
  for (let t = 0; t < 100; t++) ring.push({ tick: t, dx: 0, dy: 0, t: 0, still: 1, fire: 0 });
  const proc = createHostRemoteInputProcessor({ remoteRing: ring, retainTicks: 30 });
  proc.tick(99);
  // After processing tick 99 with retain=30, frames with tick <= 69 should be evicted.
  assertEq(ring.oldestTick(), 70, 'oldest after trim is 70');
  assertEq(ring.size(), 30);
});

test('trim: retainTicks=0 evicts everything up to and including simTick', () => {
  const ring = createRemoteInputBuffer();
  for (let t = 0; t < 10; t++) ring.push({ tick: t, dx: 0, dy: 0, t: 0, still: 1, fire: 0 });
  const proc = createHostRemoteInputProcessor({ remoteRing: ring, retainTicks: 0 });
  // retainTicks=0 means trim cutoff = simTick. consumeUpTo(simTick) clears <= simTick
  // INCLUDING the just-processed frame, which is fine because the slot adapter has
  // already read it during update(simTick).
  proc.tick(5);
  assertEq(ring.oldestTick(), 6);
});

test('trim: cutoff < 0 is skipped (early run, no eviction yet)', () => {
  const ring = createRemoteInputBuffer();
  ring.push({ tick: 0, dx: 0, dy: 0, t: 0, still: 1, fire: 0 });
  const proc = createHostRemoteInputProcessor({ remoteRing: ring, retainTicks: 60 });
  proc.tick(0);
  assertEq(ring.size(), 1, 'tick 0 with retain 60 → no trim');
});

test('reset: clears lastProcessedTick and counters', () => {
  const ring = createRemoteInputBuffer();
  ring.push({ tick: 3, dx: 0, dy: 0, t: 0, still: 1, fire: 0 });
  const proc = createHostRemoteInputProcessor({ remoteRing: ring });
  proc.tick(3);
  proc.reset();
  assertEq(proc.getLastProcessedTick(), null);
  assertEq(proc.getStats().processedCount, 0);
  assertEq(proc.getStats().missCount, 0);
});

test('integration: simulating a steady 60Hz stream', () => {
  // Simulate guest having pushed frames 0..120 into the ring; host ticks
  // through and consumes them in order.
  const ring = createRemoteInputBuffer({ capacity: 200 });
  for (let t = 0; t <= 120; t++) ring.push({ tick: t, dx: 1, dy: 0, t: 200, still: 0, fire: 0 });
  const proc = createHostRemoteInputProcessor({ remoteRing: ring, retainTicks: 30 });
  for (let simTick = 0; simTick <= 120; simTick++) proc.tick(simTick);
  assertEq(proc.getLastProcessedTick(), 120);
  assertEq(proc.getStats().processedCount, 121);
  // Trim should have kept ~30 frames worth of recent history.
  assertEq(ring.size(), 30);
  assertEq(ring.oldestTick(), 91);
});

console.log();
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
