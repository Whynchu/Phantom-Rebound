import assert from 'node:assert/strict';
import { createSimState } from '../src/sim/simState.js';
import { resolveOutputHits, hasHitId } from '../src/sim/outputHitDispatch.js';

function makeState() {
  const state = createSimState({ seed: 456, slotCount: 1, worldW: 800, worldH: 600 });
  const slot = state.slots[0];
  slot.index = 0;
  slot.metrics.hp = 50;
  slot.metrics.maxHp = 100;
  slot.upg.maxCharge = 10;
  return state;
}

function outputBullet(overrides = {}) {
  return {
    id: 1,
    state: 'output',
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    r: 5,
    dmg: 2,
    pierceLeft: 0,
    crit: false,
    hitIds: new Set(),
    ownerId: 0,
    ...overrides,
  };
}

function enemy(overrides = {}) {
  return {
    eid: 99,
    x: 104,
    y: 100,
    r: 8,
    hp: 5,
    maxHp: 5,
    pts: 50,
    ...overrides,
  };
}

console.log('\n=== outputHitDispatch tests ===\n');

{
  const state = makeState();
  state.bullets.push(outputBullet({ dmg: 2 }));
  state.enemies.push(enemy({ hp: 5 }));

  const hits = resolveOutputHits(state);

  assert.equal(hits, 1);
  assert.equal(state.bullets.length, 0);
  assert.equal(state.enemies[0].hp, 3);
  assert.equal(state.run.score, 0);
  console.log('PASS output hit damages enemy and removes non-piercing bullet');
}

{
  const state = makeState();
  state.bullets.push(outputBullet({ dmg: 7 }));
  state.enemies.push(enemy({ hp: 5, maxHp: 5, pts: 50 }));

  const hits = resolveOutputHits(state, { queueEffects: true, spawnGreyDropsOnKill: false });

  assert.equal(hits, 1);
  assert.equal(state.bullets.length, 0);
  assert.equal(state.enemies.length, 0);
  assert.equal(state.run.kills, 1);
  assert.equal(state.run.score, 51);
  assert.equal(state.run.scoreBreakdown.kills, 50);
  assert.equal(state.run.scoreBreakdown.overkill, 1);
  assert.equal(state.effectQueue.some((fx) => fx.kind === 'output.enemyKilled'), true);
  console.log('PASS output kill updates score, kills, and overkill');
}

{
  const state = makeState();
  const bullet = outputBullet({ dmg: 1, pierceLeft: 1 });
  state.bullets.push(bullet);
  state.enemies.push(enemy({ hp: 5 }));

  const hitsA = resolveOutputHits(state);
  const hpAfterA = state.enemies[0].hp;
  const hitsB = resolveOutputHits(state);

  assert.equal(hitsA, 1);
  assert.equal(hitsB, 0);
  assert.equal(state.bullets.length, 1);
  assert.equal(state.bullets[0].pierceLeft, 0);
  assert.equal(state.enemies[0].hp, hpAfterA);
  assert.equal(hasHitId(bullet, 99), true);
  console.log('PASS pierce bullet remains and hitIds prevent double-hit');
}

{
  const state = makeState();
  state.slots[0].metrics.hp = 40;
  state.slots[0].metrics.maxHp = 100;
  state.slots[0].upg.bloodPact = true;
  state.bullets.push(outputBullet({ dmg: 1, pierceLeft: 1, bloodPactHeals: 0, bloodPactHealCap: 1 }));
  state.enemies.push(enemy({ hp: 5 }));

  resolveOutputHits(state);

  assert.equal(state.slots[0].metrics.hp, 41);
  assert.equal(state.bullets[0].bloodPactHeals, 1);
  console.log('PASS blood pact heals owner slot once per eligible piercing hit');
}

{
  const state = makeState();
  state.timeMs = 500;
  state.nextBulletId = 30;
  state.slots[0].upg.volatileRounds = true;
  state.bullets.push(outputBullet({ dmg: 1, pierceLeft: 1 }));
  state.enemies.push(enemy({ hp: 5 }));

  resolveOutputHits(state, { spawnGreyDropsOnKill: false });

  assert.equal(state.bullets.length, 5);
  assert.equal(state.bullets.filter((b) => b.state === 'output').length, 5);
  assert.equal(state.bullets[0].id, 1);
  assert.equal(state.bullets.slice(1).every((b) => b.expireAt === 2100), true);
  console.log('PASS volatile rounds spawn deterministic radial output burst');
}

console.log('\nAll outputHitDispatch tests passed.\n');
