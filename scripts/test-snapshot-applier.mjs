// D5b — Snapshot applier tests.
// Validates the guest-side snap-to-latest applier in isolation: no globals,
// no DOM, no transport. Mirrors the unit-test conventions in
// scripts/test-coop-snapshot.mjs (assert + section banner).

import { createSnapshotApplier } from '../src/net/snapshotApplier.js';
import { encodeSnapshot } from '../src/net/coopSnapshot.js';

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (detail ? '  -- ' + detail : '')); }
}

console.log('D5b — snapshotApplier');

// ── Fixtures ────────────────────────────────────────────────────────────
const ENEMY_DEFS = {
  chaser: { label: 'Buster', colorRole: 'danger', isElite: false, r: 12, spd: 100, fRate: 1500 },
  triangle: { label: 'Trigon', colorRole: 'aggressive', isTriangle: true, isElite: false, r: 12, spd: 130 },
  elite: { label: 'Elite', colorRole: 'elite', isElite: true, r: 14, spd: 110 },
};

function colorResolver(type, def) {
  return { col: '#' + type.slice(0, 3), glowCol: 'rgba(0,0,0,0.5)' };
}

function makeSlot(id) {
  const body = { x: 0, y: 0, vx: 0, vy: 0, r: 14, invincible: 0, deadAt: 0 };
  const upg = { maxCharge: 100 };
  const metrics = { hp: 0, maxHp: 0, charge: 0, stillTimer: 0 };
  const aim = { angle: 0, hasTarget: false };
  return {
    id,
    body, upg, metrics, aim,
    getBody: () => body,
    getUpg: () => upg,
  };
}

function baseSnapshot(overrides = {}) {
  return encodeSnapshot({
    runId: 'run-1',
    snapshotSeq: 1,
    snapshotSimTick: 60,
    lastProcessedInputSeq: { 0: 10, 1: 11 },
    slots: [
      { id: 0, x: 100, y: 200, vx: 1, vy: 2, hp: 5, maxHp: 5, charge: 25, maxCharge: 100, aimAngle: 0.5, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 300, y: 400, vx: 0, vy: 0, hp: 4, maxHp: 5, charge: 60, maxCharge: 100, aimAngle: 1.5, invulnT: 0.2, shieldT: 0, stillTimer: 0, alive: true },
    ],
    bullets: [
      { id: 1, x: 50, y: 60, vx: 1, vy: 0, r: 5, type: 'p', state: 'output', ownerSlot: 0, bounces: 0, spawnTick: 1 },
      { id: 2, x: 70, y: 80, vx: 0, vy: 1, r: 7, type: 'e', state: 'danger', ownerSlot: 99, bounces: 1, spawnTick: 2 },
    ],
    enemies: [
      { id: 1, x: 10, y: 20, vx: 0, vy: 0, hp: 3, maxHp: 5, r: 12, type: 'chaser', fT: 100, fRate: 1500 },
      { id: 2, x: 30, y: 40, vx: 0, vy: 0, hp: 6, maxHp: 6, r: 12, type: 'triangle', fT: 0, fRate: 0 },
    ],
    room: { index: 5, phase: 'fighting', clearTimer: 0.5, spawnQueueLen: 0 },
    score: 1234,
    elapsedMs: 5000,
    ...overrides,
  });
}

function freshTarget() {
  return { enemies: [], bullets: [], slotsById: { 0: makeSlot(0), 1: makeSlot(1) } };
}

// ── Tests ────────────────────────────────────────────────────────────────

// 1. Basic apply: enemies + bullets rebuilt; slots positioned.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver });
  const t = freshTarget();
  const r = ap.apply(baseSnapshot(), t);
  ok('apply: returns applied=true on first snapshot', r && r.applied === true);
  ok('apply: enemies length matches snapshot', t.enemies.length === 2);
  ok('apply: bullets length matches snapshot', t.bullets.length === 2);
  ok('apply: slot 0 body x=100', t.slotsById[0].body.x === 100);
  ok('apply: slot 1 body x=300', t.slotsById[1].body.x === 300);
  ok('apply: slot 0 metrics.hp=5', t.slotsById[0].metrics.hp === 5);
  ok('apply: slot 1 metrics.charge=60', t.slotsById[1].metrics.charge === 60);
  ok('apply: slot 1 invincible=invulnT', Math.abs(t.slotsById[1].body.invincible - 0.2) < 1e-9);
  ok('apply: slot aim.angle written', t.slotsById[1].aim.angle === 1.5);
  ok('apply: returns room', r.room && r.room.index === 5 && r.room.phase === 'fighting');
  ok('apply: returns score', r.score === 1234);
  ok('apply: does NOT return elapsedMs (rubber-duck D5b)', !('elapsedMs' in r));
}

// 2. Wipe between calls (no leak across snapshots).
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver });
  const t = freshTarget();
  ap.apply(baseSnapshot({ snapshotSeq: 1 }), t);
  // Second snapshot has only one enemy, one bullet.
  ap.apply(baseSnapshot({
    snapshotSeq: 2,
    enemies: [{ id: 99, x: 5, y: 5, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }],
    bullets: [],
  }), t);
  ok('wipe: second snapshot replaces enemies (length 1)', t.enemies.length === 1);
  ok('wipe: second snapshot replaces bullets (length 0)', t.bullets.length === 0);
  ok('wipe: new enemy id present', t.enemies[0].eid === 99);
}

// 3. Empty snapshot — arrays empty, no crash.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver });
  const t = freshTarget();
  const r = ap.apply(baseSnapshot({ enemies: [], bullets: [], slots: [] }), t);
  ok('empty: applied=true', r && r.applied === true);
  ok('empty: enemies empty', t.enemies.length === 0);
  ok('empty: bullets empty', t.bullets.length === 0);
}

// 4. Slot match by ID, not array index.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver });
  const t = freshTarget();
  // Snapshot with only slot 1 (host might omit a slot in some flows).
  ap.apply(baseSnapshot({
    slots: [
      { id: 1, x: 999, y: 888, vx: 0, vy: 0, hp: 3, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
    ],
  }), t);
  ok('match-by-id: slot 0 untouched (still x=0)', t.slotsById[0].body.x === 0);
  ok('match-by-id: slot 1 written (x=999)', t.slotsById[1].body.x === 999);
}

// 5. Same-or-older seq → no-op, returns null.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver });
  const t = freshTarget();
  ap.apply(baseSnapshot({ snapshotSeq: 5 }), t);
  ok('seq-skip: lastAppliedSeq=5', ap.getLastAppliedSeq() === 5);
  // Replay same seq.
  const r1 = ap.apply(baseSnapshot({ snapshotSeq: 5, enemies: [] }), t);
  ok('seq-skip: same seq returns null', r1 === null);
  ok('seq-skip: arrays untouched (still 2 enemies)', t.enemies.length === 2);
  // Older seq.
  const r2 = ap.apply(baseSnapshot({ snapshotSeq: 4, enemies: [] }), t);
  ok('seq-skip: older seq returns null', r2 === null);
  ok('seq-skip: arrays untouched (still 2 enemies)', t.enemies.length === 2);
  // Newer seq applies.
  const r3 = ap.apply(baseSnapshot({ snapshotSeq: 6, enemies: [] }), t);
  ok('seq-skip: newer seq applies', r3 && r3.applied);
  ok('seq-skip: arrays now empty', t.enemies.length === 0);
}

// 6. runId change → reset seq tracker, applies even if seq lower.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver });
  const t = freshTarget();
  ap.apply(baseSnapshot({ runId: 'run-A', snapshotSeq: 100 }), t);
  ok('runid-reset: lastRunId=run-A', ap.getLastRunId() === 'run-A');
  // New run with much lower seq still applies.
  const r = ap.apply(baseSnapshot({ runId: 'run-B', snapshotSeq: 1 }), t);
  ok('runid-reset: new run applies even with lower seq', r && r.applied);
  ok('runid-reset: lastRunId=run-B', ap.getLastRunId() === 'run-B');
  ok('runid-reset: lastAppliedSeq=1', ap.getLastAppliedSeq() === 1);
}

// 7. Unknown enemy type — fallback (no throw, defaults applied).
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver });
  const t = freshTarget();
  let threw = false;
  try {
    ap.apply(baseSnapshot({
      enemies: [{ id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'mystery_xyz', fT: 0, fRate: 0 }],
    }), t);
  } catch (_) { threw = true; }
  ok('unknown-type: does not throw', !threw);
  ok('unknown-type: falls back to colorRole=danger', t.enemies[0].colorRole === 'danger');
  ok('unknown-type: type preserved', t.enemies[0].type === 'mystery_xyz');
}

// 8. maxHp safe fallback (no NaN HP bar).
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver });
  const t = freshTarget();
  // maxHp=0 in snapshot — applier should derive safe non-zero default.
  ap.apply(baseSnapshot({
    enemies: [{ id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 3, maxHp: 0, r: 12, type: 'chaser', fT: 0, fRate: 0 }],
  }), t);
  ok('maxHp: zero-on-wire becomes max(hp,1)', t.enemies[0].maxHp === 3);
  ok('maxHp: hp passes through', t.enemies[0].hp === 3);
}

// 9. Bullets carry r, state, type, ownerId, bounces.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver });
  const t = freshTarget();
  ap.apply(baseSnapshot(), t);
  const b0 = t.bullets[0];
  const b1 = t.bullets[1];
  ok('bullet: r preserved', b0.r === 5 && b1.r === 7);
  ok('bullet: state preserved', b0.state === 'output' && b1.state === 'danger');
  ok('bullet: type preserved', b0.type === 'p' && b1.type === 'e');
  ok('bullet: ownerId from ownerSlot', b0.ownerId === 0 && b1.ownerId === 99);
  ok('bullet: bounces preserved', b1.bounces === 1);
  ok('bullet: danger fallback flag', b1.danger === true && b0.danger === false);
}

// 10. Missing slotsById entries — no crash.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver });
  const target = { enemies: [], bullets: [], slotsById: { 0: makeSlot(0) /* slot 1 missing */ } };
  let threw = false;
  try { ap.apply(baseSnapshot(), target); } catch (_) { threw = true; }
  ok('missing-slot: does not throw', !threw);
  ok('missing-slot: slot 0 still applied', target.slotsById[0].body.x === 100);
}

// 11. reset() clears tracker.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver });
  const t = freshTarget();
  ap.apply(baseSnapshot({ snapshotSeq: 50 }), t);
  ok('reset: pre-state seq=50', ap.getLastAppliedSeq() === 50);
  ap.reset();
  ok('reset: lastAppliedSeq null', ap.getLastAppliedSeq() === null);
  ok('reset: lastRunId null', ap.getLastRunId() === null);
  // After reset, even old seq applies.
  const r = ap.apply(baseSnapshot({ snapshotSeq: 1 }), t);
  ok('reset: old seq applies after reset', r && r.applied);
}

// 12. Null/invalid args — null return, no throw.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver });
  const t = freshTarget();
  ok('guard: null snapshot returns null', ap.apply(null, t) === null);
  ok('guard: null target returns null', ap.apply(baseSnapshot(), null) === null);
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
