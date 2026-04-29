// D5e — Prediction reconciler tests.
// Validates the input-replay reconciliation buffer.

import { createPredictionReconciler } from '../src/net/predictionReconciler.js';

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (detail ? '  -- ' + detail : '')); }
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); }

console.log('D5e — predictionReconciler');

const SPD = 100; // px/s for predictable math
const DT = 1 / 60;

// 1. Empty history: replay returns auth state when toTick === fromTick.
{
  const rec = createPredictionReconciler({ speedPerSecond: SPD });
  const r = rec.replay({ x: 100, y: 200, vx: 0, vy: 0 }, 50, 50, DT);
  ok('empty: toTick===fromTick returns auth', r.x === 100 && r.y === 200);
}

// 2. Empty history: replay treats missing ticks as inactive (no movement).
{
  const rec = createPredictionReconciler({ speedPerSecond: SPD });
  const r = rec.replay({ x: 100, y: 200, vx: 0, vy: 0 }, 50, 56, DT);
  ok('empty: missing ticks → inactive (no motion)', r.x === 100 && r.y === 200);
  ok('empty: vx/vy zeroed by inactive replay', r.vx === 0 && r.vy === 0);
}

// 3. Single recorded input frame advances position by SPD*dt.
{
  const rec = createPredictionReconciler({ speedPerSecond: SPD });
  rec.record({ tick: 51, dx: 1, dy: 0, t: 1, active: true });
  const r = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 50, 51, DT);
  ok('single: vx=SPD', r.vx === SPD);
  ok('single: x advanced by SPD*dt', near(r.x, SPD * DT));
}

// 4. Multiple inputs accumulate correctly.
{
  const rec = createPredictionReconciler({ speedPerSecond: SPD });
  for (let t = 51; t <= 60; t++) {
    rec.record({ tick: t, dx: 1, dy: 0, t: 1, active: true });
  }
  const r = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 50, 60, DT);
  ok('multi: x advanced by 10*SPD*dt', near(r.x, 10 * SPD * DT));
  ok('multi: y unchanged', r.y === 0);
}

// 5. Inactive frames in the middle: no motion during inactive ticks.
{
  const rec = createPredictionReconciler({ speedPerSecond: SPD });
  rec.record({ tick: 51, dx: 1, dy: 0, t: 1, active: true });
  rec.record({ tick: 52, dx: 0, dy: 0, t: 0, active: false });
  rec.record({ tick: 53, dx: 1, dy: 0, t: 1, active: true });
  const r = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 50, 53, DT);
  ok('inactive: only 2 active ticks moved', near(r.x, 2 * SPD * DT));
}

// 6. World bounds clamp positions during replay.
{
  const rec = createPredictionReconciler({
    speedPerSecond: SPD,
    worldBounds: { left: 0, right: 50, top: 0, bottom: 50 },
  });
  for (let t = 51; t <= 100; t++) {
    rec.record({ tick: t, dx: 1, dy: 0, t: 1, active: true });
  }
  const r = rec.replay({ x: 40, y: 25, vx: 0, vy: 0 }, 50, 100, DT, /*bodyR=*/5);
  ok('clamp: x clamped to right - bodyR', r.x === 45);
}

// 7. Diagonal movement integrates both axes.
{
  const rec = createPredictionReconciler({ speedPerSecond: SPD });
  const ix = Math.SQRT1_2, iy = Math.SQRT1_2;
  rec.record({ tick: 51, dx: ix, dy: iy, t: 1, active: true });
  const r = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 50, 51, DT);
  ok('diag: vx=SPD*ix', near(r.vx, SPD * ix));
  ok('diag: vy=SPD*iy', near(r.vy, SPD * iy));
}

// 8. Half-magnitude joystick (t=0.5) moves at half speed.
{
  const rec = createPredictionReconciler({ speedPerSecond: SPD });
  rec.record({ tick: 51, dx: 1, dy: 0, t: 0.5, active: true });
  const r = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 50, 51, DT);
  ok('half-mag: vx=SPD*0.5', near(r.vx, SPD * 0.5));
  ok('half-mag: x advance halved', near(r.x, 0.5 * SPD * DT));
}

// 9. Auth has initial velocity but inactive replay zeroes it.
{
  const rec = createPredictionReconciler({ speedPerSecond: SPD });
  // No frames recorded.
  const r = rec.replay({ x: 100, y: 100, vx: 50, vy: 50 }, 0, 1, DT);
  ok('auth-vel: replay zeroes vx (inactive frame)', r.vx === 0);
  ok('auth-vel: x unchanged (vx zeroed before integration)', r.x === 100);
}

// 10. Ring-buffer wraparound: frames at very old ticks fall out cleanly.
{
  const rec = createPredictionReconciler({ capacity: 16, speedPerSecond: SPD });
  rec.record({ tick: 5, dx: 1, dy: 0, t: 1, active: true });
  // Record a NEW frame at tick that maps to same slot (5+16=21).
  rec.record({ tick: 21, dx: 0, dy: 1, t: 1, active: true });
  const old = rec.readAt(5);
  ok('wrap: old tick at same slot reads as null (overwritten)', old === null);
  const fresh = rec.readAt(21);
  ok('wrap: new tick reads correctly', fresh && fresh.dy === 1);
}

// 11. readAt for non-existent tick returns null (no false positive from initial buffer).
{
  const rec = createPredictionReconciler({ speedPerSecond: SPD });
  ok('readAt: empty slot null', rec.readAt(100) === null);
  rec.record({ tick: 100, dx: 1, dy: 0, t: 1, active: true });
  ok('readAt: non-recorded tick null', rec.readAt(101) === null);
  ok('readAt: recorded tick returns frame', rec.readAt(100) !== null);
}

// 12. reset() clears all history.
{
  const rec = createPredictionReconciler({ speedPerSecond: SPD });
  for (let t = 0; t < 50; t++) rec.record({ tick: t, dx: 1, dy: 0, t: 1, active: true });
  ok('reset: pre-count > 0', rec.getRecordedCount() === 50);
  rec.reset();
  ok('reset: count zero', rec.getRecordedCount() === 0);
  ok('reset: readAt null after reset', rec.readAt(10) === null);
}

// 13. setWorldBounds applies on next replay.
{
  const rec = createPredictionReconciler({ speedPerSecond: SPD });
  for (let t = 1; t <= 30; t++) {
    rec.record({ tick: t, dx: 1, dy: 0, t: 1, active: true });
  }
  // No bounds — large displacement allowed.
  const free = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 0, 30, DT);
  ok('bounds-free: x ~30*SPD*dt', near(free.x, 30 * SPD * DT));
  // Apply bounds and re-replay.
  rec.setWorldBounds({ left: 0, right: 10, top: 0, bottom: 10 });
  const clamped = rec.replay({ x: 0, y: 5, vx: 0, vy: 0 }, 0, 30, DT, 0);
  ok('bounds-set: x clamped to 10', clamped.x === 10);
}

// 14. Constructor validation.
{
  let threw = false;
  try { createPredictionReconciler({ speedPerSecond: 0 }); } catch (_) { threw = true; }
  ok('ctor: rejects speedPerSecond <= 0', threw);
  threw = false;
  try { createPredictionReconciler({ speedPerSecond: 100, capacity: 4 }); } catch (_) { threw = true; }
  ok('ctor: rejects capacity < 8', threw);
}

// 15. Replay rejects bad dt.
{
  const rec = createPredictionReconciler({ speedPerSecond: SPD });
  let threw = false;
  try { rec.replay({ x: 0, y: 0 }, 0, 5, 0); } catch (_) { threw = true; }
  ok('replay: rejects dt=0', threw);
}

// 16. Replay returns null for null auth.
{
  const rec = createPredictionReconciler({ speedPerSecond: SPD });
  ok('replay: null auth → null', rec.replay(null, 0, 5, DT) === null);
}

// 17. Realistic scenario: 6-tick replay (one snapshot interval at 10 Hz).
{
  const rec = createPredictionReconciler({ speedPerSecond: SPD });
  // Auth at tick 100, host processed up to tick 100, guest at tick 106.
  for (let t = 101; t <= 106; t++) {
    rec.record({ tick: t, dx: 1, dy: 0, t: 1, active: true });
  }
  const r = rec.replay({ x: 200, y: 300, vx: 0, vy: 0 }, 100, 106, DT);
  ok('snapshot-interval: 6 ticks of motion replayed', near(r.x, 200 + 6 * SPD * DT));
  ok('snapshot-interval: y unchanged', r.y === 300);
}

// D19.6b — speedOverride lets caller pass a per-replay speed (e.g.
// after Ghost Velocity boon raises the guest's speedMult).
{
  const rec = createPredictionReconciler({ speedPerSecond: 100 });
  for (let t = 1; t <= 5; t++) {
    rec.record({ tick: t, dx: 1, dy: 0, t: 1, active: true });
  }
  const baseline = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 0, 5, DT);
  ok('speedOverride: baseline matches construction speed', near(baseline.x, 5 * 100 * DT));
  const fast = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 0, 5, DT, 0, 200);
  ok('speedOverride: 200 doubles travel', near(fast.x, 5 * 200 * DT));
  const slow = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 0, 5, DT, 0, 50);
  ok('speedOverride: 50 halves travel', near(slow.x, 5 * 50 * DT));
  // Falsy/invalid override falls through to construction speed.
  const fallback = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 0, 5, DT, 0, null);
  ok('speedOverride: null falls back to construction speed', near(fallback.x, 5 * 100 * DT));
  const zeroFallback = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 0, 5, DT, 0, 0);
  ok('speedOverride: 0 falls back (treated as invalid)', near(zeroFallback.x, 5 * 100 * DT));
  const negFallback = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 0, 5, DT, 0, -50);
  ok('speedOverride: negative falls back', near(negFallback.x, 5 * 100 * DT));
}

// D19.6c — resolveCollision callback runs per replay tick and may mutate
// the entity x/y in-place (matching script.js resolveEntityObstacleCollisions).
{
  const rec = createPredictionReconciler({ speedPerSecond: 100 });
  for (let t = 1; t <= 5; t++) rec.record({ tick: t, dx: 1, dy: 0, t: 1, active: true });

  // No callback → bit-identical to baseline.
  const noCb = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 0, 5, DT);
  ok('resolveCollision: omitted leaves replay unchanged', near(noCb.x, 5 * 100 * DT));

  // Callback that clamps x to a wall at x=2 → final x must be ≤2.
  let calls = 0;
  const wall = (e) => { calls++; if (e.x > 2) e.x = 2; };
  const clamped = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 0, 5, DT, 0, null, wall);
  ok('resolveCollision: per-tick clamp pins x at wall', near(clamped.x, 2));
  ok('resolveCollision: callback invoked once per replayed tick', calls === 5);

  // Sliding: input is diagonal, callback only blocks x — y still advances.
  const rec2 = createPredictionReconciler({ speedPerSecond: 100 });
  for (let t = 1; t <= 5; t++) rec2.record({ tick: t, dx: 0.7071, dy: 0.7071, t: 1, active: true });
  const slideWall = (e) => { if (e.x > 1) e.x = 1; };
  const slid = rec2.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 0, 5, DT, 0, null, slideWall);
  ok('resolveCollision: slide x clamps at wall', near(slid.x, 1));
  ok('resolveCollision: slide y still advances', slid.y > 0.5);

  // Throwing callback must not crash replay (try/catch swallows).
  const boom = () => { throw new Error('boom'); };
  const survived = rec.replay({ x: 0, y: 0, vx: 0, vy: 0 }, 0, 5, DT, 0, null, boom);
  ok('resolveCollision: throwing callback does not break replay', survived && Number.isFinite(survived.x));
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
