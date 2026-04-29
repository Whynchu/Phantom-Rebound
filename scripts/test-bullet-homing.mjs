// Tests for applyBulletHoming (R0.4 step 4a).
import { applyBulletHoming } from '../src/systems/bulletRuntime.js';

let passed = 0, failed = 0;
function ok(name, cond, info) {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${info ? ' — ' + info : ''}`); }
}
const approx = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const dt = 1 / 60;
const baseOpts = { homingTier: 1, shotSpd: 1, snipePower: 0, globalSpeedLift: 1.55 };

// Skip cases
{
  const b = { state: 'danger', homing: true, x: 0, y: 0, vx: 100, vy: 0 };
  const r = applyBulletHoming(b, [{ x: 100, y: 100 }], dt, baseOpts);
  ok('non-output state skipped', r === false && b.vx === 100 && b.vy === 0);
}
{
  const b = { state: 'output', homing: false, x: 0, y: 0, vx: 100, vy: 0 };
  const r = applyBulletHoming(b, [{ x: 100, y: 100 }], dt, baseOpts);
  ok('non-homing skipped', r === false && b.vx === 100);
}
{
  const b = { state: 'output', homing: true, x: 0, y: 0, vx: 100, vy: 0 };
  const r = applyBulletHoming(b, [], dt, baseOpts);
  ok('empty enemies skipped', r === false && b.vx === 100);
}
{
  const b = { state: 'output', homing: true, x: 50, y: 50, vx: 100, vy: 0 };
  const r = applyBulletHoming(b, [{ x: 50, y: 50 }], dt, baseOpts);
  ok('zero-distance enemy skipped (no NaN)', r === false && Number.isFinite(b.vx));
}

// Steers toward nearest enemy
{
  const b = { state: 'output', homing: true, x: 0, y: 0, vx: 100, vy: 0 };
  const enemies = [{ x: 1000, y: 0 }, { x: 50, y: 0 }, { x: -200, y: 0 }];
  const r = applyBulletHoming(b, enemies, dt, baseOpts);
  // Nearest is at x=50 (distance 50). Steer along +x. vx grows.
  // homingSteer = 160 + 160*1 = 320; (dx/d)*320*dt = 1*320/60 ≈ 5.33
  ok('steers toward nearest enemy', r === true && approx(b.vx, 100 + 320 / 60));
  ok('vy unchanged when target on x-axis', b.vy === 0);
}

// Tie-breaking: first-encountered wins
{
  const b = { state: 'output', homing: true, x: 0, y: 0, vx: 0, vy: 0 };
  const enemies = [{ x: 100, y: 0 }, { x: 0, y: 100 }]; // both d=100
  applyBulletHoming(b, enemies, dt, baseOpts);
  // First wins (along +x), so vx>0, vy=0.
  ok('tie-breaking: first encountered wins', b.vx > 0 && b.vy === 0);
}

// Speed cap
{
  const b = { state: 'output', homing: true, x: 0, y: 0, vx: 1000, vy: 0 };
  applyBulletHoming(b, [{ x: 100, y: 0 }], dt, baseOpts);
  // maxSp = 230 * 1.55 * 1 * 1 * (1.2 + 0.05) = 230 * 1.55 * 1.25 = 445.625
  const sp = Math.hypot(b.vx, b.vy);
  ok('speed clamped to maxSp', approx(sp, 445.625, 1e-6));
}

// Higher tier => stronger steer + higher cap
{
  const opts3 = { ...baseOpts, homingTier: 3 };
  const b1 = { state: 'output', homing: true, x: 0, y: 0, vx: 0, vy: 0 };
  const b3 = { state: 'output', homing: true, x: 0, y: 0, vx: 0, vy: 0 };
  applyBulletHoming(b1, [{ x: 100, y: 0 }], dt, baseOpts);
  applyBulletHoming(b3, [{ x: 100, y: 0 }], dt, opts3);
  ok('higher tier steers harder', b3.vx > b1.vx);
}

// Determinism — repeated runs identical
{
  function run() {
    const b = { state: 'output', homing: true, x: 12.5, y: 7.25, vx: 50, vy: 30 };
    const enemies = [
      { x: 100, y: 50 }, { x: -40, y: 80 }, { x: 200, y: -150 },
    ];
    for (let i = 0; i < 60; i++) applyBulletHoming(b, enemies, dt, baseOpts);
    return JSON.stringify(b);
  }
  ok('deterministic across runs (60 steps)', run() === run());
}

// Null-safety
{
  let threw = false;
  try {
    applyBulletHoming(null, null, dt, {});
    applyBulletHoming({ state: 'output', homing: true, x: 0, y: 0, vx: 0, vy: 0 }, [null, undefined, null], dt, baseOpts);
  } catch (e) { threw = true; }
  ok('handles null inputs without throwing', !threw);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
