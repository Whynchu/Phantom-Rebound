// Tests for SimState serialization (R1).
import { strict as assert } from 'node:assert';
import { createSimState, resetSimState } from '../src/sim/simState.js';
import { serialize, deserialize, snapshotState, restoreState } from '../src/sim/simStateSerialize.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); passed++; }
  catch (err) { console.log(`FAIL ${name}\n  ${err.message}`); failed++; }
}

test('serialize produces valid JSON string', () => {
  const state = createSimState({ seed: 1, worldW: 512, worldH: 768, slotCount: 1 });
  const json = serialize(state);
  assert.equal(typeof json, 'string');
  assert.ok(json.length > 0);
  assert.ok(json.startsWith('{'));
});

test('deserialize recovers a plain object from JSON', () => {
  const state = createSimState({ seed: 1, worldW: 256, worldH: 512, slotCount: 1 });
  state.run.score = 5000;
  state.run.roomIndex = 10;
  const json = serialize(state);
  const recovered = deserialize(json);
  assert.equal(recovered.run.score, 5000);
  assert.equal(recovered.run.roomIndex, 10);
  assert.equal(recovered.world.w, 256);
});

test('serialize → deserialize round-trip preserves all fields', () => {
  const original = createSimState({ seed: 9876, worldW: 320, worldH: 600, slotCount: 1 });
  // Mutate some fields.
  original.tick = 42;
  original.run.score = 1234;
  original.run.kills = 5;
  original.slots[0].body.x = 100;
  original.slots[0].metrics.hp = 150;
  original.slots[0].upg.longReach = 3;
  original.run.boonHistory.push('Long Reach');
  original.run.legendaryRejectedIds.push('legendary-1');
  
  const json = serialize(original);
  const recovered = deserialize(json);
  
  assert.equal(recovered.tick, 42);
  assert.equal(recovered.run.score, 1234);
  assert.equal(recovered.run.kills, 5);
  assert.equal(recovered.slots[0].body.x, 100);
  assert.equal(recovered.slots[0].metrics.hp, 150);
  assert.equal(recovered.slots[0].upg.longReach, 3);
  assert.equal(recovered.run.boonHistory[0], 'Long Reach');
  assert.equal(recovered.run.legendaryRejectedIds[0], 'legendary-1');
});

test('snapshotState creates a deep clone', () => {
  const state = createSimState({ seed: 1, worldW: 512, worldH: 768, slotCount: 1 });
  state.run.score = 999;
  state.run.boonHistory.push('test-boon');
  
  const snap = snapshotState(state);
  
  // Snapshot is a separate object.
  assert.notEqual(snap, state);
  // But has the same data.
  assert.equal(snap.run.score, 999);
  assert.equal(snap.run.boonHistory[0], 'test-boon');
  
  // Mutating snapshot doesn't affect original.
  snap.run.score = 0;
  assert.equal(state.run.score, 999);
});

test('restoreState in-place restores all fields while preserving object identity', () => {
  const state = createSimState({ seed: 1, worldW: 512, worldH: 768, slotCount: 1 });
  const runRef = state.run;  // capture reference
  const slotsRef = state.slots;
  
  // Simulate changes.
  state.run.score = 5000;
  state.run.roomIndex = 20;
  state.tick = 100;
  
  // Create a snapshot and reset to different state.
  const snapshot = snapshotState(state);
  state.run.score = 0;
  state.run.roomIndex = 0;
  state.tick = 0;
  
  // Now restore from snapshot.
  restoreState(state, snapshot);
  
  // All values restored.
  assert.equal(state.run.score, 5000);
  assert.equal(state.run.roomIndex, 20);
  assert.equal(state.tick, 100);
  
  // Object identity PRESERVED (not replaced).
  assert.equal(state.run, runRef);
  assert.equal(state.slots, slotsRef);
});

test('restoreState handles nested arrays correctly', () => {
  const state = createSimState({ seed: 1, worldW: 512, worldH: 768, slotCount: 1 });
  state.bullets.push({ id: 1, x: 10, y: 20 });
  state.bullets.push({ id: 2, x: 30, y: 40 });
  state.run.boonHistory.push('Heal', 'Long Reach');
  
  const snap = snapshotState(state);
  const bulletsRef = state.bullets;
  
  // Clear arrays.
  state.bullets.length = 0;
  state.run.boonHistory.length = 0;
  
  // Restore.
  restoreState(state, snap);
  
  // Arrays refilled, identity preserved.
  assert.equal(state.bullets, bulletsRef);
  assert.equal(state.bullets.length, 2);
  assert.equal(state.bullets[0].id, 1);
  assert.equal(state.run.boonHistory[0], 'Heal');
});

test('restoreState handles plain object dicts (legendaryRoomsSinceReject)', () => {
  const state = createSimState({ seed: 1, worldW: 512, worldH: 768, slotCount: 1 });
  state.run.legendaryRoomsSinceReject['leg-1'] = 5;
  state.run.legendaryRoomsSinceReject['leg-2'] = 10;
  
  const snap = snapshotState(state);
  
  // Mutate.
  state.run.legendaryRoomsSinceReject = {};
  
  // Restore.
  restoreState(state, snap);
  
  // Dict restored.
  assert.equal(state.run.legendaryRoomsSinceReject['leg-1'], 5);
  assert.equal(state.run.legendaryRoomsSinceReject['leg-2'], 10);
});

test('serialize(snapshot).length is reasonable (< 100KB for typical state)', () => {
  const state = createSimState({ seed: 1, worldW: 512, worldH: 768, slotCount: 1 });
  // Add some realistic data.
  for (let i = 0; i < 50; i++) {
    state.bullets.push({ id: i, x: Math.random() * 512, y: Math.random() * 768, vx: 0, vy: 0 });
  }
  for (let i = 0; i < 30; i++) {
    state.enemies.push({ id: i, x: Math.random() * 512, y: Math.random() * 768, hp: 100 });
  }
  state.run.boonHistory = Array(30).fill('test-boon');

  const json = serialize(state);
  console.log(`  (state size: ${Math.round(json.length / 1024)} KB)`);
  assert.ok(json.length < 100 * 1024, 'state too large');
});

// R0.4 step 1 — schema completeness for slot timers + body transients.
// These fields are critical for rollback because:
//   - body.invincible/distort tick down per dt; resim must see the exact
//     pre-tick value or hits register on different ticks.
//   - body.phaseWalkOverlapMs/IdleMs are accumulated across substeps;
//     wrong values trigger ejection on the wrong frame.
//   - slot.timers.* gate boon procs (barrier pulses, absorb combos,
//     chain magnet, slip cooldown, colossus shockwave, volatile orb).
test('createSimState populates slot.timers schema', () => {
  const state = createSimState({ seed: 1, slotCount: 1 });
  const t = state.slots[0].timers;
  assert.ok(t, 'slots[0].timers exists');
  for (const key of [
    'barrierPulseTimer', 'slipCooldown',
    'absorbComboCount', 'absorbComboTimer',
    'chainMagnetTimer', 'echoCounter',
    'vampiricRestoresThisRoom', 'killSustainHealedThisRoom',
    'colossusShockwaveCd', 'volatileOrbGlobalCooldown',
  ]) {
    assert.equal(t[key], 0, `timers.${key} initialised to 0`);
  }
});

test('createSimState populates body transient combat fields', () => {
  const state = createSimState({ seed: 1, slotCount: 1 });
  const b = state.slots[0].body;
  assert.equal(b.invincible, 0);
  assert.equal(b.distort, 0);
  assert.equal(b.phaseWalkOverlapMs, 0);
  assert.equal(b.phaseWalkIdleMs, 0);
  assert.equal(b.coopSpectating, false);
});

test('restoreState round-trips slot.timers fields', () => {
  const state = createSimState({ seed: 1, slotCount: 1 });
  const t = state.slots[0].timers;
  t.barrierPulseTimer = 234;
  t.slipCooldown = 1100;
  t.absorbComboCount = 3;
  t.absorbComboTimer = 850;
  t.chainMagnetTimer = 600;
  t.echoCounter = 4;
  t.vampiricRestoresThisRoom = 2;
  t.killSustainHealedThisRoom = 5;
  t.colossusShockwaveCd = 1.25;
  t.volatileOrbGlobalCooldown = 0.4;
  const timersIdentity = state.slots[0].timers;

  const snap = snapshotState(state);
  // Mutate live state away from the snapshot.
  for (const k of Object.keys(t)) t[k] = 0;

  restoreState(state, snap);
  // Identity preserved.
  assert.equal(state.slots[0].timers, timersIdentity, 'timers object identity preserved');
  // Values restored.
  assert.equal(t.barrierPulseTimer, 234);
  assert.equal(t.slipCooldown, 1100);
  assert.equal(t.absorbComboCount, 3);
  assert.equal(t.absorbComboTimer, 850);
  assert.equal(t.chainMagnetTimer, 600);
  assert.equal(t.echoCounter, 4);
  assert.equal(t.vampiricRestoresThisRoom, 2);
  assert.equal(t.killSustainHealedThisRoom, 5);
  assert.equal(t.colossusShockwaveCd, 1.25);
  assert.equal(t.volatileOrbGlobalCooldown, 0.4);
});

test('restoreState round-trips body transient combat fields', () => {
  const state = createSimState({ seed: 1, slotCount: 1 });
  const b = state.slots[0].body;
  b.invincible = 1.4;
  b.distort = 0.6;
  b.phaseWalkOverlapMs = 432;
  b.phaseWalkIdleMs = 88;
  b.coopSpectating = true;
  const bodyIdentity = state.slots[0].body;

  const snap = snapshotState(state);
  b.invincible = 0;
  b.distort = 0;
  b.phaseWalkOverlapMs = 0;
  b.phaseWalkIdleMs = 0;
  b.coopSpectating = false;

  restoreState(state, snap);
  assert.equal(state.slots[0].body, bodyIdentity, 'body object identity preserved');
  assert.equal(b.invincible, 1.4);
  assert.equal(b.distort, 0.6);
  assert.equal(b.phaseWalkOverlapMs, 432);
  assert.equal(b.phaseWalkIdleMs, 88);
  assert.equal(b.coopSpectating, true);
});

test('restoreState handles legacy slot without timers field', () => {
  // Simulate a stale liveState (e.g., from before schema bump). Resim
  // should still adopt the snapshot timers without throwing.
  const state = createSimState({ seed: 1, slotCount: 1 });
  delete state.slots[0].timers;
  const snap = snapshotState(createSimState({ seed: 2, slotCount: 1 }));
  snap.slots[0].timers.barrierPulseTimer = 999;
  restoreState(state, snap);
  assert.ok(state.slots[0].timers, 'timers field added');
  assert.equal(state.slots[0].timers.barrierPulseTimer, 999);
});

test('resetSimState clears slot.timers and body transients', () => {
  const state = createSimState({ seed: 1, slotCount: 1 });
  state.slots[0].timers.barrierPulseTimer = 999;
  state.slots[0].timers.volatileOrbGlobalCooldown = 0.5;
  state.slots[0].body.invincible = 2;
  state.slots[0].body.coopSpectating = true;
  resetSimState(state, { seed: 7 });
  assert.equal(state.slots[0].timers.barrierPulseTimer, 0);
  assert.equal(state.slots[0].timers.volatileOrbGlobalCooldown, 0);
  assert.equal(state.slots[0].body.invincible, 0);
  assert.equal(state.slots[0].body.coopSpectating, false);
});

console.log('');
console.log(`SimState serialize tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
