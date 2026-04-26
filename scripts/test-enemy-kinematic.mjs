/**
 * Test suite for R2 tickEnemiesKinematic
 * Pure Node, no browser required.
 */
import { tickEnemiesKinematic } from '../src/sim/enemyKinematic.js';
import assert from 'assert';

console.log('\n=== tickEnemiesKinematic Tests ===\n');

function makeState({ enemies, slots, worldW = 800, worldH = 600 } = {}) {
  return {
    enemies: enemies || [],
    slots: slots || [],
    world: { w: worldW, h: worldH },
  };
}

function makeSlot(x, y) {
  return { body: { x, y } };
}

// Test 1: Basic movement — enemy moves toward player slot along X axis
{
  console.log('Test 1: Basic movement toward player');
  const dt = 1 / 60;
  // Start enemy at a valid in-bounds position: M+r=24 from edges
  const enemy = { x: 200, y: 300, spd: 100, r: 8 };
  const state = makeState({ enemies: [enemy], slots: [makeSlot(300, 300)] });
  const y0 = enemy.y;
  tickEnemiesKinematic(state, dt);
  assert(enemy.x > 200, `Expected enemy.x > 200, got ${enemy.x}`);
  assert(Math.abs(enemy.y - y0) < 0.001, `Expected enemy.y unchanged ≈ ${y0}, got ${enemy.y}`);
  // dx=100, dist=100 → moves 100/100*100*dt = dt*100
  const expected = 200 + 100 * dt;
  assert(Math.abs(enemy.x - expected) < 0.01, `Expected x≈${expected}, got ${enemy.x}`);
  console.log('✓ PASS');
}

// Test 2: Diagonal movement — dx ≈ dy
{
  console.log('Test 2: Diagonal movement — dx ≈ dy');
  const dt = 1 / 60;
  // Start in valid bounds; move diagonally toward a slot at equal dx/dy
  const enemy = { x: 200, y: 200, spd: 100, r: 8 };
  const state = makeState({ enemies: [enemy], slots: [makeSlot(300, 300)] });
  const x0 = enemy.x;
  const y0 = enemy.y;
  tickEnemiesKinematic(state, dt);
  const movedX = enemy.x - x0;
  const movedY = enemy.y - y0;
  assert(movedX > 0, 'Should move right');
  assert(movedY > 0, 'Should move down');
  assert(Math.abs(movedX - movedY) < 0.001, `Diagonal: movedX=${movedX} movedY=${movedY} should be equal`);
  console.log('✓ PASS');
}

// Test 3: Already on target — no NaN, no crash
{
  console.log('Test 3: Already on target — no NaN');
  const enemy = { x: 300, y: 300, spd: 100, r: 8 };
  const state = makeState({ enemies: [enemy], slots: [makeSlot(300, 300)] });
  assert.doesNotThrow(() => tickEnemiesKinematic(state, 1 / 60));
  assert(!isNaN(enemy.x), 'x should not be NaN');
  assert(!isNaN(enemy.y), 'y should not be NaN');
  console.log('✓ PASS');
}

// Test 4: Dead enemy not moved
{
  console.log('Test 4: Dead enemy not moved');
  const enemy = { x: 200, y: 200, spd: 100, r: 8, dead: true };
  const state = makeState({ enemies: [enemy], slots: [makeSlot(400, 300)] });
  tickEnemiesKinematic(state, 1 / 60);
  assert.strictEqual(enemy.x, 200, 'Dead enemy x should not change');
  assert.strictEqual(enemy.y, 200, 'Dead enemy y should not change');
  console.log('✓ PASS');
}

// Test 5: No slots — no crash, no move
{
  console.log('Test 5: No slots — no crash');
  const enemy = { x: 200, y: 200, spd: 100, r: 8 };
  const state = makeState({ enemies: [enemy], slots: [] });
  assert.doesNotThrow(() => tickEnemiesKinematic(state, 1 / 60));
  assert.strictEqual(enemy.x, 200, 'Enemy x should not change with no slots');
  console.log('✓ PASS');
}

// Test 6: Nearest slot wins — enemy moves toward closest
{
  console.log('Test 6: Nearest slot wins');
  const dt = 1 / 60;
  // Enemy at (200, 300); slot A at (400, 300) dist=200; slot B at (250, 300) dist=50 → B wins
  const enemy = { x: 200, y: 300, spd: 100, r: 8 };
  const state = makeState({
    enemies: [enemy],
    slots: [makeSlot(400, 300), makeSlot(250, 300)],
  });
  const x0 = enemy.x;
  tickEnemiesKinematic(state, dt);
  // Moves rightward toward x=250 (closest)
  assert(enemy.x > x0, 'Should move right toward nearest slot at x=250');
  // Direction should be purely horizontal (y shouldn't change from 300)
  assert(Math.abs(enemy.y - 300) < 0.001, 'y should stay at 300');
  console.log('✓ PASS');
}

// Test 7: World clamp — enemy clamped at right edge
{
  console.log('Test 7: World clamp — enemy clamped at right edge');
  const W = 800;
  const M = 16;
  const r = 8;
  // Place enemy near right boundary, moving fast rightward
  const enemy = { x: W - M - r - 0.5, y: 300, spd: 2000, r };
  const state = makeState({ enemies: [enemy], slots: [makeSlot(W, 300)], worldW: W });
  tickEnemiesKinematic(state, 1 / 60);
  assert(enemy.x <= W - M - r, `Enemy x=${enemy.x} should be clamped to ≤ ${W - M - r}`);
  console.log('✓ PASS');
}

// Test 8: Speed zero — no movement, no crash
{
  console.log('Test 8: Speed zero — no movement');
  const enemy = { x: 300, y: 300, spd: 0, r: 8 };
  const state = makeState({ enemies: [enemy], slots: [makeSlot(400, 300)] });
  assert.doesNotThrow(() => tickEnemiesKinematic(state, 1 / 60));
  assert.strictEqual(enemy.x, 300, 'x should not change with spd=0');
  assert.strictEqual(enemy.y, 300, 'y should not change with spd=0');
  console.log('✓ PASS');
}

console.log('\n✅ All tickEnemiesKinematic tests passed.\n');
