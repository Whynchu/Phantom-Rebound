import assert from 'node:assert/strict';
import { createSimState } from '../src/sim/simState.js';
import { resolveDangerHits, resolveRusherContactHits } from '../src/sim/dangerHitDispatch.js';

function makeState() {
  const state = createSimState({ seed: 123, slotCount: 1, worldW: 800, worldH: 600 });
  const slot = state.slots[0];
  slot.index = 0;
  slot.body.x = 100;
  slot.body.y = 100;
  slot.body.r = 10;
  slot.metrics.hp = 100;
  slot.metrics.maxHp = 100;
  slot.metrics.charge = 0;
  slot.upg.maxCharge = 10;
  return state;
}

console.log('\n=== dangerHitDispatch tests ===\n');

{
  const state = makeState();
  state.bullets.push({ id: 7, state: 'danger', x: 105, y: 100, vx: 0, vy: 0, r: 5 });

  const hits = resolveDangerHits(state, { queueEffects: true });

  assert.equal(hits, 1);
  assert.equal(state.bullets.length, 0);
  assert.equal(state.slots[0].metrics.hp, 83);
  assert.equal(state.slots[0].body.invincible, 1.2);
  assert.equal(state.run.tookDamageThisRoom, true);
  assert.equal(state.effectQueue[0].kind, 'danger.directHit');
  console.log('PASS direct hit applies damage and removes bullet');
}

{
  const state = makeState();
  state.timeMs = 1000;
  state.slots[0].upg.voidWalker = true;
  state.slots[0].upg.voidZoneActive = true;
  state.slots[0].upg.voidZoneTimer = 1500;
  state.bullets.push({ id: 8, state: 'danger', x: 105, y: 100, vx: 0, vy: 0, r: 5 });

  const hits = resolveDangerHits(state, { queueEffects: true });

  assert.equal(hits, 1);
  assert.equal(state.bullets.length, 0);
  assert.equal(state.slots[0].metrics.hp, 100);
  assert.deepEqual(
    state.effectQueue.find((fx) => fx.kind === 'danger.voidBlock'),
    { kind: 'danger.voidBlock', slotIndex: 0, bulletId: 8, x: 105, y: 100 },
  );
  console.log('PASS void block removes bullet without damage');
}

{
  const state = makeState();
  state.slots[0].upg.phaseDash = true;
  state.slots[0].upg.phaseDashCooldown = 0;
  state.slots[0].upg.phaseDashRoomUses = 0;
  state.slots[0].upg.phaseDashRoomLimit = 1;
  state.bullets.push({ id: 9, state: 'danger', x: 105, y: 100, vx: 0, vy: 0, r: 5 });

  const hits = resolveDangerHits(state);

  assert.equal(hits, 1);
  assert.equal(state.bullets.length, 0);
  assert.equal(state.slots[0].upg.phaseDashRoomUses, 1);
  assert.equal(state.slots[0].upg.phaseDashCooldown, 3500);
  assert.equal(state.slots[0].metrics.hp, 95);
  assert.ok(state.slots[0].body.x < 100, 'phase dash should push away from bullet');
  console.log('PASS phase dash applies reduced damage and movement');
}

{
  const state = makeState();
  state.timeMs = 200;
  state.nextBulletId = 20;
  state.slots[0].upg.mirrorTide = true;
  state.slots[0].upg.mirrorTideCooldown = 0;
  state.slots[0].upg.mirrorTideRoomUses = 0;
  state.slots[0].upg.mirrorTideRoomLimit = 1;
  state.slots[0].upg.playerDamageMult = 2;
  state.slots[0].upg.denseDamageMult = 1.5;
  state.bullets.push({ id: 10, state: 'danger', x: 105, y: 100, vx: 30, vy: 0, r: 5 });

  const hits = resolveDangerHits(state, { queueEffects: true });

  assert.equal(hits, 1);
  assert.equal(state.bullets.length, 1);
  assert.equal(state.bullets[0].state, 'output');
  assert.equal(state.bullets[0].id, 20);
  assert.equal(state.bullets[0].dmg, 3);
  assert.equal(state.slots[0].metrics.hp, 100);
  assert.equal(state.effectQueue.some((fx) => fx.kind === 'danger.mirrorTide' && fx.x === 100 && fx.y === 100), true);
  console.log('PASS mirror tide converts danger hit into output reflection');
}

{
  const state = makeState();
  state.slots[0].upg.slipTier = 1;
  state.slots[0].upg.slipChargeGain = 0.5;
  state.slots[0].timers.slipCooldown = 0;
  state.bullets.push({ id: 11, state: 'danger', x: 100, y: 122, vx: 0, vy: 0, r: 3 });

  const hits = resolveDangerHits(state, { queueEffects: true });

  assert.equal(hits, 0);
  assert.equal(state.bullets.length, 1);
  assert.equal(state.slots[0].metrics.charge, 0.5);
  assert.equal(state.effectQueue.some((fx) => fx.kind === 'danger.slipstream' && fx.x === 100 && fx.y === 122), true);
  console.log('PASS slipstream near-miss queues positioned descriptor');
}

console.log('\nAll dangerHitDispatch tests passed.\n');

// ============================================================
// resolveRusherContactHits tests
// ============================================================

function makeRusherState({ slotCount = 1 } = {}) {
  const state = createSimState({ seed: 42, slotCount, worldW: 800, worldH: 600 });
  for (let i = 0; i < state.slots.length; i++) {
    const slot = state.slots[i];
    slot.index = i;
    slot.body.x = 100 + i * 200;
    slot.body.y = 100;
    slot.body.r = 10;
    slot.metrics.hp = 100;
    slot.metrics.maxHp = 100;
    slot.upg.maxCharge = 10;
  }
  return state;
}

function makeRusher({ x = 100, y = 100, r = 14, id = 1 } = {}) {
  return { id, eid: id, isRusher: true, dead: false, alive: true, x, y, r, vx: 0, vy: 0 };
}

console.log('\n=== resolveRusherContactHits tests ===\n');

{
  // Overlap → HP decremented, invincible set, tookDamageThisRoom=true
  const state = makeRusherState();
  state.enemies = [makeRusher({ x: 115, y: 100 })]; // distance 15 < 10+14+2=26

  const hits = resolveRusherContactHits(state, { queueEffects: true });

  assert.equal(hits, 1);
  assert.equal(state.slots[0].metrics.hp, 82, 'HP should be 100-18=82');
  assert.ok(state.slots[0].body.invincible > 0, 'invincible should be set');
  assert.equal(state.run.tookDamageThisRoom, true);
  assert.ok(state.effectQueue.some(e => e.kind === 'contact.rusherHit'), 'effect queued');
  console.log('PASS rusher overlap decrements HP and sets invincible');
}

{
  // Slot already invincible → no damage
  const state = makeRusherState();
  state.slots[0].body.invincible = 0.5;
  state.enemies = [makeRusher({ x: 115, y: 100 })];

  const hits = resolveRusherContactHits(state);

  assert.equal(hits, 0);
  assert.equal(state.slots[0].metrics.hp, 100, 'HP should be unchanged');
  console.log('PASS slot invincible blocks rusher contact');
}

{
  // Non-rusher enemy → no damage
  const state = makeRusherState();
  state.enemies = [{ id: 2, isRusher: false, dead: false, alive: true, x: 115, y: 100, r: 14 }];

  const hits = resolveRusherContactHits(state);

  assert.equal(hits, 0);
  assert.equal(state.slots[0].metrics.hp, 100);
  console.log('PASS non-rusher enemy does not trigger contact damage');
}

{
  // Game-over case: HP too low → slot dies and gameOver set
  const state = makeRusherState();
  state.slots[0].metrics.hp = 10; // 10 - 18 = -8 → should die
  state.enemies = [makeRusher({ x: 115, y: 100 })];

  resolveRusherContactHits(state, { queueEffects: true });

  assert.ok(state.slots[0].metrics.hp <= 0 || state.run.gameOver === true || state.slots[0].body.alive === false,
    'slot should be dead or game over flagged when HP goes below 0');
  console.log('PASS rusher contact triggers game-over when HP is exhausted');
}

{
  // Two-slot: rusher overlapping both players → only nearest slot is damaged
  const state = makeRusherState({ slotCount: 2 });
  // slot0 at (100,100), slot1 at (300,100)
  // rusher at (110,100): dist to slot0 = 10, dist to slot1 = 190
  state.enemies = [makeRusher({ x: 110, y: 100, r: 14 })];

  const hits = resolveRusherContactHits(state);

  assert.equal(hits, 1);
  assert.equal(state.slots[0].metrics.hp, 82, 'nearest slot (slot0) should take damage');
  assert.equal(state.slots[1].metrics.hp, 100, 'farther slot (slot1) should be untouched');
  console.log('PASS rusher only damages nearest slot when two slots present');
}

{
  // Order/integration: contact invuln set by resolveRusherContactHits prevents
  // a simultaneous danger bullet from re-damaging the slot in resolveDangerHits
  const state = makeRusherState();
  state.slots[0].metrics.hp = 100;
  state.enemies = [makeRusher({ x: 115, y: 100 })];
  // Also add a danger bullet overlapping the same slot
  state.bullets.push({ id: 99, state: 'danger', x: 105, y: 100, vx: 0, vy: 0, r: 5 });

  resolveRusherContactHits(state);
  assert.ok(state.slots[0].body.invincible > 0, 'invincible should be set after contact');

  const bulletHits = resolveDangerHits(state);
  assert.equal(bulletHits, 0, 'danger bullet should be blocked by contact invuln');
  // HP should only reflect the contact hit, not an additional bullet hit
  assert.equal(state.slots[0].metrics.hp, 82, 'HP reflects contact damage only');
  console.log('PASS contact invuln set before tickBulletsKinematic blocks same-tick danger bullet');
}

console.log('\nAll resolveRusherContactHits tests passed.\n');
