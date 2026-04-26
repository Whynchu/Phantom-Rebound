#!/usr/bin/env node
import assert from 'assert';
import { createSimState } from '../src/sim/simState.js';
import { tickEnemyCombat } from '../src/sim/enemyCombatStep.js';
import { hostSimStep } from '../src/sim/hostSimStep.js';

function makeState() {
  const state = createSimState({ seed: 99, slotCount: 2, worldW: 800, worldH: 600 });
  state.slots[0].body.x = 400;
  state.slots[0].body.y = 300;
  state.slots[1].body.x = 620;
  state.slots[1].body.y = 300;
  state.run.roomIndex = 5;
  return state;
}

function makeRangedEnemy(overrides = {}) {
  return {
    eid: 1,
    type: 'chaser',
    x: 300,
    y: 300,
    r: 12,
    hp: 3,
    spd: 0,
    fRate: 100,
    fT: 100,
    burst: 1,
    spread: 0.22,
    pts: 50,
    disruptorBulletCount: 0,
    disruptorCooldown: 0,
    ...overrides,
  };
}

console.log('\n=== enemyCombatStep tests ===\n');

{
  const state = makeState();
  state.enemies.push(makeRangedEnemy());
  const fired = tickEnemyCombat(state, 1 / 60, { bulletSpeedScale: 1 });
  assert.equal(fired, 1);
  assert.equal(state.bullets.length, 1);
  assert.equal(state.bullets[0].state, 'danger');
  assert.equal(state.enemies[0].fT, 0);
  console.log('PASS ranged enemy fires deterministic danger bullet');
}

{
  const a = makeState();
  const b = makeState();
  a.enemies.push(makeRangedEnemy({ eid: 7, x: 260, y: 250, fT: 90 }));
  b.enemies.push(makeRangedEnemy({ eid: 7, x: 260, y: 250, fT: 90 }));
  for (let i = 0; i < 12; i++) {
    tickEnemyCombat(a, 1 / 60, { bulletSpeedScale: 1 });
    tickEnemyCombat(b, 1 / 60, { bulletSpeedScale: 1 });
  }
  assert.deepEqual(JSON.parse(JSON.stringify(a.bullets)), JSON.parse(JSON.stringify(b.bullets)));
  assert.deepEqual(JSON.parse(JSON.stringify(a.enemies)), JSON.parse(JSON.stringify(b.enemies)));
  assert.equal(a.rngState, b.rngState);
  console.log('PASS parallel enemy combat runs are byte-identical');
}

{
  const state = makeState();
  state.slots[0].metrics.charge = 5;
  state.enemies.push(makeRangedEnemy({
    type: 'siphon',
    isSiphon: true,
    x: 410,
    y: 300,
    spd: 0,
    fRate: 9999,
    burst: 0,
  }));
  tickEnemyCombat(state, 0.5, {});
  assert.ok(state.slots[0].metrics.charge < 5, `expected charge drain, got ${state.slots[0].metrics.charge}`);
  console.log('PASS siphon drains target slot charge during resim');
}

{
  const state = makeState();
  state.enemies.push(makeRangedEnemy({ x: 260, y: 300, fT: 100 }));
  hostSimStep(state, null, null, 1 / 60, { bulletSpeedScale: 1 });
  assert.equal(state.bullets.length, 1);
  assert.equal(state.bullets[0].state, 'danger');
  assert.equal(state.tick, 1);
  console.log('PASS hostSimStep includes enemy combat projectile spawn');
}

console.log('\nAll enemyCombatStep tests passed.\n');

