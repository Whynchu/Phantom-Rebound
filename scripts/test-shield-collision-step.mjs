// R3 parity — shield collision step tests.
import assert from 'node:assert/strict';
import { resolveShieldCollisions } from '../src/sim/shieldCollisionStep.js';

function makeState({ upg = {}, shield = {}, bullet = {} } = {}) {
  return {
    timeMs: 0,
    nextBulletId: 10,
    bullets: [{
      id: 1,
      state: 'danger',
      x: 335,
      y: 300,
      vx: -100,
      vy: 0,
      r: 5,
      ...bullet,
    }],
    slots: [{
      id: 0,
      body: { x: 300, y: 300, r: 14 },
      metrics: { hp: 50, maxHp: 50, charge: 0 },
      upg: { maxCharge: 10, shieldTier: 1, ...upg },
      timers: { barrierPulseTimer: 0 },
      shields: [{ cooldown: 0, maxCooldown: 0, hardened: false, mirrorCooldown: -9999, ...shield }],
    }],
    effectQueue: [],
  };
}

console.log('\n=== shieldCollisionStep tests ===\n');

{
  const state = makeState();
  const hits = resolveShieldCollisions(state, { queueEffects: true, shieldCooldown: 5 });
  assert.equal(hits, 1);
  assert.equal(state.bullets.length, 0);
  assert.equal(state.slots[0].shields[0].cooldown, 5);
  assert.equal(state.effectQueue.some((fx) => fx.kind === 'shield.hit'), true);
  console.log('PASS shield hit removes danger bullet and starts cooldown');
}

{
  const state = makeState({ upg: { shieldMirror: true } });
  const hits = resolveShieldCollisions(state, { shieldCooldown: 5 });
  assert.equal(hits, 1);
  assert.equal(state.bullets.length, 1);
  assert.equal(state.bullets[0].state, 'output');
  assert.equal(state.bullets[0].ownerId, 0);
  assert.equal(state.slots[0].shields[0].mirrorCooldown, 0);
  console.log('PASS mirror shield spawns reflected output bullet');
}

{
  const state = makeState({ upg: { shieldTempered: true }, shield: { hardened: true } });
  const hits = resolveShieldCollisions(state, { shieldCooldown: 5 });
  assert.equal(hits, 1);
  assert.equal(state.bullets.length, 0);
  assert.equal(state.slots[0].shields[0].hardened, false);
  assert.equal(state.slots[0].shields[0].cooldown, 0);
  console.log('PASS tempered shield absorbs first hit without cooldown');
}

{
  const state = makeState({ upg: { shieldBurst: true, barrierPulse: true } });
  const hits = resolveShieldCollisions(state, { shieldCooldown: 5 });
  assert.equal(hits, 1);
  assert.equal(state.bullets.filter((b) => b.state === 'output').length, 4);
  assert.equal(state.slots[0].metrics.charge, 2);
  assert.equal(state.slots[0].timers.barrierPulseTimer, 800);
  console.log('PASS shield burst and barrier pulse mutate rollback state');
}

{
  const state = makeState({ bullet: { x: 100, y: 100 } });
  const hits = resolveShieldCollisions(state);
  assert.equal(hits, 0);
  assert.equal(state.bullets.length, 1);
  console.log('PASS miss leaves state unchanged');
}

console.log('\nAll shieldCollisionStep tests passed.\n');

