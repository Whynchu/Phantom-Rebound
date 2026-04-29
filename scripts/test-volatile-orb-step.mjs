// R3 parity — volatile orb rollback step tests.
import assert from 'node:assert/strict';
import { resolveVolatileOrbHits } from '../src/sim/volatileOrbStep.js';

function makeState({ upg = {}, timers = {}, cooldowns = [0], bullet = {} } = {}) {
  return {
    timeMs: 0,
    bullets: [{
      id: 1,
      state: 'danger',
      x: 332,
      y: 300,
      vx: 0,
      vy: 0,
      r: 5,
      ...bullet,
    }],
    slots: [{
      id: 0,
      body: { x: 300, y: 300, r: 14 },
      metrics: { hp: 50, maxHp: 50, charge: 0 },
      upg: { orbitSphereTier: 1, volatileOrbs: true, ...upg },
      timers: { volatileOrbGlobalCooldown: 0, ...timers },
      orbState: { fireTimers: [], cooldowns: [...cooldowns] },
      shields: [],
    }],
    effectQueue: [],
  };
}

console.log('\n=== volatileOrbStep tests ===\n');

{
  const state = makeState();
  const hits = resolveVolatileOrbHits(state, { queueEffects: true });
  assert.equal(hits, 1);
  assert.equal(state.bullets.length, 0);
  assert.equal(state.slots[0].orbState.cooldowns[0], 8);
  assert.equal(state.slots[0].timers.volatileOrbGlobalCooldown, 1);
  assert.equal(state.effectQueue.some((fx) => fx.kind === 'volatileOrb.hit'), true);
  console.log('PASS volatile orb removes danger bullet and starts cooldowns');
}

{
  const state = makeState({ timers: { volatileOrbGlobalCooldown: 0.5 } });
  const hits = resolveVolatileOrbHits(state);
  assert.equal(hits, 0);
  assert.equal(state.bullets.length, 1);
  assert.equal(state.slots[0].orbState.cooldowns[0], 0);
  console.log('PASS shared cooldown gates volatile orb hit');
}

{
  const state = makeState({ cooldowns: [2] });
  const hits = resolveVolatileOrbHits(state);
  assert.equal(hits, 0);
  assert.equal(state.bullets.length, 1);
  assert.equal(state.slots[0].timers.volatileOrbGlobalCooldown, 0);
  console.log('PASS per-orb cooldown gates volatile orb hit');
}

{
  const state = makeState({ bullet: { x: 100, y: 100 } });
  const hits = resolveVolatileOrbHits(state);
  assert.equal(hits, 0);
  assert.equal(state.bullets.length, 1);
  console.log('PASS miss leaves state unchanged');
}

{
  const state = makeState({ upg: { volatileOrbs: false } });
  const hits = resolveVolatileOrbHits(state);
  assert.equal(hits, 0);
  assert.equal(state.bullets.length, 1);
  console.log('PASS boon gate disables volatile orb hit');
}

console.log('\nAll volatileOrbStep tests passed.\n');

