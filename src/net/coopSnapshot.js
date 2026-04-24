// Phase D4a — Full-snapshot schema + sequencing for coop.
//
// This module defines the authoritative snapshot wire format that the host
// broadcasts to guests each tick group. It is pure data — no references to
// script.js globals, no DOM, no async work. All I/O is via plain objects,
// so it is trivially testable and swappable for a binary encoder later.
//
// Wire contract (kind === 'snapshot'):
//
//   {
//     kind: 'snapshot',
//     runId: string,                  // host-scoped run epoch (D4). Guests
//                                     //   reset latest-snapshot tracking when
//                                     //   runId changes; protects against
//                                     //   stale post-dispose deliveries.
//     snapshotSeq: uint32             // monotonic, host-produced, wraps at 2^32
//     snapshotSimTick: uint32,        // host simTick AT which state was sampled
//     lastProcessedInputSeq: {        // per-slot: last guest-input tick the
//       0: uint32 | null,             //    host consumed BEFORE this snapshot.
//       1: uint32 | null,             //    null = no input consumed yet for
//     },                              //    that slot. D6 must NOT trim its
//                                     //    replay buffer when null.
//     slots: [
//       { id, x, y, vx, vy, hp, maxHp, charge, maxCharge, aimAngle,
//         invulnT, shieldT, stillTimer, alive }
//     ],
//     bullets: [                     // IDs from D4b (per-owner spawn seq)
//       { id, x, y, vx, vy, type, ownerSlot, bounces, spawnTick }
//     ],
//     enemies: [
//       { id, x, y, vx, vy, hp, type, fireT, windup }
//     ],
//     room: { index, phase, clearTimer, spawnQueueLen },
//     score: number,
//     elapsedMs: number,
//   }
//
// Sequencing notes (rubber-duck critique #3):
//   - snapshotSeq drives "newest wins" at the guest; out-of-order UDP-style
//     delivery is expected. isNewerSnapshot() handles 32-bit wraparound.
//   - snapshotSimTick is the host sim step at which state was sampled. This
//     is what the guest's reconciliation step rewinds to — NOT wall time.
//   - lastProcessedInputSeq is CRITICAL. When host runs tick T, it consumes
//     guest inputs up to some tick G. If G < T, the guest was ahead of the
//     host; reconciliation must replay inputs G+1..guest's current tick.
//   - No deltas in D4a. First cut is full snapshots at 10-15 Hz. Delta
//     compression is a post-D9 optimization.
//
// Validation philosophy:
//   - decodeSnapshot() is lenient on missing optionals (defaults applied)
//     but strict on required scalar types (throws on malformed).
//   - Any throw during decode should be caught by the caller and dropped;
//     a malformed snapshot must not wedge the guest loop.

const SNAPSHOT_KIND = 'snapshot';
const SEQ_MOD = 0x100000000; // 2^32
const SEQ_HALF = 0x80000000; // 2^31

// Guards: a tick >= 2^31 "ahead" is treated as wrapped-behind. This
// handles 32-bit seq wraparound without requiring a 64-bit integer type.
function isNewerSnapshot(newSeq, oldSeq) {
  if (!Number.isFinite(newSeq) || !Number.isFinite(oldSeq)) return false;
  const delta = ((newSeq - oldSeq) >>> 0);
  return delta !== 0 && delta < SEQ_HALF;
}

function createSnapshotSequencer({ start = 0 } = {}) {
  let seq = (start >>> 0);
  return {
    next() {
      const v = seq;
      seq = ((seq + 1) >>> 0);
      return v;
    },
    peek() { return seq; },
    reset(v = 0) { seq = (v >>> 0); },
  };
}

// Coerce a value to uint32, throwing on non-finite or negative input.
function u32(v, fieldName) {
  if (!Number.isFinite(v) || v < 0) throw new Error('snapshot: ' + fieldName + ' must be non-negative finite, got ' + v);
  return (Math.floor(v) >>> 0);
}

// uint32 OR null. Used for lastProcessedInputSeq slot fields where the host
// has not consumed any guest input yet (rubber-duck #4: do not fake this
// field with a synthetic 0/-1 sentinel — null means "no ack to anchor on").
function u32OrNull(v, fieldName) {
  if (v === null || v === undefined) return null;
  return u32(v, fieldName);
}

function reqString(v, fieldName, { minLen = 1, maxLen = 128 } = {}) {
  if (typeof v !== 'string') throw new Error('snapshot: ' + fieldName + ' must be string, got ' + typeof v);
  if (v.length < minLen || v.length > maxLen) {
    throw new Error('snapshot: ' + fieldName + ' length out of range [' + minLen + ',' + maxLen + '], got ' + v.length);
  }
  return v;
}

// Coerce to finite number, throwing on NaN/Infinity.
function num(v, fieldName) {
  if (!Number.isFinite(v)) throw new Error('snapshot: ' + fieldName + ' must be finite, got ' + v);
  return v;
}

function encodeSlot(src, idx) {
  if (!src || typeof src !== 'object') throw new Error('snapshot: slots[' + idx + '] missing');
  return {
    id: u32(src.id, 'slots[' + idx + '].id'),
    x: num(src.x, 'slots[' + idx + '].x'),
    y: num(src.y, 'slots[' + idx + '].y'),
    vx: num(src.vx ?? 0, 'slots[' + idx + '].vx'),
    vy: num(src.vy ?? 0, 'slots[' + idx + '].vy'),
    hp: num(src.hp ?? 0, 'slots[' + idx + '].hp'),
    maxHp: num(src.maxHp ?? 0, 'slots[' + idx + '].maxHp'),
    charge: num(src.charge ?? 0, 'slots[' + idx + '].charge'),
    maxCharge: num(src.maxCharge ?? 0, 'slots[' + idx + '].maxCharge'),
    aimAngle: num(src.aimAngle ?? 0, 'slots[' + idx + '].aimAngle'),
    invulnT: num(src.invulnT ?? 0, 'slots[' + idx + '].invulnT'),
    shieldT: num(src.shieldT ?? 0, 'slots[' + idx + '].shieldT'),
    stillTimer: num(src.stillTimer ?? 0, 'slots[' + idx + '].stillTimer'),
    alive: !!src.alive,
  };
}

function encodeBullet(src, idx) {
  if (!src || typeof src !== 'object') throw new Error('snapshot: bullets[' + idx + '] missing');
  return {
    id: u32(src.id, 'bullets[' + idx + '].id'),
    x: num(src.x, 'bullets[' + idx + '].x'),
    y: num(src.y, 'bullets[' + idx + '].y'),
    vx: num(src.vx ?? 0, 'bullets[' + idx + '].vx'),
    vy: num(src.vy ?? 0, 'bullets[' + idx + '].vy'),
    type: String(src.type ?? 'p'),
    ownerSlot: u32(src.ownerSlot ?? 0, 'bullets[' + idx + '].ownerSlot'),
    bounces: u32(src.bounces ?? 0, 'bullets[' + idx + '].bounces'),
    spawnTick: u32(src.spawnTick ?? 0, 'bullets[' + idx + '].spawnTick'),
  };
}

function encodeEnemy(src, idx) {
  if (!src || typeof src !== 'object') throw new Error('snapshot: enemies[' + idx + '] missing');
  return {
    id: u32(src.id, 'enemies[' + idx + '].id'),
    x: num(src.x, 'enemies[' + idx + '].x'),
    y: num(src.y, 'enemies[' + idx + '].y'),
    vx: num(src.vx ?? 0, 'enemies[' + idx + '].vx'),
    vy: num(src.vy ?? 0, 'enemies[' + idx + '].vy'),
    hp: num(src.hp ?? 0, 'enemies[' + idx + '].hp'),
    type: String(src.type ?? 'e'),
    fireT: num(src.fireT ?? 0, 'enemies[' + idx + '].fireT'),
    windup: num(src.windup ?? 0, 'enemies[' + idx + '].windup'),
  };
}

function encodeRoom(src) {
  if (!src || typeof src !== 'object') {
    return { index: 0, phase: 'intro', clearTimer: 0, spawnQueueLen: 0 };
  }
  return {
    index: u32(src.index ?? 0, 'room.index'),
    phase: String(src.phase ?? 'intro'),
    clearTimer: num(src.clearTimer ?? 0, 'room.clearTimer'),
    spawnQueueLen: u32(src.spawnQueueLen ?? 0, 'room.spawnQueueLen'),
  };
}

function encodeLastProcessedInputSeq(src) {
  if (!src || typeof src !== 'object') return { 0: null, 1: null };
  return {
    0: u32OrNull(src[0], 'lastProcessedInputSeq[0]'),
    1: u32OrNull(src[1], 'lastProcessedInputSeq[1]'),
  };
}

// Produces a wire-safe snapshot object from loosely-typed host state.
// Caller owns the input; output is a fresh object safe to JSON.stringify.
function encodeSnapshot(state) {
  if (!state || typeof state !== 'object') throw new Error('snapshot: state object required');
  const runId = reqString(state.runId, 'runId');
  const snapshotSeq = u32(state.snapshotSeq, 'snapshotSeq');
  const snapshotSimTick = u32(state.snapshotSimTick, 'snapshotSimTick');
  const lastProcessedInputSeq = encodeLastProcessedInputSeq(state.lastProcessedInputSeq);
  const slots = (state.slots || []).map(encodeSlot);
  const bullets = (state.bullets || []).map(encodeBullet);
  const enemies = (state.enemies || []).map(encodeEnemy);
  const room = encodeRoom(state.room);
  const score = num(state.score ?? 0, 'score');
  const elapsedMs = num(state.elapsedMs ?? 0, 'elapsedMs');
  return {
    kind: SNAPSHOT_KIND,
    runId,
    snapshotSeq,
    snapshotSimTick,
    lastProcessedInputSeq,
    slots,
    bullets,
    enemies,
    room,
    score,
    elapsedMs,
  };
}

// Inverse of encodeSnapshot: normalizes a payload that came off the wire.
// Throws on missing required fields or malformed scalars.
function decodeSnapshot(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('snapshot: payload object required');
  if (payload.kind !== SNAPSHOT_KIND) throw new Error('snapshot: wrong kind ' + payload.kind);
  return encodeSnapshot(payload); // encoding from a decoded-ish object re-validates
}

export {
  SNAPSHOT_KIND,
  SEQ_MOD,
  SEQ_HALF,
  isNewerSnapshot,
  createSnapshotSequencer,
  encodeSnapshot,
  decodeSnapshot,
};
