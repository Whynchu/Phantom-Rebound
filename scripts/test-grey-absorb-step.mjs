import assert from 'node:assert/strict';

import { resolveGreyAbsorbs } from '../src/sim/greyAbsorbStep.js';

function makeState(overrides = {}) {
  return {
    tick: 5,
    timeMs: 1000,
    nextBulletId: 20,
    bullets: [{
      id: 1,
      x: 300,
      y: 300,
      vx: 100,
      vy: 0,
      r: 6,
      state: 'grey',
      decayStart: 1000,
      ...overrides.bullet,
    }],
    slots: [{
      index: 0,
      body: { x: 300, y: 300, r: 14, vx: 0, vy: 0, alive: true },
      metrics: { charge: 0, maxCharge: 5, hp: 10, maxHp: 10 },
      timers: { absorbComboCount: 0, absorbComboTimer: 0, chainMagnetTimer: 0, barrierPulseTimer: 0 },
      upg: { absorbValue: 1, maxCharge: 5, ...overrides.upg0 },
      orbState: { cooldowns: [0] },
    }, {
      index: 1,
      body: { x: 500, y: 300, r: 14, alive: true },
      metrics: { charge: 0, maxCharge: 4, hp: 10, maxHp: 10 },
      timers: {},
      upg: { absorbValue: 1, absorbRange: 0, maxCharge: 4, ...overrides.upg1 },
      orbState: { cooldowns: [] },
    }],
    effectQueue: [],
    ...overrides.state,
  };
}

{
  const state = makeState();
  const count = resolveGreyAbsorbs(state, 1 / 60, { queueEffects: true });
  assert.equal(count, 1);
  assert.equal(state.bullets.length, 0);
  assert.equal(state.slots[0].metrics.charge, 1);
  assert.equal(state.effectQueue.some((e) => e.kind === 'slot.chargeGain'), true);
  assert.equal(state.effectQueue.some((e) => e.kind === 'grey.absorbEffect'), true);
  assert.equal(state.effectQueue.some((e) => e.kind === 'sparks'), false);
}

{
  const state = makeState({
    bullet: { x: 500, y: 300 },
  });
  const count = resolveGreyAbsorbs(state, 1 / 60);
  assert.equal(count, 1);
  assert.equal(state.bullets.length, 0);
  assert.equal(state.slots[1].metrics.charge, 1);
}

{
  const state = makeState({
    upg0: { resonantAbsorb: true },
  });
  state.slots[0].timers.absorbComboCount = 2;
  const count = resolveGreyAbsorbs(state, 1 / 60);
  assert.equal(count, 1);
  assert.equal(state.slots[0].metrics.charge, 1.5);
  assert.equal(state.slots[0].timers.absorbComboCount, 0);
}

{
  const state = makeState({
    upg0: { refraction: true, refractionCooldown: 0, refractionCount: 0 },
  });
  const count = resolveGreyAbsorbs(state, 1 / 60);
  assert.equal(count, 1);
  assert.equal(state.bullets.length, 1);
  assert.equal(state.bullets[0].state, 'output');
  assert.equal(state.slots[0].upg.refractionCount, 1);
}

{
  const state = makeState({
    bullet: { x: 340, y: 300 },
    upg0: { absorbOrbs: true, orbitSphereTier: 1 },
    state: { timeMs: 0 },
  });
  state.slots[0].body.x = 100;
  state.slots[0].body.y = 100;
  const count = resolveGreyAbsorbs(state, 1 / 60);
  assert.equal(count, 0);

  state.slots[0].body.x = 300;
  state.slots[0].body.y = 300;
  const count2 = resolveGreyAbsorbs(state, 1 / 60);
  assert.equal(count2, 1);
  assert.equal(state.slots[0].metrics.charge, 1);
}

{
  const state = makeState({
    bullet: { decayStart: 0 },
  });
  const count = resolveGreyAbsorbs(state, 1 / 60, { greyDecayMs: 100 });
  assert.equal(count, 0);
  assert.equal(state.bullets.length, 0);
  assert.equal(state.slots[0].metrics.charge, 0);
}

console.log('✓ grey absorb step tests passed');
