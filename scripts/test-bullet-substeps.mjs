// Unit tests for advanceBulletWithSubsteps (R0.4 step 4c).
import { advanceBulletWithSubsteps } from '../src/systems/bulletRuntime.js';

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log('  ok ', label); }
  else { fail++; console.log('  FAIL', label); }
}
function approx(a, b, eps = 1e-6) { return Math.abs(a - b) <= eps; }

const W = 1000, H = 800, M = 20;
const noObstacle = () => false;

// 1. null-safe inputs
ok('null bullet returns false', advanceBulletWithSubsteps(null, 0.016, { W, H, M, resolveObstacleCollision: noObstacle }) === false);
ok('null opts returns false', advanceBulletWithSubsteps({ x: 100, y: 100, r: 4, vx: 0, vy: 0 }, 0.016, null) === false);
ok('missing W returns false', advanceBulletWithSubsteps({ x: 100, y: 100, r: 4, vx: 0, vy: 0 }, 0.016, { H, M }) === false);

// 2. simple translation, no bounce
{
  const b = { x: 100, y: 100, r: 4, vx: 200, vy: 0 };
  const bounced = advanceBulletWithSubsteps(b, 0.016, { W, H, M, resolveObstacleCollision: noObstacle });
  ok('translates by vx*dt with no bounce', !bounced && approx(b.x, 100 + 200 * 0.016, 1e-9));
  ok('y unchanged when vy=0', approx(b.y, 100, 1e-9));
}

// 3. left wall bounce
{
  const b = { x: M + 1, y: 400, r: 4, vx: -500, vy: 0 };
  const bounced = advanceBulletWithSubsteps(b, 0.1, { W, H, M, resolveObstacleCollision: noObstacle });
  ok('left wall: bounced=true', bounced === true);
  ok('left wall: vx flipped to positive', b.vx > 0);
  ok('left wall: x clamped to >= M+r', b.x >= M + b.r);
}

// 4. right wall bounce
{
  const b = { x: W - M - 1, y: 400, r: 4, vx: 500, vy: 0 };
  const bounced = advanceBulletWithSubsteps(b, 0.1, { W, H, M, resolveObstacleCollision: noObstacle });
  ok('right wall: bounced=true', bounced === true);
  ok('right wall: vx flipped to negative', b.vx < 0);
  ok('right wall: x clamped to <= W-M-r', b.x <= W - M - b.r);
}

// 5. top wall bounce
{
  const b = { x: 500, y: M + 1, r: 4, vx: 0, vy: -500 };
  const bounced = advanceBulletWithSubsteps(b, 0.1, { W, H, M, resolveObstacleCollision: noObstacle });
  ok('top wall bounces y', bounced && b.vy > 0 && b.y >= M + b.r);
}

// 6. bottom wall bounce
{
  const b = { x: 500, y: H - M - 1, r: 4, vx: 0, vy: 500 };
  const bounced = advanceBulletWithSubsteps(b, 0.1, { W, H, M, resolveObstacleCollision: noObstacle });
  ok('bottom wall bounces y', bounced && b.vy < 0 && b.y <= H - M - b.r);
}

// 7. obstacle collision callback
{
  const b = { x: 100, y: 100, r: 4, vx: 200, vy: 0 };
  let called = 0;
  const resolveObstacleCollision = (bb) => { called++; return false; };
  const bounced = advanceBulletWithSubsteps(b, 0.016, { W, H, M, resolveObstacleCollision });
  ok('obstacle callback invoked at least once per substep', called >= 1 && !bounced);
}

// 8. obstacle returns true => bounced
{
  const b = { x: 100, y: 100, r: 4, vx: 200, vy: 0 };
  const resolveObstacleCollision = () => true;
  const bounced = advanceBulletWithSubsteps(b, 0.016, { W, H, M, resolveObstacleCollision });
  ok('obstacle bounce returns true', bounced === true);
}

// 9. substep count: small movement -> 1 substep
{
  const b = { x: 500, y: 400, r: 4, vx: 100, vy: 0 };
  let calls = 0;
  advanceBulletWithSubsteps(b, 0.016, { W, H, M, resolveObstacleCollision: () => { calls++; return false; } });
  ok('low velocity uses 1 substep (calls=1)', calls === 1);
}

// 10. substep count: high velocity -> capped at 6
{
  const b = { x: 500, y: 400, r: 4, vx: 99999, vy: 0 };
  let calls = 0;
  advanceBulletWithSubsteps(b, 0.016, { W, H, M, resolveObstacleCollision: () => { calls++; return false; } });
  ok('substep count capped at 6', calls === 6);
}

// 11. substep math: maxFrameTravel = max(|vx|,|vy|)*dt; subSteps = ceil(travel/10)
{
  // vx=300, dt=0.1 => travel=30 => ceil(30/10)=3
  const b = { x: 500, y: 400, r: 4, vx: 300, vy: 0 };
  let calls = 0;
  advanceBulletWithSubsteps(b, 0.1, { W, H, M, resolveObstacleCollision: () => { calls++; return false; } });
  ok('travel=30 yields 3 substeps', calls === 3);
}

// 12. resolveObstacleCollision absent (still works)
{
  const b = { x: 100, y: 100, r: 4, vx: 50, vy: 0 };
  const bounced = advanceBulletWithSubsteps(b, 0.016, { W, H, M });
  ok('missing resolveObstacleCollision is tolerated', !bounced && b.x > 100);
}

// 13. determinism: same inputs => identical output
{
  const seed = () => ({ x: 200, y: 300, r: 5, vx: 240, vy: -120 });
  const a = seed(); const c = seed();
  for (let i = 0; i < 30; i++) {
    advanceBulletWithSubsteps(a, 0.016, { W, H, M, resolveObstacleCollision: noObstacle });
    advanceBulletWithSubsteps(c, 0.016, { W, H, M, resolveObstacleCollision: noObstacle });
  }
  ok('deterministic across runs', a.x === c.x && a.y === c.y && a.vx === c.vx && a.vy === c.vy);
}

// 14. diagonal bounce off corner
{
  const b = { x: M + 1, y: M + 1, r: 4, vx: -300, vy: -300 };
  const bounced = advanceBulletWithSubsteps(b, 0.1, { W, H, M, resolveObstacleCollision: noObstacle });
  ok('corner bounce flips both velocities', bounced && b.vx > 0 && b.vy > 0);
}

// 15. zero velocity bullet does not bounce, does not move
{
  const b = { x: 500, y: 400, r: 4, vx: 0, vy: 0 };
  const bounced = advanceBulletWithSubsteps(b, 0.016, { W, H, M, resolveObstacleCollision: noObstacle });
  ok('zero-velocity: no bounce, no movement', !bounced && b.x === 500 && b.y === 400);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
