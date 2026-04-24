// Phase D4a — coopSnapshot schema tests.
import {
  SNAPSHOT_KIND,
  SEQ_HALF,
  isNewerSnapshot,
  createSnapshotSequencer,
  encodeSnapshot,
  decodeSnapshot,
} from '../src/net/coopSnapshot.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (err) { console.error('  ✗ ' + name + ' — ' + err.message); failed++; }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }
function assertEq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function assertThrows(fn, pattern) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; if (pattern && !pattern.test(e.message)) throw new Error('wrong error: ' + e.message); }
  if (!threw) throw new Error('expected throw');
}

console.log('D4a — coopSnapshot schema');

// ── Sequencer ─────────────────────────────────────────────────────────────────
test('sequencer: next increments, peek returns current', () => {
  const s = createSnapshotSequencer();
  assertEq(s.peek(), 0);
  assertEq(s.next(), 0);
  assertEq(s.next(), 1);
  assertEq(s.peek(), 2);
});

test('sequencer: reset to arbitrary value', () => {
  const s = createSnapshotSequencer({ start: 100 });
  assertEq(s.next(), 100);
  s.reset(0xfffffffe);
  assertEq(s.next(), 0xfffffffe);
  assertEq(s.next(), 0xffffffff);
  assertEq(s.next(), 0, 'wraps to 0');
});

test('isNewerSnapshot: simple ordering', () => {
  assert(isNewerSnapshot(5, 4));
  assert(!isNewerSnapshot(4, 5));
  assert(!isNewerSnapshot(5, 5), 'equal is not newer');
});

test('isNewerSnapshot: wraparound', () => {
  // 2 after wrap from 0xffffffff: 0 then 1 then 2
  assert(isNewerSnapshot(0, 0xffffffff), '0 is newer than MAX');
  assert(isNewerSnapshot(2, 0xfffffffe), 'near-wrap step forward');
  assert(!isNewerSnapshot(0xfffffffe, 2), 'reverse of above is NOT newer');
});

test('isNewerSnapshot: half-range boundary', () => {
  // A delta exactly at SEQ_HALF is ambiguous — treated as "not newer" (< SEQ_HALF).
  assert(!isNewerSnapshot(SEQ_HALF, 0), 'exact half is ambiguous → not newer');
  assert(isNewerSnapshot(SEQ_HALF - 1, 0), 'one below half IS newer');
});

test('isNewerSnapshot: non-finite inputs return false', () => {
  assert(!isNewerSnapshot(NaN, 0));
  assert(!isNewerSnapshot(5, Infinity));
});

// ── encodeSnapshot ────────────────────────────────────────────────────────────
test('encode: minimal valid state', () => {
  const snap = encodeSnapshot({ snapshotSeq: 3, snapshotSimTick: 180 });
  assertEq(snap.kind, SNAPSHOT_KIND);
  assertEq(snap.snapshotSeq, 3);
  assertEq(snap.snapshotSimTick, 180);
  assertEq(snap.slots.length, 0);
  assertEq(snap.bullets.length, 0);
  assertEq(snap.enemies.length, 0);
  assertEq(snap.room.index, 0);
  assertEq(snap.room.phase, 'intro');
  assertEq(snap.score, 0);
  assertEq(snap.elapsedMs, 0);
  assertEq(snap.lastProcessedInputSeq[0], 0);
  assertEq(snap.lastProcessedInputSeq[1], 0);
});

test('encode: full state round-trips via JSON', () => {
  const src = {
    snapshotSeq: 42,
    snapshotSimTick: 2520,
    lastProcessedInputSeq: { 0: 100, 1: 98 },
    slots: [
      { id: 0, x: 100.5, y: 200.25, vx: 1.5, vy: -2, hp: 5, maxHp: 5, charge: 0.4, maxCharge: 1, aimAngle: 0.7853, invulnT: 0, shieldT: 0.3, stillTimer: 0.5, alive: true },
      { id: 1, x: 160, y: 200, vx: 0, vy: 0, hp: 3, maxHp: 5, charge: 0, maxCharge: 1, aimAngle: -1.57, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
    ],
    bullets: [
      { id: 1, x: 120, y: 130, vx: 300, vy: 0, type: 'p', ownerSlot: 0, bounces: 0, spawnTick: 2510 },
      { id: 2, x: 130, y: 140, vx: -200, vy: 50, type: 't', ownerSlot: 99, bounces: 1, spawnTick: 2515 },
    ],
    enemies: [
      { id: 10, x: 250, y: 100, vx: 10, vy: 0, hp: 12, type: 'circle', fireT: 0.2, windup: 0 },
    ],
    room: { index: 2, phase: 'fighting', clearTimer: 0, spawnQueueLen: 3 },
    score: 1234,
    elapsedMs: 42000,
  };
  const snap = encodeSnapshot(src);
  const roundTrip = decodeSnapshot(JSON.parse(JSON.stringify(snap)));
  assertEq(roundTrip.snapshotSeq, 42);
  assertEq(roundTrip.snapshotSimTick, 2520);
  assertEq(roundTrip.slots.length, 2);
  assertEq(roundTrip.slots[0].x, 100.5);
  assertEq(roundTrip.slots[1].aimAngle, -1.57);
  assertEq(roundTrip.bullets.length, 2);
  assertEq(roundTrip.bullets[1].type, 't');
  assertEq(roundTrip.bullets[1].bounces, 1);
  assertEq(roundTrip.enemies[0].hp, 12);
  assertEq(roundTrip.room.phase, 'fighting');
  assertEq(roundTrip.score, 1234);
  assertEq(roundTrip.lastProcessedInputSeq[0], 100);
});

test('encode: defaults missing optional scalars to 0/false', () => {
  const snap = encodeSnapshot({
    snapshotSeq: 1,
    snapshotSimTick: 60,
    slots: [{ id: 0, x: 0, y: 0 }], // missing most fields
  });
  const s = snap.slots[0];
  assertEq(s.vx, 0);
  assertEq(s.hp, 0);
  assertEq(s.invulnT, 0);
  assertEq(s.alive, false);
});

test('encode: coerces fractional u32 fields via floor', () => {
  const snap = encodeSnapshot({
    snapshotSeq: 5.9,  // should floor to 5
    snapshotSimTick: 100.1,
  });
  assertEq(snap.snapshotSeq, 5);
  assertEq(snap.snapshotSimTick, 100);
});

// ── Validation failures ───────────────────────────────────────────────────────
test('encode: throws on missing required top-level fields', () => {
  assertThrows(() => encodeSnapshot(null), /state object required/);
  assertThrows(() => encodeSnapshot({ snapshotSimTick: 1 }), /snapshotSeq/);
  assertThrows(() => encodeSnapshot({ snapshotSeq: 1 }), /snapshotSimTick/);
});

test('encode: throws on NaN/Infinity positions', () => {
  assertThrows(
    () => encodeSnapshot({ snapshotSeq: 1, snapshotSimTick: 1, slots: [{ id: 0, x: NaN, y: 0 }] }),
    /slots\[0\]\.x/,
  );
  assertThrows(
    () => encodeSnapshot({ snapshotSeq: 1, snapshotSimTick: 1, slots: [{ id: 0, x: Infinity, y: 0 }] }),
    /slots\[0\]\.x/,
  );
});

test('encode: throws on negative u32 fields', () => {
  assertThrows(
    () => encodeSnapshot({ snapshotSeq: -1, snapshotSimTick: 0 }),
    /snapshotSeq/,
  );
  assertThrows(
    () => encodeSnapshot({
      snapshotSeq: 1, snapshotSimTick: 1,
      bullets: [{ id: -5, x: 0, y: 0 }],
    }),
    /bullets\[0\]\.id/,
  );
});

// ── decodeSnapshot ────────────────────────────────────────────────────────────
test('decode: rejects wrong kind', () => {
  assertThrows(() => decodeSnapshot({ kind: 'input', snapshotSeq: 1, snapshotSimTick: 1 }), /wrong kind/);
});

test('decode: rejects non-object payload', () => {
  assertThrows(() => decodeSnapshot(null), /payload object required/);
  assertThrows(() => decodeSnapshot('not an object'), /payload object required/);
});

test('decode: accepts encoded snapshot as input (idempotent)', () => {
  const snap1 = encodeSnapshot({ snapshotSeq: 7, snapshotSimTick: 420 });
  const snap2 = decodeSnapshot(snap1);
  assertEq(snap2.snapshotSeq, 7);
  assertEq(snap2.snapshotSimTick, 420);
  // Second decode is idempotent.
  const snap3 = decodeSnapshot(snap2);
  assertEq(snap3.snapshotSimTick, 420);
});

test('decode: malformed element surfaces a descriptive error', () => {
  assertThrows(
    () => decodeSnapshot({ kind: 'snapshot', snapshotSeq: 1, snapshotSimTick: 1, enemies: [{ id: 1, x: 'oops', y: 0 }] }),
    /enemies\[0\]\.x/,
  );
});

// ── Integration with sequencer ────────────────────────────────────────────────
test('sequencer drives encode; newest-wins via isNewerSnapshot', () => {
  const seq = createSnapshotSequencer();
  const state = { snapshotSimTick: 60, slots: [], bullets: [], enemies: [] };
  const s1 = encodeSnapshot({ ...state, snapshotSeq: seq.next() });
  const s2 = encodeSnapshot({ ...state, snapshotSeq: seq.next() });
  const s3 = encodeSnapshot({ ...state, snapshotSeq: seq.next() });
  assert(isNewerSnapshot(s2.snapshotSeq, s1.snapshotSeq));
  assert(isNewerSnapshot(s3.snapshotSeq, s2.snapshotSeq));
  assert(!isNewerSnapshot(s1.snapshotSeq, s3.snapshotSeq), 'out-of-order old packet must lose');
});

console.log();
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
