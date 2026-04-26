// D5c — Snapshot applier (interpolating) tests.
// Validates the guest-side applier with 2-snapshot buffer + upsert-by-id.

import { createSnapshotApplier } from '../src/net/snapshotApplier.js';
import { encodeSnapshot } from '../src/net/coopSnapshot.js';

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (detail ? '  -- ' + detail : '')); }
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); }

console.log('D5c — snapshotApplier (interpolating)');

const ENEMY_DEFS = {
  chaser: { label: 'Buster', colorRole: 'danger', isElite: false, r: 12, spd: 100, fRate: 1500 },
  triangle: { label: 'Trigon', colorRole: 'aggressive', isTriangle: true, isElite: false, r: 12, spd: 130 },
};
const colorResolver = (type) => ({ col: '#abc', glowCol: 'rgba(0,0,0,0.5)' });

function makeSlot(id) {
  const body = { x: 0, y: 0, vx: 0, vy: 0, r: 14, invincible: 0, deadAt: 0 };
  const upg = { maxCharge: 100 };
  const metrics = { hp: 0, maxHp: 0, charge: 0, stillTimer: 0 };
  const aim = { angle: 0, hasTarget: false };
  return { id, body, upg, metrics, aim, getBody: () => body, getUpg: () => upg };
}

function freshTarget() {
  return { enemies: [], bullets: [], slotsById: { 0: makeSlot(0), 1: makeSlot(1) } };
}

// Build a snapshot with overrides applied to the canonical fixture.
function snap(overrides = {}) {
  const base = {
    runId: 'run-1',
    snapshotSeq: 1,
    snapshotSimTick: 60,
    lastProcessedInputSeq: { 0: 10, 1: 11 },
    slots: [
      { id: 0, x: 100, y: 200, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 25, maxCharge: 100, aimAngle: 0.5, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 300, y: 400, vx: 0, vy: 0, hp: 4, maxHp: 5, charge: 60, maxCharge: 100, aimAngle: 1.5, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
    ],
    bullets: [
      { id: 1, x: 50, y: 60, vx: 0, vy: 0, r: 5, type: 'p', state: 'output', ownerSlot: 0, bounces: 0, spawnTick: 1 },
    ],
    enemies: [
      { id: 1, x: 10, y: 20, vx: 0, vy: 0, hp: 3, maxHp: 5, r: 12, type: 'chaser', fT: 0, fRate: 1500 },
    ],
    room: { index: 5, phase: 'fighting', clearTimer: 0, spawnQueueLen: 0 },
    score: 100,
    elapsedMs: 0,
  };
  return encodeSnapshot({ ...base, ...overrides });
}

// ── Tests ────────────────────────────────────────────────────────────────

// 1. First snapshot — snap to curr, no interp (no prev yet).
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  const r = ap.apply(snap(), t, { snapshotRecvAtMs: 1000, renderTimeMs: 1100 });
  ok('first: applied=true', r && r.applied);
  ok('first: alpha=1 (no prev)', r.alpha === 1);
  ok('first: interpolated=false', r.interpolated === false);
  ok('first: enemy at curr position', t.enemies[0].x === 10 && t.enemies[0].y === 20);
  ok('first: slot 0 body x=100', t.slotsById[0].body.x === 100);
  ok('first: bufferDepth=1', ap.getBufferDepth() === 1);
}

// 2. Second snapshot, mid-window interpolation. enemy moves (10,20)→(110,120).
//    prev recvAt=1000, curr recvAt=1100. renderTime=1200, delay=100 ⇒ targetT=1100 (==curr).
//    That equals curr exactly, so alpha=1. To exercise the lerp, render at 1150.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({ snapshotSeq: 1, enemies: [{ id: 1, x: 10, y: 20, vx: 0, vy: 0, hp: 3, maxHp: 5, r: 12, type: 'chaser', fT: 0, fRate: 1500 }] }), t,
    { snapshotRecvAtMs: 1000, renderTimeMs: 1000 });
  const r = ap.apply(snap({ snapshotSeq: 2, enemies: [{ id: 1, x: 110, y: 120, vx: 0, vy: 0, hp: 3, maxHp: 5, r: 12, type: 'chaser', fT: 0, fRate: 1500 }] }), t,
    { snapshotRecvAtMs: 1100, renderTimeMs: 1150 });
  ok('lerp: bufferDepth=2', ap.getBufferDepth() === 2);
  ok('lerp: interpolated=true', r.interpolated === true);
  // targetT = 1150 - 100 = 1050. alpha = (1050-1000)/(1100-1000) = 0.5.
  ok('lerp: alpha~0.5', near(r.alpha, 0.5));
  ok('lerp: enemy x lerped to 60', near(t.enemies[0].x, 60));
  ok('lerp: enemy y lerped to 70', near(t.enemies[0].y, 70));
}

// 3. Slot body lerp.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({
    snapshotSeq: 1,
    slots: [
      { id: 0, x: 0, y: 0, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 100, y: 100, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
    ],
  }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ap.apply(snap({
    snapshotSeq: 2,
    slots: [
      { id: 0, x: 200, y: 200, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 300, y: 300, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
    ],
  }), t, { snapshotRecvAtMs: 100, renderTimeMs: 150 });
  // targetT = 50, alpha = (50-0)/(100-0) = 0.5.
  ok('slot-lerp: slot 1 body x=200 (lerp 100→300 at 0.5)', near(t.slotsById[1].body.x, 200));
  ok('slot-lerp: slot 0 body x=100 (lerp 0→200 at 0.5)', near(t.slotsById[0].body.x, 100));
}

// 4. Aim angle lerp uses shortest arc (wraps over ±π).
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({
    snapshotSeq: 1,
    slots: [
      { id: 0, x: 0, y: 0, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 3.0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
    ],
  }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  // From 3.0 (≈π-0.14) wrapping to -3.0 — shortest arc goes the SHORT way through π
  // (delta ≈ +0.28 rad), not the long way (≈ -6 rad).
  ap.apply(snap({
    snapshotSeq: 2,
    slots: [
      { id: 0, x: 0, y: 0, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: -3.0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
    ],
  }), t, { snapshotRecvAtMs: 100, renderTimeMs: 150 });
  // alpha=0.5. Expected: 3.0 + 0.5*0.2832... ≈ 3.1416 (≈π). NOT a long-way value (~0).
  const a = t.slotsById[0].aim.angle;
  ok('aim: shortest-arc lerp (≈π, not 0)', Math.abs(Math.abs(a) - Math.PI) < 0.05, 'got ' + a);
}

// 5. Despawn — id in prev, missing in curr → not in target after apply.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({
    snapshotSeq: 1,
    enemies: [
      { id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 },
      { id: 2, x: 50, y: 50, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 },
    ],
  }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ap.apply(snap({
    snapshotSeq: 2,
    enemies: [
      { id: 1, x: 100, y: 100, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 },
    ],
  }), t, { snapshotRecvAtMs: 100, renderTimeMs: 250 });
  ok('despawn: only id=1 remains', t.enemies.length === 1 && t.enemies[0].eid === 1);
}

// 6. Spawn — id in curr, missing in prev → present at curr position (no lerp).
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({ snapshotSeq: 1, enemies: [] }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ap.apply(snap({
    snapshotSeq: 2,
    enemies: [{ id: 5, x: 999, y: 888, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }],
  }), t, { snapshotRecvAtMs: 100, renderTimeMs: 150 });
  ok('spawn: new id present', t.enemies.length === 1 && t.enemies[0].eid === 5);
  ok('spawn: at curr position (no prev to lerp from)', t.enemies[0].x === 999 && t.enemies[0].y === 888);
}

// 7. RenderTime past curr (extrapolation skipped) → snap to curr (alpha=1).
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({ snapshotSeq: 1, enemies: [{ id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }] }), t,
    { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ap.apply(snap({ snapshotSeq: 2, enemies: [{ id: 1, x: 200, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }] }), t,
    { snapshotRecvAtMs: 100, renderTimeMs: 1000 });
  // targetT = 900, way past curr (100). Snap to curr.
  ok('extrapolate-skip: snap to curr (x=200)', t.enemies[0].x === 200);
}

// 8. RenderTime before prev → alpha=0 (snap to prev).
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({ snapshotSeq: 1, enemies: [{ id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }] }), t,
    { snapshotRecvAtMs: 1000, renderTimeMs: 1000 });
  ap.apply(snap({ snapshotSeq: 2, enemies: [{ id: 1, x: 200, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }] }), t,
    { snapshotRecvAtMs: 1100, renderTimeMs: 1050 });
  // targetT = 950. prev.recvAt = 1000. targetT < prev.recvAt → alpha=0, snap to prev x=0.
  ok('clamp-low: snap to prev x=0', t.enemies[0].x === 0);
}

// 9. Same seq replay does NOT shift buffer; subsequent calls re-render at advancing time.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({ snapshotSeq: 1, enemies: [{ id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }] }), t,
    { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ap.apply(snap({ snapshotSeq: 2, enemies: [{ id: 1, x: 100, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }] }), t,
    { snapshotRecvAtMs: 100, renderTimeMs: 150 });
  ok('same-seq: bufferDepth=2 after first new snapshot', ap.getBufferDepth() === 2);
  // Now call apply again with the SAME (seq=2) snapshot — re-render at advancing time.
  const sameSnap = snap({ snapshotSeq: 2, enemies: [{ id: 1, x: 100, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }] });
  const r = ap.apply(sameSnap, t, { renderTimeMs: 175 });
  ok('same-seq: still applied (returns object, not null)', r && r.applied);
  ok('same-seq: bufferDepth still 2 (no shift)', ap.getBufferDepth() === 2);
  // targetT = 75, alpha = 0.75 → x = 75.
  ok('same-seq: re-renders at advancing alpha (x=75)', near(t.enemies[0].x, 75));
}

// 10. Older seq → no shift (buffer protected); still re-renders against existing curr.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({ snapshotSeq: 5, enemies: [{ id: 1, x: 100, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }] }), t,
    { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ok('older-seq: lastAppliedSeq=5', ap.getLastAppliedSeq() === 5);
  // Now feed seq=3 (older). Buffer should NOT shift.
  ap.apply(snap({ snapshotSeq: 3, enemies: [{ id: 1, x: 999, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }] }), t,
    { snapshotRecvAtMs: 50, renderTimeMs: 50 });
  ok('older-seq: lastAppliedSeq still 5', ap.getLastAppliedSeq() === 5);
  ok('older-seq: render uses curr (x=100)', t.enemies[0].x === 100);
}

// 11. runId change — buffer resets; new run renders at curr (no stale interp).
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({ runId: 'A', snapshotSeq: 100, enemies: [{ id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }] }), t,
    { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ap.apply(snap({ runId: 'A', snapshotSeq: 101, enemies: [{ id: 1, x: 100, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }] }), t,
    { snapshotRecvAtMs: 100, renderTimeMs: 150 });
  ok('runid: bufferDepth=2 mid-run', ap.getBufferDepth() === 2);
  // New run.
  const r = ap.apply(snap({ runId: 'B', snapshotSeq: 1, enemies: [{ id: 9, x: 555, y: 555, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }] }), t,
    { snapshotRecvAtMs: 200, renderTimeMs: 250 });
  ok('runid: new runId resets prev (bufferDepth=1)', ap.getBufferDepth() === 1);
  ok('runid: new run snaps to curr (alpha=1)', r.alpha === 1 && r.interpolated === false);
  ok('runid: target only has new run\'s enemy', t.enemies.length === 1 && t.enemies[0].eid === 9);
  ok('runid: lastRunId=B', ap.getLastRunId() === 'B');
}

// 12. No renderTimeMs → snap to curr (D5b-compatible fallback).
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({ snapshotSeq: 1, enemies: [{ id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }] }), t);
  ap.apply(snap({ snapshotSeq: 2, enemies: [{ id: 1, x: 200, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'chaser', fT: 0, fRate: 0 }] }), t);
  ok('no-rendertime: snap to curr (x=200)', t.enemies[0].x === 200);
}

// 13. Unknown enemy type — falls back, doesn't throw.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  let threw = false;
  try {
    ap.apply(snap({ enemies: [{ id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, type: 'mystery', fT: 0, fRate: 0 }] }), t,
      { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  } catch (_) { threw = true; }
  ok('unknown-type: no throw', !threw);
  ok('unknown-type: type preserved', t.enemies[0].type === 'mystery');
  ok('unknown-type: colorRole defaults to danger', t.enemies[0].colorRole === 'danger');
}

// 14. Bullets carry r/state/ownerId/bounces; danger fallback flag.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({
    snapshotSeq: 1,
    bullets: [
      { id: 1, x: 0, y: 0, vx: 0, vy: 0, r: 5, type: 'p', state: 'output', ownerSlot: 0, bounces: 0, spawnTick: 1 },
      { id: 2, x: 0, y: 0, vx: 0, vy: 0, r: 7, type: 'e', state: 'danger', ownerSlot: 99, bounces: 1, spawnTick: 2 },
    ],
  }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ok('bullet: r preserved', t.bullets[0].r === 5 && t.bullets[1].r === 7);
  ok('bullet: state preserved', t.bullets[0].state === 'output' && t.bullets[1].state === 'danger');
  ok('bullet: danger fallback flag', t.bullets[1].danger === true && t.bullets[0].danger === false);
  ok('bullet: ownerId from ownerSlot', t.bullets[0].ownerId === 0 && t.bullets[1].ownerId === 99);
  ok('bullet: bounces preserved', t.bullets[1].bounces === 1);
}

// 15. Bullet position lerp.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({ snapshotSeq: 1, bullets: [{ id: 1, x: 0, y: 0, vx: 0, vy: 0, r: 5, type: 'p', state: 'output', ownerSlot: 0, bounces: 0, spawnTick: 1 }] }), t,
    { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ap.apply(snap({ snapshotSeq: 2, bullets: [{ id: 1, x: 100, y: 0, vx: 0, vy: 0, r: 5, type: 'p', state: 'output', ownerSlot: 0, bounces: 0, spawnTick: 1 }] }), t,
    { snapshotRecvAtMs: 100, renderTimeMs: 150 });
  ok('bullet-lerp: x=50 (alpha=0.5)', near(t.bullets[0].x, 50));
}

// 16. maxHp safe fallback (no NaN HP bar).
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({ enemies: [{ id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 3, maxHp: 0, r: 12, type: 'chaser', fT: 0, fRate: 0 }] }), t,
    { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ok('maxHp: zero on wire becomes max(hp,1)', t.enemies[0].maxHp === 3);
}

// 17. reset() clears buffer + tracker.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({ snapshotSeq: 50 }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ok('reset: pre-state seq=50', ap.getLastAppliedSeq() === 50);
  ap.reset();
  ok('reset: bufferDepth=0', ap.getBufferDepth() === 0);
  ok('reset: lastAppliedSeq=null', ap.getLastAppliedSeq() === null);
  // After reset, even old seq applies cleanly.
  const r = ap.apply(snap({ snapshotSeq: 1 }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ok('reset: old seq applies after reset', r && r.applied);
}

// 18. Null/invalid args.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver });
  const t = freshTarget();
  ok('guard: null target returns null', ap.apply(snap(), null) === null);
  // null snapshot before any curr buffered → null.
  ok('guard: null snapshot, no buffer → null', ap.apply(null, t) === null);
  // After we buffer one, null snapshot should still re-render (advance time)
  // because curr exists. It just shouldn't crash.
  ap.apply(snap({ snapshotSeq: 1 }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  let threw = false;
  try { ap.apply(null, t, { renderTimeMs: 50 }); } catch (_) { threw = true; }
  ok('guard: null snapshot with buffered curr does not throw', !threw);
}

// 19. HP/charge/maxCharge come from curr (NOT lerped).
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({
    snapshotSeq: 1,
    slots: [
      { id: 0, x: 0, y: 0, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
    ],
  }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ap.apply(snap({
    snapshotSeq: 2,
    slots: [
      { id: 0, x: 0, y: 0, vx: 0, vy: 0, hp: 3, maxHp: 5, charge: 80, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
    ],
  }), t, { snapshotRecvAtMs: 100, renderTimeMs: 150 });
  ok('discrete: hp from curr (3, not 4)', t.slotsById[0].metrics.hp === 3);
  // D18.13 — charge LERPS for small deltas, SNAPS for big deltas (>50% of
  // maxCharge), preserving smooth fill while preventing fake-ramp glitches
  // on room resets / boon applications. delta=80 of max=100 = 80% > 50%
  // threshold, so snap to curr (80).
  ok('lerp: big-jump snaps to curr (80, not 40)', t.slotsById[0].metrics.charge === 80);
}

// 19b. D18.13 — charge lerp with a SMALL delta (within 50% of maxCharge)
//      should interpolate at render-rate.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({
    snapshotSeq: 1,
    slots: [
      { id: 0, x: 0, y: 0, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 20, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
    ],
  }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ap.apply(snap({
    snapshotSeq: 2,
    slots: [
      { id: 0, x: 0, y: 0, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 60, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 0, y: 0, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
    ],
  }), t, { snapshotRecvAtMs: 100, renderTimeMs: 150 });
  // delta=40 of max=100 = 40% < 50% threshold, so lerp at alpha=0.5
  ok('lerp: small-delta interpolates (40 between 20 and 60 at alpha=0.5)', t.slotsById[0].metrics.charge === 40);
}

// 20. predictedSlotId: continuous body writes are skipped for the predicted
//     slot; aim, hp, charge, invulnT come from snapshot. Other slots
//     interpolate as normal.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100, predictedSlotId: 1 });
  const t = freshTarget();
  // First snapshot — anchor (no prev). Predicted slot still gets initial
  // body write so the placeholder body lands somewhere sensible.
  ap.apply(snap({ snapshotSeq: 1 }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ok('predict: first snap anchors slot 1 body', t.slotsById[1].body.x === 300 && t.slotsById[1].body.y === 400);
  // Now simulate local prediction moving the body.
  t.slotsById[1].body.x = 999;
  t.slotsById[1].body.y = 888;
  // Second snapshot, alive unchanged — applier should NOT overwrite slot 1
  // body, but SHOULD update slot 0 (not predicted) and aim/hp/charge.
  ap.apply(snap({
    snapshotSeq: 2,
    slots: [
      { id: 0, x: 150, y: 250, vx: 5, vy: 6, hp: 5, maxHp: 5, charge: 25, maxCharge: 100, aimAngle: 0.5, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 350, y: 450, vx: 7, vy: 8, hp: 2, maxHp: 5, charge: 90, maxCharge: 100, aimAngle: 2.0, invulnT: 0.4, shieldT: 0, stillTimer: 0, alive: true },
    ],
  }), t, { snapshotRecvAtMs: 100, renderTimeMs: 200 });
  ok('predict: slot 1 body x preserved (999, not 350)', t.slotsById[1].body.x === 999);
  ok('predict: slot 1 body y preserved (888, not 450)', t.slotsById[1].body.y === 888);
  ok('predict: slot 1 hp from curr (2)', t.slotsById[1].metrics.hp === 2);
  ok('predict: slot 1 charge from curr (90)', t.slotsById[1].metrics.charge === 90);
  ok('predict: slot 1 invincible from curr (0.4)', t.slotsById[1].body.invincible === 0.4);
  ok('predict: slot 1 aim updated from snapshot', near(t.slotsById[1].aim.angle, 2.0));
  // Slot 0 (not predicted) should be lerped — snap-to-curr at alpha=1 here.
  ok('predict: slot 0 (non-predicted) body x lerped', t.slotsById[0].body.x === 150);
}

// 21. predictedSlotId: alive→dead edge re-anchors body and zeroes velocity.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100, predictedSlotId: 1 });
  const t = freshTarget();
  ap.apply(snap({ snapshotSeq: 1 }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  // Local prediction moves body and gives it velocity.
  t.slotsById[1].body.x = 700;
  t.slotsById[1].body.y = 600;
  t.slotsById[1].body.vx = 50;
  t.slotsById[1].body.vy = -25;
  ap.apply(snap({
    snapshotSeq: 2,
    slots: [
      { id: 0, x: 100, y: 200, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 25, maxCharge: 100, aimAngle: 0.5, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 320, y: 420, vx: 0, vy: 0, hp: 0, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 1.5, invulnT: 0, shieldT: 0, stillTimer: 0, alive: false },
    ],
  }), t, { snapshotRecvAtMs: 100, renderTimeMs: 200 });
  ok('predict: alive→dead re-anchors body to curr', t.slotsById[1].body.x === 320 && t.slotsById[1].body.y === 420);
  ok('predict: alive→dead zeroes vx/vy', t.slotsById[1].body.vx === 0 && t.slotsById[1].body.vy === 0);
  ok('predict: alive→dead sets deadAt', t.slotsById[1].body.deadAt === 1);
}

// 22. predictedSlotId: dead→alive edge re-anchors body (respawn).
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100, predictedSlotId: 1 });
  const t = freshTarget();
  ap.apply(snap({
    snapshotSeq: 1,
    slots: [
      { id: 0, x: 100, y: 200, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 300, y: 400, vx: 0, vy: 0, hp: 0, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: false },
    ],
  }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  // Stale predicted body somewhere weird.
  t.slotsById[1].body.x = 50;
  t.slotsById[1].body.y = 50;
  t.slotsById[1].body.vx = 30;
  ap.apply(snap({
    snapshotSeq: 2,
    slots: [
      { id: 0, x: 100, y: 200, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 250, y: 350, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 0, maxCharge: 100, aimAngle: 0, invulnT: 0.5, shieldT: 0, stillTimer: 0, alive: true },
    ],
  }), t, { snapshotRecvAtMs: 100, renderTimeMs: 200 });
  ok('predict: dead→alive (respawn) re-anchors body', t.slotsById[1].body.x === 250 && t.slotsById[1].body.y === 350);
  ok('predict: dead→alive zeroes velocity', t.slotsById[1].body.vx === 0 && t.slotsById[1].body.vy === 0);
  ok('predict: respawn clears deadAt', t.slotsById[1].body.deadAt === 0);
}

// 23. predictedSlotId: runId reset re-anchors (prev cleared, next snap = first).
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100, predictedSlotId: 1 });
  const t = freshTarget();
  ap.apply(snap({ snapshotSeq: 1 }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ap.apply(snap({ snapshotSeq: 2 }), t, { snapshotRecvAtMs: 100, renderTimeMs: 200 });
  // Local prediction owns body.
  t.slotsById[1].body.x = 999;
  t.slotsById[1].body.y = 888;
  // New runId — buffer reset, next call is "first snapshot" again.
  ap.apply(snap({ runId: 'run-2', snapshotSeq: 1 }), t, { snapshotRecvAtMs: 200, renderTimeMs: 300 });
  ok('predict: runId reset re-anchors slot 1 body', t.slotsById[1].body.x === 300 && t.slotsById[1].body.y === 400);
}

// 24. predictedSlotId=null (default): all slots interpolate normally.
{
  const ap = createSnapshotApplier({ enemyTypeDefs: ENEMY_DEFS, resolveColors: colorResolver, renderDelayMs: 100 });
  const t = freshTarget();
  ap.apply(snap({ snapshotSeq: 1 }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  // Pretend something moved slot 1 body locally — applier should clobber.
  t.slotsById[1].body.x = 999;
  ap.apply(snap({
    snapshotSeq: 2,
    slots: [
      { id: 0, x: 100, y: 200, vx: 0, vy: 0, hp: 5, maxHp: 5, charge: 25, maxCharge: 100, aimAngle: 0.5, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
      { id: 1, x: 350, y: 400, vx: 0, vy: 0, hp: 4, maxHp: 5, charge: 60, maxCharge: 100, aimAngle: 1.5, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true },
    ],
  }), t, { snapshotRecvAtMs: 100, renderTimeMs: 200 });
  ok('default: slot 1 body x clobbered by snapshot', t.slotsById[1].body.x === 350);
}

// 25. onEnemyDamage fires once per fresh snapshot hp drop.
{
  const events = [];
  const ap = createSnapshotApplier({
    enemyTypeDefs: ENEMY_DEFS,
    resolveColors: colorResolver,
    renderDelayMs: 100,
    onEnemyDamage: (ev) => events.push(ev),
  });
  const t = freshTarget();
  ap.apply(snap({
    snapshotSeq: 1,
    enemies: [{ id: 9, x: 50, y: 70, vx: 0, vy: 0, hp: 5, maxHp: 5, r: 12, type: 'chaser', fT: 0, fRate: 0 }],
  }), t, { snapshotRecvAtMs: 0, renderTimeMs: 0 });
  ap.apply(snap({
    snapshotSeq: 2,
    enemies: [{ id: 9, x: 55, y: 75, vx: 0, vy: 0, hp: 2, maxHp: 5, r: 12, type: 'chaser', fT: 0, fRate: 0 }],
  }), t, { snapshotRecvAtMs: 100, renderTimeMs: 200 });
  ap.apply(snap({
    snapshotSeq: 2,
    enemies: [{ id: 9, x: 55, y: 75, vx: 0, vy: 0, hp: 2, maxHp: 5, r: 12, type: 'chaser', fT: 0, fRate: 0 }],
  }), t, { snapshotRecvAtMs: 100, renderTimeMs: 250 });
  ok('enemy-damage: one event for one fresh hp drop', events.length === 1);
  ok('enemy-damage: reports drop amount', events[0] && events[0].damage === 3);
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
