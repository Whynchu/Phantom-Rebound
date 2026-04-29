import assert from 'node:assert/strict';

import { resolveOrbitSphereContactHits } from '../src/sim/orbitSphereContactStep.js';

function makeState(overrides = {}) {
  return {
    timeMs: 0,
    bullets: [],
    enemies: [{
      eid: 7,
      x: 340,
      y: 300,
      r: 12,
      hp: 40,
      maxHp: 40,
      pts: 15,
      col: '#f00',
      ...overrides.enemy,
    }],
    slots: [{
      body: { x: 300, y: 300, r: 14, alive: true },
      metrics: { hp: 10, maxHp: 20, charge: 0, maxCharge: 5 },
      upg: { orbitSphereTier: 1, maxCharge: 5, ...overrides.upg },
      orbState: { cooldowns: [0] },
    }],
    run: { score: 0, kills: 0, scoreBreakdown: { kills: 0 } },
    effectQueue: [],
  };
}

{
  const state = makeState();
  const hits = resolveOrbitSphereContactHits(state, { queueEffects: true });
  assert.equal(hits, 1);
  assert.equal(state.enemies.length, 1);
  assert.equal(state.enemies[0].hp, 20);
  assert.equal(state.effectQueue[0].kind, 'orbit.enemyHit');
}

{
  const state = makeState({ enemy: { hp: 18 } });
  const hits = resolveOrbitSphereContactHits(state, { queueEffects: true });
  assert.equal(hits, 1);
  assert.equal(state.enemies.length, 0);
  assert.equal(state.run.kills, 1);
  assert.equal(state.run.score, 15);
  assert.equal(state.run.scoreBreakdown.kills, 15);
  assert.equal(state.bullets.length, 1);
  assert.equal(state.bullets[0].state, 'grey');
  assert.equal(state.effectQueue.some((e) => e.kind === 'orbit.enemyKilled'), true);
}

{
  const state = makeState({ enemy: { x: 500, y: 300 } });
  const hits = resolveOrbitSphereContactHits(state);
  assert.equal(hits, 0);
  assert.equal(state.enemies[0].hp, 40);
}

{
  const state = makeState();
  state.slots[0].orbState.cooldowns[0] = 1;
  const hits = resolveOrbitSphereContactHits(state);
  assert.equal(hits, 0);
  assert.equal(state.enemies[0].hp, 40);
}

{
  const state = makeState({ enemy: { hp: 24 }, upg: { orbDamageTier: 1 } });
  const hits = resolveOrbitSphereContactHits(state);
  assert.equal(hits, 1);
  assert.equal(state.enemies.length, 0);
}

{
  const state = makeState({ enemy: { hp: 18 }, upg: { finalForm: true } });
  state.slots[0].metrics.hp = 2;
  const hits = resolveOrbitSphereContactHits(state);
  assert.equal(hits, 1);
  assert.equal(state.slots[0].metrics.charge, 0.5);
}

console.log('✓ orbit-sphere contact step tests passed');
