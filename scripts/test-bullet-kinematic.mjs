/**
 * Test suite for R2 tickBulletsKinematic
 * Pure Node, no browser required.
 */
import { tickBulletsKinematic } from '../src/sim/bulletKinematic.js';
import assert from 'assert';

console.log('\n=== tickBulletsKinematic Tests ===\n');

function makeState(bullets, timeMs = 0, worldW = 800, worldH = 600) {
  return {
    bullets,
    timeMs,
    world: { w: worldW, h: worldH },
  };
}

// Test 1: Advance — single bullet with vx=100, vy=0 moves right
{
  console.log('Test 1: Advance — vx=100 moves bullet rightward');
  const dt = 1 / 60;
  const bullet = { x: 100, y: 100, vx: 100, vy: 0, r: 5 };
  const state = makeState([bullet], 0);
  tickBulletsKinematic(state, dt);
  const expected = 100 + 100 * dt;
  assert(Math.abs(bullet.x - expected) < 0.001, `Expected x≈${expected}, got ${bullet.x}`);
  assert(Math.abs(bullet.y - 100) < 0.001, 'y should not change');
  console.log('✓ PASS');
}

// Test 2: Wall bounce X — bullet near right wall with vx=200 → vx becomes negative
{
  console.log('Test 2: Wall bounce X — vx flips at right wall');
  const W = 800;
  const M = 16;
  const r = 5;
  const bullet = { x: W - M - r - 1, y: 300, vx: 200, vy: 0, r };
  const state = makeState([bullet], 0, W);
  tickBulletsKinematic(state, 1 / 60);
  assert(bullet.vx < 0, `Expected vx < 0 after right-wall bounce, got ${bullet.vx}`);
  console.log('✓ PASS');
}

// Test 3: Wall bounce Y — bullet near bottom wall with vy=200 → vy becomes negative
{
  console.log('Test 3: Wall bounce Y — vy flips at bottom wall');
  const H = 600;
  const M = 16;
  const r = 5;
  const bullet = { x: 400, y: H - M - r - 1, vx: 0, vy: 200, r };
  const state = makeState([bullet], 0, 800, H);
  tickBulletsKinematic(state, 1 / 60);
  assert(bullet.vy < 0, `Expected vy < 0 after bottom-wall bounce, got ${bullet.vy}`);
  console.log('✓ PASS');
}

// Test 4: Expiry — bullet with expireAt=100 and timeMs=100 is removed
{
  console.log('Test 4: Expiry — bullet removed when timeMs >= expireAt');
  const bullet = { x: 100, y: 100, vx: 0, vy: 0, r: 5, expireAt: 100 };
  const state = makeState([bullet], 100);
  tickBulletsKinematic(state, 1 / 60);
  assert.strictEqual(state.bullets.length, 0, 'Bullet should be removed');
  console.log('✓ PASS');
}

// Test 5: Not yet expired — bullet with expireAt=200 and timeMs=100 stays
{
  console.log('Test 5: Not yet expired — bullet retained when timeMs < expireAt');
  const bullet = { x: 100, y: 100, vx: 0, vy: 0, r: 5, expireAt: 200 };
  const state = makeState([bullet], 100);
  tickBulletsKinematic(state, 1 / 60);
  assert.strictEqual(state.bullets.length, 1, 'Bullet should still be present');
  console.log('✓ PASS');
}

// Test 6: Null bullet cleaned up
{
  console.log('Test 6: Null bullet cleaned up');
  const bullet = { x: 100, y: 100, vx: 0, vy: 0, r: 5 };
  const state = makeState([null, bullet], 0);
  tickBulletsKinematic(state, 1 / 60);
  assert.strictEqual(state.bullets.length, 1, 'null entry should be removed');
  assert.strictEqual(state.bullets[0], bullet, 'Real bullet should remain');
  console.log('✓ PASS');
}

// Test 7: No side effects — no new bullets spawned
{
  console.log('Test 7: No side effects — no bullets added by tick');
  const bullet = { x: 100, y: 100, vx: 50, vy: 50, r: 5 };
  const state = makeState([bullet], 0);
  const lenBefore = state.bullets.length;
  tickBulletsKinematic(state, 1 / 60);
  assert.strictEqual(state.bullets.length, lenBefore, 'Bullet count must not increase');
  console.log('✓ PASS');
}

// Test 8: Multiple bullets both advance correctly
{
  console.log('Test 8: Multiple bullets — both advance');
  const dt = 1 / 60;
  const b1 = { x: 100, y: 100, vx: 60, vy: 0, r: 5 };
  const b2 = { x: 200, y: 200, vx: 0, vy: -80, r: 5 };
  const state = makeState([b1, b2], 0);
  tickBulletsKinematic(state, dt);
  assert(Math.abs(b1.x - (100 + 60 * dt)) < 0.01, `b1.x wrong: ${b1.x}`);
  assert(Math.abs(b2.y - (200 + -80 * dt)) < 0.01, `b2.y wrong: ${b2.y}`);
  console.log('✓ PASS');
}

// Test 9: Empty array — no error
{
  console.log('Test 9: Empty array — no error');
  const state = makeState([], 0);
  assert.doesNotThrow(() => tickBulletsKinematic(state, 1 / 60));
  console.log('✓ PASS');
}

console.log('\n✅ All tickBulletsKinematic tests passed.\n');
