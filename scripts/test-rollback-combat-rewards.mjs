import assert from 'node:assert/strict';

import { resolveChargedOrbFires } from '../src/sim/chargedOrbStep.js';
import { resolveOutputHits } from '../src/sim/outputHitDispatch.js';
import { createSimState } from '../src/sim/simState.js';

function makeOrbState() {
  const state = createSimState({ seed: 321, slotCount: 1, worldW: 800, worldH: 600 });
  state.run.roomPhase = 'fighting';
  state.slots[0].body.x = 300;
  state.slots[0].body.y = 300;
  state.slots[0].metrics.charge = 3;
  state.slots[0].metrics.maxCharge = 10;
  state.slots[0].upg.chargedOrbs = true;
  state.slots[0].upg.orbitSphereTier = 1;
  state.slots[0].orbState.fireTimers = [1390];
  state.slots[0].orbState.cooldowns = [0];
  state.enemies.push({
    eid: 1,
    x: 340,
    y: 300,
    r: 12,
    hp: 20,
    maxHp: 20,
    pts: 10,
  });
  return state;
}

function makeKillState() {
  const state = createSimState({ seed: 654, slotCount: 1, worldW: 800, worldH: 600 });
  state.slots[0].metrics.hp = 2;
  state.slots[0].metrics.maxHp = 20;
  state.slots[0].metrics.charge = 0;
  state.slots[0].metrics.maxCharge = 10;
  state.slots[0].upg.vampiric = true;
  state.slots[0].upg.bloodMoon = true;
  state.slots[0].upg.corona = true;
  state.slots[0].upg.finalForm = true;
  state.slots[0].upg.crimsonHarvest = true;
  state.slots[0].upg.sanguineBurst = true;
  state.slots[0].upg.pierceTier = 1;
  state.slots[0].upg.bounceTier = 0;
  state.slots[0].upg.homingTier = 0;
  state.slots[0].upg.playerDamageMult = 1;
  state.slots[0].upg.denseDamageMult = 1;
  state.slots[0].body.x = 300;
  state.slots[0].body.y = 300;
  state.bullets.push({
    id: 1,
    state: 'output',
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    r: 5,
    dmg: 7,
    pierceLeft: 1,
    crit: false,
    ownerId: 0,
    isRing: true,
    hitIds: new Set(),
  });
  state.enemies.push({
    eid: 9,
    x: 104,
    y: 100,
    r: 8,
    hp: 5,
    maxHp: 5,
    pts: 50,
  });
  return state;
}

console.log('\n=== rollback combat rewards tests ===\n');

{
  const state = makeOrbState();
  const fired = resolveChargedOrbFires(state, { joy: { active: false, mag: 0 } }, { dt: 1 / 60 });
  assert.equal(fired, 1);
  assert.equal(state.bullets.length, 1);
  assert.equal(state.bullets[0].state, 'output');
  assert.equal(state.slots[0].metrics.charge, 2);
  console.log('PASS charged orb fires once and spends charge');
}

{
  const state = makeOrbState();
  state.slots[0].metrics.charge = 1;
  const fired = resolveChargedOrbFires(state, { joy: { active: false, mag: 0 } }, { dt: 1 / 60 });
  assert.equal(fired, 0);
  assert.equal(state.bullets.length, 0);
  console.log('PASS charged orb respects player charge reserve');
}

{
  const state = makeKillState();
  const hits = resolveOutputHits(state, { spawnGreyDropsOnKill: false });
  assert.equal(hits, 1);
  assert.equal(state.run.kills, 1);
  assert.equal(state.run.score, 51);
  assert.equal(state.run.scoreBreakdown.kills, 50);
  assert.equal(state.run.scoreBreakdown.overkill, 1);
  assert.equal(state.run.bossClears, 0);
  assert.equal(state.slots[0].metrics.hp, 14);
  assert.equal(state.slots[0].metrics.charge, 1.75);
  assert.equal(state.slots[0].timers.killSustainHealedThisRoom, 12);
  assert.equal(state.bullets.length, 5);
  assert.equal(state.bullets.filter((b) => b.state === 'output').length, 1);
  assert.equal(state.bullets.filter((b) => b.state === 'grey').length, 4);
  console.log('PASS output kill applies reward heals, charge, and bonus spawns');
}

{
  const state = createSimState({ seed: 999, slotCount: 1, worldW: 800, worldH: 600 });
  state.slots[0].metrics.hp = 5;
  state.slots[0].metrics.maxHp = 20;
  state.slots[0].body.x = 300;
  state.slots[0].body.y = 300;
  state.bullets.push({
    id: 1,
    state: 'output',
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    r: 5,
    dmg: 5,
    pierceLeft: 0,
    crit: false,
    ownerId: 0,
    hitIds: new Set(),
  });
  state.enemies.push({
    eid: 22,
    x: 104,
    y: 100,
    r: 8,
    hp: 4,
    maxHp: 4,
    pts: 40,
    isBoss: true,
  });

  const hits = resolveOutputHits(state, { spawnGreyDropsOnKill: false });
  assert.equal(hits, 1);
  assert.equal(state.run.bossClears, 1);
  assert.equal(state.slots[0].metrics.hp, 15);
  console.log('PASS boss kill increments boss clear count and applies boss heal');
}

console.log('\nAll rollback combat reward tests passed.\n');
