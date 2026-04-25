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

console.log('');
console.log(`SimState serialize tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
