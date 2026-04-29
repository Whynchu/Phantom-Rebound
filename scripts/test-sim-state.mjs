// R0.3 — SimState + effect queue scaffolding tests.
//
// These tests validate the SHAPE of sim state, not yet wiring into
// script.js. Once R0.4 begins migrating subsystems, these tests will
// expand to cover invariants of the shape (e.g., bullets[].id is unique).

import { createSimState, resetSimState, createSlot } from '../src/sim/simState.js';
import {
  emit, drain, clear, snapshot, restore, size, initEffectQueue,
} from '../src/sim/effectQueue.js';

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { console.log('  \u2713 ' + name); pass++; }
  else { console.log('  \u2717 ' + name); fail++; }
}

console.log('R0 — sim/simState');

// ── createSimState ────────────────────────────────────────────────────
{
  const s = createSimState({ seed: 42 });
  ok('createSimState: tick starts at 0', s.tick === 0);
  ok('createSimState: timeMs starts at 0', s.timeMs === 0);
  ok('createSimState: seed normalized to uint32', s.seed === 42);
  ok('createSimState: rngState seeded from seed', s.rngState === 42);
  ok('createSimState: world default dims 0', s.world.w === 0 && s.world.h === 0);
  ok('createSimState: obstacles empty array', Array.isArray(s.world.obstacles) && s.world.obstacles.length === 0);
  ok('createSimState: solo defaults to 1 slot', s.slots.length === 1);
  ok('createSimState: bullets empty', Array.isArray(s.bullets) && s.bullets.length === 0);
  ok('createSimState: enemies empty', Array.isArray(s.enemies) && s.enemies.length === 0);
  ok('createSimState: run.roomIndex 0', s.run.roomIndex === 0);
  ok('createSimState: run.roomPhase intro', s.run.roomPhase === 'intro');
  ok('createSimState: run.score 0', s.run.score === 0);
  ok('createSimState: run.gameOver false', s.run.gameOver === false);
  ok('createSimState: nextEnemyId 1', s.nextEnemyId === 1);
  ok('createSimState: nextBulletId 1', s.nextBulletId === 1);
  ok('createSimState: effectQueue empty', Array.isArray(s.effectQueue) && s.effectQueue.length === 0);
}

{
  const s = createSimState({ seed: 1, slotCount: 2, worldW: 1280, worldH: 720 });
  ok('createSimState: coop has 2 slots', s.slots.length === 2);
  ok('createSimState: world dims set from args', s.world.w === 1280 && s.world.h === 720);
  ok('createSimState: slot[0].index===0', s.slots[0].index === 0);
  ok('createSimState: slot[1].index===1', s.slots[1].index === 1);
}

// ── createSlot ─────────────────────────────────────────────────────────
{
  const slot = createSlot(0);
  ok('createSlot: body.alive default true', slot.body.alive === true);
  ok('createSlot: body.r default 14', slot.body.r === 14);
  ok('createSlot: metrics.charge 0', slot.metrics.charge === 0);
  ok('createSlot: metrics.aimAngle = -PI/2', slot.metrics.aimAngle === -Math.PI * 0.5);
  ok('createSlot: shields empty', Array.isArray(slot.shields) && slot.shields.length === 0);
  ok('createSlot: orbState arrays initialized', Array.isArray(slot.orbState.fireTimers) && Array.isArray(slot.orbState.cooldowns));
}

// ── seed validation ───────────────────────────────────────────────────
let threw = false;
try { createSimState({ seed: 0 }); } catch (_) { threw = true; }
ok('createSimState: rejects seed=0', threw);

threw = false;
try { createSimState({ seed: NaN }); } catch (_) { threw = true; }
ok('createSimState: rejects NaN seed', threw);

threw = false;
try { createSimState({ seed: 1, slotCount: 3 }); } catch (_) { threw = true; }
ok('createSimState: rejects slotCount=3', threw);

// ── resetSimState ─────────────────────────────────────────────────────
{
  const s = createSimState({ seed: 1, slotCount: 2, worldW: 100, worldH: 100 });
  // Mutate everything mutable
  s.tick = 999;
  s.timeMs = 12345;
  s.bullets.push({ id: 1 });
  s.enemies.push({ id: 1 });
  s.world.obstacles.push({ x: 0, y: 0, w: 10, h: 10 });
  s.slots[0].body.x = 500; s.slots[0].body.alive = false;
  s.slots[0].metrics.hp = 0;
  s.slots[0].metrics.charge = 7;
  s.slots[0].upg.speedMult = 1.5;
  s.slots[0].shields.push({ hardened: true, cooldown: 0 });
  s.slots[0].orbState.fireTimers.push(0.5);
  s.run.roomIndex = 12;
  s.run.score = 999;
  s.run.gameOver = true;
  s.run.boonHistory.push('any');
  s.nextEnemyId = 100;
  s.nextBulletId = 100;
  s.effectQueue.push({ kind: 'test' });

  resetSimState(s, { seed: 7 });

  ok('resetSimState: tick 0', s.tick === 0);
  ok('resetSimState: timeMs 0', s.timeMs === 0);
  ok('resetSimState: new seed', s.seed === 7 && s.rngState === 7);
  ok('resetSimState: bullets cleared', s.bullets.length === 0);
  ok('resetSimState: enemies cleared', s.enemies.length === 0);
  ok('resetSimState: obstacles cleared', s.world.obstacles.length === 0);
  ok('resetSimState: slot body restored', s.slots[0].body.x === 0 && s.slots[0].body.alive === true);
  ok('resetSimState: slot metrics restored', s.slots[0].metrics.hp === 200 && s.slots[0].metrics.charge === 0);
  ok('resetSimState: slot upg cleared', s.slots[0].upg.speedMult === undefined);
  ok('resetSimState: slot shields cleared', s.slots[0].shields.length === 0);
  ok('resetSimState: slot orb timers cleared', s.slots[0].orbState.fireTimers.length === 0);
  ok('resetSimState: run.roomIndex 0', s.run.roomIndex === 0);
  ok('resetSimState: run.gameOver false', s.run.gameOver === false);
  ok('resetSimState: boonHistory cleared', s.run.boonHistory.length === 0);
  ok('resetSimState: nextEnemyId 1', s.nextEnemyId === 1);
  ok('resetSimState: effectQueue cleared', s.effectQueue.length === 0);
  ok('resetSimState: world dims preserved', s.world.w === 100 && s.world.h === 100);
  ok('resetSimState: slot count preserved', s.slots.length === 2);
}

// ── effectQueue ────────────────────────────────────────────────────────
console.log('R0 — sim/effectQueue');
{
  const s = createSimState({ seed: 1 });
  ok('initial size 0', size(s) === 0);
  emit(s, 'particle.spawn', { x: 1, y: 2 });
  ok('emit: queue size 1', size(s) === 1);
  ok('emit: descriptor has kind', s.effectQueue[0].kind === 'particle.spawn');
  ok('emit: descriptor has payload', s.effectQueue[0].x === 1 && s.effectQueue[0].y === 2);

  emit(s, 'audio.shieldHit');
  ok('emit: payload-less ok', s.effectQueue[1].kind === 'audio.shieldHit');

  const drained = drain(s);
  ok('drain: returns array of length 2', drained.length === 2);
  ok('drain: empties queue', size(s) === 0);
  ok('drain: order preserved (FIFO)', drained[0].kind === 'particle.spawn' && drained[1].kind === 'audio.shieldHit');
}

{
  const s = createSimState({ seed: 1 });
  emit(s, 'a'); emit(s, 'b'); emit(s, 'c');
  const cleared = clear(s);
  ok('clear: returns count cleared', cleared === 3);
  ok('clear: queue empty', size(s) === 0);
}

{
  const s = createSimState({ seed: 1 });
  emit(s, 'x', { v: 1 }); emit(s, 'y', { v: 2 });
  const snap = snapshot(s);
  ok('snapshot: deep copy returned', snap.length === 2);
  ok('snapshot: deep copy independent', snap !== s.effectQueue);
  // Mutate the snapshot — original must not change.
  snap[0].v = 999;
  ok('snapshot: mutation does not leak to state', s.effectQueue[0].v === 1);
  // Mutating the live queue must not leak into snapshot.
  s.effectQueue[0].v = 42;
  ok('snapshot: state mutation does not leak into snapshot copy', snap[0].v === 999);

  // restore from a saved snapshot
  const beforeRestore = snapshot(s);
  emit(s, 'z'); emit(s, 'w');
  ok('restore: precondition queue grew', size(s) === 4);
  restore(s, beforeRestore);
  ok('restore: queue reverted to snapshot length', size(s) === 2);
  ok('restore: queue contents match', s.effectQueue[0].kind === 'x' && s.effectQueue[1].kind === 'y');
}

// emit validation
{
  const s = createSimState({ seed: 1 });
  let didThrow = false;
  try { emit(s, ''); } catch (_) { didThrow = true; }
  ok('emit: rejects empty kind', didThrow);
  didThrow = false;
  try { emit(s, null); } catch (_) { didThrow = true; }
  ok('emit: rejects null kind', didThrow);
  didThrow = false;
  try { emit({}, 'k'); } catch (_) { didThrow = true; }
  ok('emit: rejects state without effectQueue', didThrow);
}

// initEffectQueue idempotence
{
  const s = createSimState({ seed: 1 });
  emit(s, 'a');
  initEffectQueue(s);
  ok('initEffectQueue: re-initializes queue', size(s) === 0);
}

// R0.4 step 8 — getSlotShields adapter (GAP 2)
{
  const { getSlotShields } = await import('../src/sim/simState.js');
  const s = createSimState({ seed: 1, slotCount: 1 });
  s.slots[0].shields.push({ hardened: false, cooldown: 0 });
  ok('getSlotShields: reads slot.shields directly', getSlotShields(s.slots[0]).length === 1);
  ok('getSlotShields: returns LIVE reference (mutation visible)',
    (() => { const arr = getSlotShields(s.slots[0]); arr.push({ hardened: true, cooldown: 1 }); return s.slots[0].shields.length === 2; })());
  // Legacy player shape — shields directly on object
  const legacy = { x: 0, y: 0, r: 14, shields: [{ hardened: false, cooldown: 0 }, { hardened: true, cooldown: 2 }] };
  ok('getSlotShields: works on legacy player shape', getSlotShields(legacy).length === 2);
  // Defensive: nested under .body fallback
  const nested = { body: { shields: [{ hardened: false, cooldown: 0 }] } };
  ok('getSlotShields: falls back to .body.shields when top-level missing', getSlotShields(nested).length === 1);
  // Defensive: junk input
  ok('getSlotShields: null returns empty array', Array.isArray(getSlotShields(null)) && getSlotShields(null).length === 0);
  ok('getSlotShields: undefined returns empty array', getSlotShields(undefined).length === 0);
  ok('getSlotShields: object without shields returns empty array', getSlotShields({}).length === 0);
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
