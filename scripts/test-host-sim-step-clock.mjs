/**
 * R0.4 step 5 — sim clock seam tests.
 *
 * Verifies hostSimStep advances state.tick and state.timeMs deterministically.
 * Prerequisite for any bullet/enemy carve-out: those regions read `ts` for
 * decay/expireAt/orb-shield rotation/mirror cooldowns. Sourcing those from
 * state.timeMs (vs. live performance.now()) is the rollback-safety contract.
 */
import { hostSimStep } from '../src/sim/hostSimStep.js';
import { createSimState } from '../src/sim/simState.js';
import assert from 'assert';

function makeState() {
  return createSimState({ seed: 12345, slotCount: 2, worldW: 800, worldH: 600 });
}

console.log('\n=== R0.4 step 5 — clock seam tests ===\n');

// Test 1: state.tick advances by 1 per call
{
  const state = makeState();
  assert.strictEqual(state.tick, 0, 'starts at 0');
  hostSimStep(state, null, null, 1 / 60);
  assert.strictEqual(state.tick, 1);
  hostSimStep(state, null, null, 1 / 60);
  assert.strictEqual(state.tick, 2);
  for (let i = 0; i < 100; i++) hostSimStep(state, null, null, 1 / 60);
  assert.strictEqual(state.tick, 102);
  console.log('✓ state.tick advances by 1 per call');
}

// Test 2: state.timeMs accumulates dt*1000
{
  const state = makeState();
  assert.strictEqual(state.timeMs, 0);
  hostSimStep(state, null, null, 1 / 60);
  // 1000/60 ≈ 16.6667
  assert.ok(Math.abs(state.timeMs - 1000 / 60) < 1e-9, `expected ~16.667, got ${state.timeMs}`);
  hostSimStep(state, null, null, 1 / 60);
  assert.ok(Math.abs(state.timeMs - 2000 / 60) < 1e-9);
  // Mixed dt
  hostSimStep(state, null, null, 0.05);
  assert.ok(Math.abs(state.timeMs - (2000 / 60 + 50)) < 1e-9);
  console.log('✓ state.timeMs accumulates dt*1000');
}

// Test 3: parallel runs produce identical clock state (determinism)
{
  const a = makeState();
  const b = makeState();
  for (let i = 0; i < 500; i++) {
    hostSimStep(a, null, null, 1 / 60);
    hostSimStep(b, null, null, 1 / 60);
  }
  assert.strictEqual(a.tick, b.tick);
  assert.strictEqual(a.timeMs, b.timeMs);
  console.log('✓ parallel runs have identical clocks');
}

// Test 4: world dims read from state.world.{w,h}
{
  const state = createSimState({ seed: 1, slotCount: 1, worldW: 1280, worldH: 720 });
  assert.strictEqual(state.world.w, 1280);
  assert.strictEqual(state.world.h, 720);
  // Place body near right edge; tick should respect 1280-wide world via state.world
  state.slots[0].body.x = 1270;
  state.slots[0].body.vx = 1000;
  hostSimStep(state, null, null, 1 / 60);
  // Should be clamped to within margin (default 16) — i.e. < W - M - r
  const r = state.slots[0].body.r || 14;
  assert.ok(state.slots[0].body.x <= 1280 - 16 - r + 1e-6,
    `body x=${state.slots[0].body.x} should be clamped within state.world.w=1280`);
  console.log('✓ hostSimStep reads world dims from state.world.{w,h}');
}

// Test 5: legacy state.worldW/H fallback still works
{
  const state = createSimState({ seed: 1, slotCount: 1 });
  state.world = null; // simulate a state that hasn't migrated
  state.worldW = 400;
  state.worldH = 300;
  state.slots[0].body.x = 380;
  state.slots[0].body.vx = 1000;
  hostSimStep(state, null, null, 1 / 60);
  const r = state.slots[0].body.r || 14;
  assert.ok(state.slots[0].body.x <= 400 - 16 - r + 1e-6,
    `legacy fallback: body x=${state.slots[0].body.x} should be clamped within state.worldW=400`);
  console.log('✓ legacy state.worldW/H fallback still works');
}

// Test 6: authoritative peer positions re-anchor slot bodies
{
  const state = createSimState({ seed: 1, slotCount: 2, worldW: 800, worldH: 600 });
  state.run.roomPhase = 'spawning';
  state.slots[0].body.x = 200;
  state.slots[0].body.y = 200;
  state.slots[1].body.x = 300;
  state.slots[1].body.y = 300;
  hostSimStep(
    state,
    { joy: { dx: 1, dy: 0, active: true, mag: 60 }, x: 411.2, y: 255.6 },
    { joy: { dx: -1, dy: 0, active: true, mag: 60 }, x: 123.4, y: 444.4 },
    1 / 60
  );
  assert.strictEqual(state.slots[0].body.x, 411.2);
  assert.strictEqual(state.slots[0].body.y, 255.6);
  assert.strictEqual(state.slots[1].body.x, 123.4);
  assert.strictEqual(state.slots[1].body.y, 444.4);
  console.log('✓ hostSimStep applies authoritative input x/y anchors');
}

console.log('\n=== R0.4 step 5 — all 6 tests pass ===\n');
