import assert from 'node:assert/strict';
import { createSimState } from '../src/sim/simState.js';
import { resolveDangerHits } from '../src/sim/dangerHitDispatch.js';

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

  const hits = resolveDangerHits(state);

  assert.equal(hits, 1);
  assert.equal(state.bullets.length, 0);
  assert.equal(state.slots[0].metrics.hp, 100);
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

  const hits = resolveDangerHits(state);

  assert.equal(hits, 1);
  assert.equal(state.bullets.length, 1);
  assert.equal(state.bullets[0].state, 'output');
  assert.equal(state.bullets[0].id, 20);
  assert.equal(state.bullets[0].dmg, 3);
  assert.equal(state.slots[0].metrics.hp, 100);
  console.log('PASS mirror tide converts danger hit into output reflection');
}

console.log('\nAll dangerHitDispatch tests passed.\n');
