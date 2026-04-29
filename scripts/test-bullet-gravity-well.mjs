// Tests for applyDangerGravityWell (R0.4 step 4b).
import { applyDangerGravityWell } from '../src/systems/bulletRuntime.js';

let passed = 0, failed = 0;
function ok(name, cond, info) {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${info ? ' — ' + info : ''}`); }
}
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

const dt = 1 / 60;

// Skip: non-danger
{
  const b = { state: 'output', x: 0, y: 0, vx: 100, vy: 0 };
  const r = applyDangerGravityWell(b, { x: 50, y: 0 }, dt, { gravityWell: true });
  ok('non-danger skipped', r === false && b.vx === 100);
}

// Skip: no gravityWell flag
{
  const b = { state: 'danger', x: 0, y: 0, vx: 100, vy: 0 };
  const r = applyDangerGravityWell(b, { x: 50, y: 0 }, dt, { gravityWell: false });
  ok('processed but no field when flag off', r === true && b.vx === 100 && b.vy === 0);
}

// Enter field captures baseSpeed
{
  const b = { state: 'danger', x: 0, y: 0, vx: 200, vy: 0 };
  applyDangerGravityWell(b, { x: 50, y: 0 }, dt, { gravityWell: true });
  ok('baseSpeed captured on field entry', b.gravityWellBaseSpeed === 200);
  ok('speed decreasing toward 0.55*base', Math.hypot(b.vx, b.vy) < 200);
  ok('speed >= 40 floor still respected', Math.hypot(b.vx, b.vy) > 40);
}

// Floor = 40 when baseSpeed < ~73
{
  const b = { state: 'danger', x: 0, y: 0, vx: 50, vy: 0 };
  applyDangerGravityWell(b, { x: 50, y: 0 }, dt, { gravityWell: true });
  // baseSpeed=50, target=max(40, 50*0.55=27.5)=40
  // After many ticks, speed should asymptote to 40.
  for (let i = 0; i < 600; i++) applyDangerGravityWell(b, { x: 50, y: 0 }, dt, { gravityWell: true });
  ok('speed asymptotes to 40 floor in-field', approx(Math.hypot(b.vx, b.vy), 40, 1e-3));
}

// Out-of-field recovery
{
  const b = { state: 'danger', x: 0, y: 0, vx: 60, vy: 0, gravityWellBaseSpeed: 200 };
  // Far from player, gravityWell=true but out of range
  for (let i = 0; i < 600; i++) applyDangerGravityWell(b, { x: 1000, y: 1000 }, dt, { gravityWell: true });
  ok('speed recovers toward baseSpeed', approx(Math.hypot(b.vx, b.vy), 200, 2));
  ok('baseSpeed cleared after recovery', !('gravityWellBaseSpeed' in b));
}

// In-field then out: re-enters and re-applies
{
  const b = { state: 'danger', x: 0, y: 0, vx: 200, vy: 0 };
  // In field
  for (let i = 0; i < 60; i++) applyDangerGravityWell(b, { x: 30, y: 0 }, dt, { gravityWell: true });
  const slowedSpeed = Math.hypot(b.vx, b.vy);
  ok('slowed in field', slowedSpeed < 200 && slowedSpeed >= 40);
  // Out of field — recovers
  for (let i = 0; i < 600; i++) applyDangerGravityWell(b, { x: 1000, y: 0 }, dt, { gravityWell: true });
  ok('recovers when leaving field', approx(Math.hypot(b.vx, b.vy), 200, 2));
}

// Direction preserved (no rotation)
{
  const b = { state: 'danger', x: 0, y: 0, vx: 80, vy: 60 }; // angle atan2(60,80)
  const angBefore = Math.atan2(b.vy, b.vx);
  applyDangerGravityWell(b, { x: 50, y: 0 }, dt, { gravityWell: true });
  const angAfter = Math.atan2(b.vy, b.vx);
  ok('direction unchanged by gravity well', approx(angBefore, angAfter, 1e-9));
}

// Determinism
{
  function run() {
    const b = { state: 'danger', x: 5, y: 7, vx: 137.5, vy: -42.25 };
    for (let i = 0; i < 60; i++) {
      applyDangerGravityWell(b, { x: 60, y: 30 }, dt, { gravityWell: true });
    }
    return JSON.stringify(b);
  }
  ok('deterministic across runs', run() === run());
}

// Stationary bullet — no NaN
{
  const b = { state: 'danger', x: 0, y: 0, vx: 0, vy: 0 };
  applyDangerGravityWell(b, { x: 50, y: 0 }, dt, { gravityWell: true });
  ok('stationary bullet does not produce NaN', Number.isFinite(b.vx) && Number.isFinite(b.vy));
}

// Null-safety
{
  let threw = false;
  try {
    applyDangerGravityWell(null, null, dt, {});
    applyDangerGravityWell({ state: 'danger', x: 0, y: 0, vx: 100, vy: 0 }, null, dt, { gravityWell: true });
  } catch (e) { threw = true; }
  ok('null-safe inputs', !threw);
}

// Custom range
{
  const b = { state: 'danger', x: 0, y: 0, vx: 200, vy: 0 };
  // dist=150, range default=96 → out; range=200 → in
  applyDangerGravityWell(b, { x: 150, y: 0 }, dt, { gravityWell: true, range: 200 });
  ok('custom range respected', b.gravityWellBaseSpeed === 200);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
